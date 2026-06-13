# Módulo de Autenticación — travel-api

**Fecha:** 7 de junio de 2026  
**Bloque:** Fase 2 — Autenticación completa del backend  
**Estado:** ✅ Completado

---

## Tabla de Contenidos

1. [Resumen de archivos creados o modificados](#resumen-de-archivos-creados-o-modificados)
2. [src/types/express.d.ts — Extensión del tipo Request](#1-srctypesexpressdts--extensión-del-tipo-request)
3. [src/middlewares/validate.middleware.ts — Validación con Zod](#2-srcmiddlewaresvalidatemiddlewarets--validación-con-zod)
4. [src/middlewares/error.middleware.ts — Manejo centralizado de errores](#3-srcmiddlewareserrormiddlewarets--manejo-centralizado-de-errores)
5. [src/middlewares/auth.middleware.ts — Autenticación y autorización](#4-srcmiddlewaresauthmiddlewarets--autenticación-y-autorización)
6. [src/controllers/auth.controller.ts — Lógica de registro y login](#5-srccontrollersauthcontrollerts--lógica-de-registro-y-login)
7. [src/routes/auth.routes.ts — Definición de rutas con rate limiting](#6-srcroutesauthroutests--definición-de-rutas-con-rate-limiting)
8. [src/app.ts — Actualización del servidor](#7-srcappts--actualización-del-servidor)
9. [src/index.ts — Actualización del arranque](#8-srcindexts--actualización-del-arranque)
10. [Flujo completo de una petición](#flujo-completo-de-una-petición)
11. [Cómo probar los endpoints](#cómo-probar-los-endpoints)
12. [Decisiones de diseño y por qué](#decisiones-de-diseño-y-por-qué)
13. [Tabla de prioridades de correcciones](#tabla-de-prioridades-de-correcciones)

---

## Resumen de Archivos Creados o Modificados

| Archivo | Acción | Descripción |
|---|---|---|
| `src/types/express.d.ts` | Creado | Extiende la interfaz `Request` de Express para agregar `req.user` |
| `src/middlewares/validate.middleware.ts` | Creado | Middleware reutilizable de validación con Zod |
| `src/middlewares/error.middleware.ts` | Creado | Middleware centralizado de manejo de errores |
| `src/middlewares/auth.middleware.ts` | Creado | Middleware `authenticate` y función `authorize` |
| `src/controllers/auth.controller.ts` | Creado | Lógica de `register` y `login` |
| `src/routes/auth.routes.ts` | Creado | Rutas POST `/auth/register` y POST `/auth/login` con rate limiting |
| `src/app.ts` | Modificado | Agrega helmet, CORS, morgan, auth routes, error handler, health check robusto |
| `src/index.ts` | Modificado | Agrega carga de dotenv y validación fail-fast de env vars |

---

## 1. src/types/express.d.ts — Extensión del tipo Request

### ¿Qué hace este archivo?

Express incluye un tipo llamado `Request` que define todos los campos disponibles en `req`. Por defecto, `req.user` no existe en ese tipo — Express no sabe que nosotros vamos a agregarlo.

Sin este archivo, TypeScript lanzaría un error en cualquier lugar donde se acceda a `req.user`:
```
Property 'user' does not exist on type 'Request'
```

### Técnica: Declaration Merging

TypeScript permite "fusionar" una declaración de tipo existente con campos adicionales. Esto es lo que hace el archivo:

```typescript
declare global {
  namespace Express {
    interface Request {
      user?: {
        id:   string
        role: string
      }
    }
  }
}

export {}
```

- `declare global` → indica que esta declaración es global (no local al módulo)
- `namespace Express` → el namespace que Express usa para sus tipos
- `interface Request` → fusión con la interfaz existente de Express
- `user?` → el `?` la hace opcional: no existe antes de `authenticate`, sí existe después
- `export {}` → convierte el archivo en un módulo TypeScript. Sin esto, `declare global` no funciona correctamente

### ¿Por qué no se tipea directamente en el middleware?

Porque TypeScript necesita saber que `req.user` existe **antes de compilar** cualquier archivo que lo use. Al declararlo globalmente aquí, todos los archivos del proyecto lo ven automáticamente sin necesidad de importar nada.

---

## 2. src/middlewares/validate.middleware.ts — Validación con Zod

### ¿Qué problema resuelve?

Sin validación de entrada, si el body de un request llega sin `email`, o con un email con formato inválido, o con una contraseña de un solo carácter:

- El controller recibe datos incorrectos
- Prisma puede guardar datos sucios en la base de datos
- El usuario recibe un mensaje de error genérico "Internal server error" en lugar de "El email es requerido"

### Patrón Higher-Order Function

```typescript
export const validate =
  (schema: ZodSchema) =>                          // 1. recibe el esquema
  (req: Request, res: Response, next: NextFunction): void => {  // 2. retorna el middleware
    const result = schema.safeParse(req.body)
    if (!result.success) {
      res.status(400).json({
        error:   'Datos de entrada inválidos',
        details: result.error.flatten().fieldErrors,
      })
      return
    }
    req.body = result.data  // datos limpios y tipados
    next()
  }
```

**¿Por qué higher-order function?** Porque así el mismo middleware sirve para cualquier esquema. En las rutas se usa así:

```typescript
router.post('/register', validate(registerSchema), register)
router.post('/login',    validate(loginSchema),    login)
```

**¿Por qué `safeParse` en vez de `parse`?** `parse` lanza una excepción si falla. `safeParse` retorna un objeto `{ success, data, error }` — permite manejar el error de forma controlada sin necesidad de try/catch.

**`req.body = result.data`** → Este paso es importante. Zod puede transformar datos (ej. trim de espacios, conversión de tipos). Al reemplazar `req.body` con los datos procesados por Zod, el controller recibe los datos exactamente como el esquema los define.

**¿Por qué `result.error.flatten().fieldErrors`?** Zod puede generar errores anidados. `flatten()` los simplifica en un objeto `{ field: ['mensaje de error'] }` que el frontend puede mostrar directamente en cada campo del formulario.

---

## 3. src/middlewares/error.middleware.ts — Manejo Centralizado de Errores

### ¿Qué problema resuelve?

El patrón anterior (try-catch en cada controller retornando 500 genérico) tiene tres problemas:
1. El error real se pierde silenciosamente — no hay forma de debuggear en producción
2. Todos los errores reciben el mismo tratamiento (500), aunque algunos deberían ser 409 (duplicado), 503 (DB caída), etc.
3. Se repite el mismo bloque de código en cada controller (viola el principio DRY)

### Implementación

```typescript
export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  const message = err instanceof Error ? err.message : String(err)
  console.error(`[ERROR] ${req.method} ${req.path} →`, message)

  // Error de Prisma: violación de constraint UNIQUE (ej. email duplicado)
  if (err?.code === 'P2002') {
    res.status(409).json({ error: 'El recurso ya existe' })
    return
  }

  res.status(500).json({ error: 'Error interno del servidor' })
}
```

**`ErrorRequestHandler`** → tipo de Express para funciones de error. Al usarlo como tipo explícito, TypeScript sabe que el primer parámetro `err` tiene tipo `any`, que es correcto porque un error handler puede recibir cualquier cosa que alguien le pase con `next(err)`.

**`err?.code === 'P2002'`** → Prisma asigna el código `P2002` a las violaciones de constraint UNIQUE (intentar crear un usuario con un email ya existente). Al detectarlo aquí, se retorna 409 Conflict en vez de 500.

**`_next`** → La convención `_` al inicio del nombre indica "este parámetro es requerido por la firma de Express pero no se usa". Sin el cuarto parámetro, Express no reconocería la función como error handler.

**`console.error`** → Aquí va un logger real en producción (pino o winston). Por ahora, `console.error` es suficiente para desarrollo.

### ¿Cómo funciona en Express 5?

En Express 5, los errores de funciones `async` llegan automáticamente a este middleware sin necesitar `next(err)` explícito. En Express 4, se necesitaba escribir:

```typescript
// Express 4 — el controller tenía que llamar next(err)
catch (error) { next(error) }
```

En Express 5, simplemente con que el controller lance un error (sin catch), Express lo captura y lo envía al error handler. Los try-catch en los controllers siguen siendo válidos para manejar casos específicos con respuestas controladas.

---

## 4. src/middlewares/auth.middleware.ts — Autenticación y Autorización

### `authenticate` — Verifica el JWT

```typescript
export const authenticate = (req: Request, res: Response, next: NextFunction): void => {
  const authHeader = req.headers.authorization

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Token no proporcionado' })
    return
  }

  const token = authHeader.split(' ')[1]

  try {
    const decoded = verify(token, process.env.JWT_SECRET!, { algorithms: ['HS256'] })

    if (typeof decoded === 'string' || !decoded['id'] || !decoded['role']) {
      res.status(401).json({ error: 'Token con formato inválido' })
      return
    }

    req.user = { id: decoded['id'] as string, role: decoded['role'] as string }
    next()
  } catch {
    res.status(401).json({ error: 'Token inválido o expirado' })
  }
}
```

**`algorithms: ['HS256']`** → Previene el "Algorithm Confusion Attack". Un atacante podría crear un JWT con `"alg": "none"` en el header para saltarse la verificación de firma. Al especificar el algoritmo esperado, el servidor rechaza cualquier JWT que use un algoritmo distinto.

**`typeof decoded === 'string'`** → `jwt.verify` puede retornar un `string` si el payload del JWT es un valor primitivo (raro pero posible). Esta verificación descarta ese caso antes de acceder a propiedades del objeto.

**`decoded['id'] as string`** → Después de verificar que `decoded.id` existe y es truthy, el cast `as string` es seguro. TypeScript lo necesita porque el tipo del payload incluye `[key: string]: unknown` (índice genérico).

**`return` después de `res.status(401)`** → Importante. Sin el `return`, Express continuaría ejecutando el código después del `if`, intentando llamar `next()` y generando la advertencia "Cannot set headers after they are sent to the client".

### `authorize` — Verifica el Rol

```typescript
export const authorize =
  (...roles: string[]) =>
  (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'No autenticado' })
      return
    }
    if (!roles.includes(req.user.role)) {
      res.status(403).json({ error: 'Permisos insuficientes' })
      return
    }
    next()
  }
```

**`...roles: string[]`** → El spread operator permite pasar uno o varios roles: `authorize('ADMIN')` o `authorize('ADMIN', 'MANAGER')`.

**401 vs 403** → Convención HTTP importante:
- `401 Unauthorized` → "No sé quién eres" (sin token o token inválido) → el frontend redirige al login
- `403 Forbidden` → "Sé quién eres, pero no tienes permiso" → el frontend muestra "Acceso denegado"

**Uso en rutas:**
```typescript
// Una sola ruta con múltiples middlewares en cadena
router.get('/admin-only', authenticate, authorize('ADMIN'), controller)
router.get('/reports',    authenticate, authorize('ADMIN', 'MANAGER'), controller)
```

---

## 5. src/controllers/auth.controller.ts — Lógica de Registro y Login

### Esquemas Zod exportados

```typescript
export const registerSchema = z.object({
  name:     z.string().min(2,  'El nombre debe tener al menos 2 caracteres'),
  email:    z.string().email(  'Formato de email inválido'),
  password: z.string().min(8,  'La contraseña debe tener al menos 8 caracteres'),
})
```

Los esquemas se exportan para poder importarlos en el archivo de rutas y pasarlos al middleware `validate(schema)`. Así el esquema vive en un solo lugar (el controller) y se reutiliza en la ruta.

**`z.infer<typeof registerSchema>`** → Zod genera automáticamente el tipo TypeScript a partir del esquema. No hay que definir el tipo manualmente — se mantiene sincronizado con el esquema automáticamente.

### `register` — Decisiones de Seguridad

**1. Role hardcodeado como `'EMPLOYEE'`**
```typescript
await prisma.user.create({
  data: { name, email, password: hashedPassword, role: 'EMPLOYEE' },
  // 'role' nunca viene del req.body
})
```
Independientemente de lo que venga en el body, el role siempre es `EMPLOYEE`. Esto elimina la vulnerabilidad de auto-asignación de ADMIN.

**2. 12 salt rounds en bcrypt**
```typescript
const hashedPassword = await bcrypt.hash(password, 12)
```
- 10 rounds: estándar anterior (~100ms) — suficiente hasta ~2022
- 12 rounds: recomendado para 2026 (~400ms) — duplica la resistencia a ataques offline
- 14 rounds: muy seguro pero lento para alta concurrencia (~1600ms)

**3. `select` en Prisma para excluir el password**
```typescript
await prisma.user.create({
  data:   { ... },
  select: { id: true, name: true, email: true, role: true, createdAt: true },
})
```
Prisma solo retorna los campos marcados como `true`. El campo `password` (el hash) **nunca** sale en la respuesta JSON.

### `login` — Decisiones de Seguridad

**Mensaje genérico de error**
```typescript
if (!user) {
  res.status(401).json({ error: 'Credenciales inválidas' })
  return
}
const passwordMatch = await bcrypt.compare(password, user.password)
if (!passwordMatch) {
  res.status(401).json({ error: 'Credenciales inválidas' })
  return
}
```
Mismo mensaje para "email no existe" y "password incorrecto". Si fueran distintos, un atacante podría enumerar emails válidos: prueba un email hasta recibir "password incorrecto" en vez de "email no encontrado", confirmando que ese email está registrado.

**Payload mínimo en el JWT**
```typescript
const token = sign({ id: user.id, role: user.role }, process.env.JWT_SECRET!, jwtOptions)
```
Solo `id` y `role`. El `id` permite identificar al usuario en requests posteriores. El `role` permite hacer autorización sin consultar la DB en cada request. El `name` y `email` se retornan en el body de la respuesta pero **no** van en el JWT, porque el JWT podría quedar en logs.

---

## 6. src/routes/auth.routes.ts — Definición de Rutas con Rate Limiting

### Estructura de la cadena de middlewares

```
HTTP POST /auth/register
  → registerLimiter  → rechaza si supera 5 registros/hora por IP
  → validate(registerSchema)  → rechaza si body es inválido (400)
  → register  → ejecuta la lógica, retorna 201 o 409
```

### ¿Por qué rate limiting diferenciado?

```typescript
const loginLimiter    = rateLimit({ windowMs: 15 * 60 * 1000, max: 10 })  // 10/15min
const registerLimiter = rateLimit({ windowMs: 60 * 60 * 1000, max: 5  })  // 5/hora
```

- **Login más estricto:** Es el vector principal de fuerza bruta. 10 intentos en 15 minutos antes del bloqueo hace inviable el ataque de diccionario.
- **Register más permisivo:** Los usuarios legítimos raramente necesitan registrar más de 5 cuentas por hora. El límite más alto evita falsos positivos.
- **`standardHeaders: true`** → Incluye en la respuesta los headers `RateLimit-Limit`, `RateLimit-Remaining` y `RateLimit-Reset` para que el frontend pueda mostrar "intenta de nuevo en X minutos".

---

## 7. src/app.ts — Actualización del Servidor

### Orden de los middlewares (importa)

```typescript
app.use(helmet())      // 1. Seguridad primero
app.use(cors(...))     // 2. CORS antes de procesar cualquier request
app.use(morgan('dev')) // 3. Logging de requests
app.use(express.json()) // 4. Parsing del body

app.use('/auth', authRoutes) // Rutas

app.get('/health', ...)  // Health check

app.use(errorHandler)   // SIEMPRE al final
```

**¿Por qué el orden importa?**

- `helmet` debe ir primero para que todos los responses tengan los headers de seguridad
- `cors` debe ir antes de las rutas para responder correctamente a los preflight requests (peticiones OPTIONS que el browser envía antes de las peticiones reales)
- `errorHandler` **debe** ser el último middleware registrado. Express evalúa los middlewares en orden y el error handler solo se activa cuando alguien llama `next(error)` o un async handler lanza una excepción

### Health check robusto

```typescript
app.get('/health', async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`
    res.json({ status: 'ok', db: 'connected', message: 'travel-api running' })
  } catch {
    res.status(503).json({ status: 'error', db: 'disconnected' })
  }
})
```

**`prisma.$queryRaw\`SELECT 1\``** → La query más simple posible. Si la conexión a la base de datos está caída, lanza un error que el catch convierte en 503 Service Unavailable. Railway usa este endpoint para decidir si reiniciar el servidor — si siempre retorna 200 aunque la DB esté caída, Railway no sabrá que el servidor está degradado.

---

## 8. src/index.ts — Actualización del Arranque

Ver `doc/01-correcciones-criticas.md` sección 4 para el análisis completo del patrón dotenv + fail-fast.

---

## Flujo Completo de una Petición

### POST /auth/register (caso exitoso)

```
Cliente envía: POST /auth/register
  Body: { "name": "Juan", "email": "juan@empresa.com", "password": "MiPass123" }

1. helmet()         → agrega headers de seguridad al response
2. cors()           → verifica que el origen del request está permitido
3. morgan()         → registra la petición en consola
4. express.json()   → parsea el body y lo pone en req.body
5. registerLimiter  → verifica que esta IP no ha superado el límite (5/hora)
6. validate(registerSchema) → valida que name ≥ 2 chars, email válido, password ≥ 8 chars
7. register()       → busca si existe el email (no existe)
                    → hashea el password con bcrypt (12 rounds)
                    → crea el usuario en PostgreSQL con role EMPLOYEE
                    → retorna 201 { message, user (sin password) }
```

### POST /auth/login (caso exitoso)

```
Cliente envía: POST /auth/login
  Body: { "email": "juan@empresa.com", "password": "MiPass123" }

1-4. Mismos middlewares globales
5. loginLimiter     → verifica que esta IP no ha superado el límite (10/15min)
6. validate(loginSchema) → valida que email es válido, password no está vacío
7. login()          → busca el usuario por email (existe)
                    → compara password con hash (coincide)
                    → genera JWT con payload { id, role }
                    → retorna 200 { message, token, user (sin password) }

Cliente recibe el token y lo guarda (localStorage o cookie).
En requests posteriores a rutas protegidas envía:
  Authorization: Bearer <token>
```

### GET /ruta-protegida (con token válido)

```
Cliente envía: GET /trips (ejemplo futuro)
  Header: Authorization: Bearer eyJhbGciOiJIUzI1NiJ9...

1-4. Middlewares globales
5. authenticate()   → extrae el token del header
                    → verifica la firma con JWT_SECRET y algoritmo HS256
                    → decodifica el payload { id, role }
                    → asigna req.user = { id, role }
                    → llama next()
6. authorize('ADMIN', 'MANAGER') → verifica que req.user.role está en la lista
                    → llama next()
7. controller()     → tiene acceso a req.user.id y req.user.role sin consultar la DB
```

---

## Cómo Probar los Endpoints

### Prerequisito

Crear el archivo `.env` con tus credenciales reales antes de iniciar el servidor:

```bash
cp .env.example .env
# Editar .env con la contraseña real de PostgreSQL y un JWT_SECRET fuerte
```

Luego arrancar el servidor:

```bash
npm run dev
```

### Probar con curl

**Registrar un usuario:**
```bash
curl -X POST http://localhost:3001/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name": "Juan Manager", "email": "juan@empresa.com", "password": "MiPass123"}'

# Respuesta esperada (201):
# { "message": "Usuario creado exitosamente", "user": { "id": "...", "role": "EMPLOYEE", ... } }
```

**Intentar registrar con email duplicado:**
```bash
# Segunda vez con el mismo email → debería retornar 409
curl -X POST http://localhost:3001/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name": "Juan", "email": "juan@empresa.com", "password": "MiPass123"}'

# Respuesta esperada (409):
# { "error": "El email ya está en uso" }
```

**Datos inválidos (validación Zod):**
```bash
curl -X POST http://localhost:3001/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name": "J", "email": "no-es-email", "password": "abc"}'

# Respuesta esperada (400):
# { "error": "Datos de entrada inválidos", "details": { "name": [...], "email": [...], "password": [...] } }
```

**Login exitoso:**
```bash
curl -X POST http://localhost:3001/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "juan@empresa.com", "password": "MiPass123"}'

# Respuesta esperada (200):
# { "message": "Login exitoso", "token": "eyJ...", "user": { "id": "...", "role": "EMPLOYEE" } }
```

**Health check:**
```bash
curl http://localhost:3001/health

# Con DB conectada (200):
# { "status": "ok", "db": "connected", "message": "travel-api running" }
```

---

## Decisiones de Diseño y Por Qué

| Decisión | Alternativa descartada | Por qué esta decisión |
|---|---|---|
| `role: 'EMPLOYEE'` hardcodeado en register | Tomar `role` del body | Previene auto-asignación de ADMIN |
| Esquemas Zod en el controller, importados en rutas | Esquemas en archivo separado `schemas/` | Menor número de archivos para un proyecto de este tamaño |
| `safeParse` en el middleware de validación | `parse` con try/catch | Control de flujo más explícito, sin excepciones |
| `algorithms: ['HS256']` en jwt.verify | Sin especificar algoritmo | Previene Algorithm Confusion Attack |
| Mensaje genérico "Credenciales inválidas" | Mensajes distintos para email/password | Previene enumeración de usuarios |
| 12 salt rounds en bcrypt | 10 rounds | Mayor resistencia a ataques offline en hardware moderno de 2026 |
| `ErrorRequestHandler` como tipo del error handler | `(err: unknown, ...) => void` | Compatibilidad correcta con el tipo de `app.use()` en Express 5 |
| Health check con `prisma.$queryRaw\`SELECT 1\`` | Solo retornar `{ status: 'ok' }` | Verifica la conexión real a la DB, no solo que Express está vivo |

---

## Tabla de Prioridades de Correcciones

Esta tabla registra las vulnerabilidades identificadas y corregidas en este módulo.

| # | Hallazgo | Severidad | Prioridad | Estado |
|---|---|---|---|---|
| 1 | Auto-asignación del rol ADMIN desde el body | 🔴 Crítica | Bloqueante de seguridad | ✅ Corregido |
| 2 | Sin validación de datos de entrada (Zod) | 🔴 Crítica | Bloqueante de seguridad y UX | ✅ Corregido |
| 3 | Sin rate limiting en endpoints de auth | 🔴 Crítica | Bloqueante pre-deploy | ✅ Corregido |
| 4 | Sin headers de seguridad HTTP (helmet) | 🔴 Crítica | Bloqueante pre-deploy | ✅ Corregido |
| 5 | Sin CORS configurado | 🔴 Crítica | Bloqueante para el frontend | ✅ Corregido |
| 6 | Sin middleware centralizado de errores | 🟡 Importante | Alta | ✅ Corregido |
| 7 | Health check sin verificación real de DB | 🟡 Importante | Alta | ✅ Corregido |
| 8 | Algorithm Confusion Attack en jwt.verify | 🟡 Importante | Alta | ✅ Corregido |
| 9 | Cast inseguro del JWT payload | 🟡 Importante | Alta | ✅ Corregido con type guard |
| 10 | 10 salt rounds (insuficiente en 2026) | 🟡 Importante | Media | ✅ Subido a 12 |
| 11 | Sin logging de requests (morgan) | 🟢 Nice-to-have | Baja | ✅ Corregido |
| 12 | Refresh tokens (sesión revocable) | 🟢 Nice-to-have | Pre-deploy final | ⏳ Pendiente — Fase futura |
| 13 | Testing con Jest + Supertest | 🟢 Nice-to-have | Pre-deploy portfolio | ⏳ Pendiente — Fase futura |
| 14 | Documentación Swagger/OpenAPI | 🟢 Nice-to-have | Pre-deploy portfolio | ⏳ Pendiente — Fase futura |

---

## Próximos Pasos

Con el módulo de autenticación del backend completado, los siguientes pasos son:

1. **Crear el `.env`** con las credenciales reales y probar los endpoints con curl o Postman
2. **Construir el formulario de login** en `travel-front` (`src/app/(auth)/login/page.tsx`)
3. **Conectar el frontend** con el endpoint `POST /auth/login`
4. **Guardar el JWT** en el frontend (se recomienda httpOnly cookie para producción)
5. **Proteger las rutas del dashboard** en Next.js con `src/middleware.ts`
6. **Implementar el módulo Trips** — modelos Prisma + endpoints REST + páginas Next.js

---

*Este documento es la memoria técnica del módulo de autenticación. Ver `doc/01-correcciones-criticas.md` para las correcciones estructurales que precedieron a este módulo.*
