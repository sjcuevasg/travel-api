# Análisis Completo — Travel & Viáticos Empresariales

**Fecha del análisis:** 7 de junio de 2026  
**Analista:** Arquitecto Senior  
**Proyecto:** travel-api (Backend Express + TypeScript + Prisma + PostgreSQL)  
**Versión analizada:** Estado actual del repositorio local

---

## Tabla de Contenidos

1. [Observación Inicial — Estado Real vs. Estado Descrito](#0-observación-inicial)
2. [Dimensión 1 — Análisis Completo de Lógica](#dimensión-1--análisis-completo-de-lógica)
   - 1.1 [Flujo de Register](#11-flujo-de-register)
   - 1.2 [Flujo de Login](#12-flujo-de-login)
   - 1.3 [Middleware authenticate](#13-middleware-authenticate)
   - 1.4 [Middleware authorize](#14-middleware-authorize)
   - 1.5 [Vulnerabilidades de Seguridad](#15-vulnerabilidades-de-seguridad)
   - 1.6 [Manejo de Errores](#16-manejo-de-errores)
   - 1.7 [Validación de Datos de Entrada](#17-validación-de-datos-de-entrada)
3. [Dimensión 2 — Análisis Completo de Arquitectura](#dimensión-2--análisis-completo-de-arquitectura)
   - 2.1 [Separación en Capas](#21-separación-en-capas)
   - 2.2 [Estructura de Carpetas](#22-estructura-de-carpetas)
   - 2.3 [PrismaClient Singleton](#23-prismaclient-singleton)
   - 2.4 [Separación app.ts / index.ts](#24-separación-appts--indexts)
   - 2.5 [Capa de Services](#25-capa-de-services)
   - 2.6 [Configuración de tsconfig.json](#26-configuración-de-tsconfigjson)
   - 2.7 [Conventional Commits](#27-conventional-commits)
   - 2.8 [Decisiones Arquitectónicas a Corregir Ahora](#28-decisiones-arquitectónicas-a-corregir-ahora)
4. [Dimensión 3 — Estado Exacto del Proyecto y Roadmap](#dimensión-3--estado-exacto-del-proyecto-y-roadmap)
   - 3.1 [Estado Exacto dentro de la Fase 2](#31-estado-exacto-dentro-de-la-fase-2)
   - 3.2 [Porcentaje de Avance General hacia el MVP](#32-porcentaje-de-avance-general-hacia-el-mvp)
   - 3.3 [Próximos Pasos Detallados](#33-próximos-pasos-detallados)
   - 3.4 [Almacenamiento del JWT en el Frontend](#34-almacenamiento-del-jwt-en-el-frontend)
   - 3.5 [MVP Mínimo Presentable para Portfolio](#35-mvp-mínimo-presentable-para-portfolio)
5. [Dimensión 4 — Recomendaciones y Sugerencias Exhaustivas](#dimensión-4--recomendaciones-y-sugerencias-exhaustivas)
   - 4.1 [Categoría 1 — Correcciones Críticas](#41-categoría-1--correcciones-críticas)
   - 4.2 [Categoría 2 — Mejoras Importantes](#42-categoría-2--mejoras-importantes)
   - 4.3 [Categoría 3 — Mejoras Profesionales](#43-categoría-3--mejoras-profesionales)
6. [Resumen Ejecutivo](#resumen-ejecutivo)

---

## 0. Observación Inicial

### Estado Real del Repositorio vs. lo Descrito en el Contexto

Antes de iniciar el análisis técnico, existe una discrepancia crítica entre el estado que se describe como "completado" y lo que realmente existe en el repositorio local. Esta observación es importante porque el análisis de lógica que sigue evalúa el código tal como fue descrito (para que sea educativo), pero el desarrollador debe ser consciente de qué archivos existen realmente.

#### Archivos que SÍ existen en el repositorio

| Archivo | Estado |
|---|---|
| `src/app.ts` | Existe — configuración base de Express |
| `src/index.ts` | Existe — arranque del servidor |
| `src/config/prisma.ts` | Existe — singleton de PrismaClient |
| `prisma/schema.prisma` | Existe — modelo User y enum Role |
| `prisma/migrations/20260408212717_init/migration.sql` | Existe — migración ejecutada |
| `prisma.config.ts` | Existe — configuración Prisma 7 |
| `tsconfig.json` | Existe |
| `package.json` | Existe |
| `.gitignore` | Existe |

#### Archivos que se describen como creados pero NO existen en el repositorio

| Archivo descrito | Estado real |
|---|---|
| `src/controllers/auth.controller.ts` | **No existe** |
| `src/routes/auth.routes.ts` | **No existe** |
| `src/middlewares/auth.middleware.ts` | **No existe** |
| `src/types/express.d.ts` | **No existe** |

#### Dependencias descritas como instaladas pero ausentes en package.json

| Dependencia | ¿Está en package.json? |
|---|---|
| `bcryptjs` | **No** |
| `jsonwebtoken` | **No** |
| `@types/bcryptjs` | **No** |
| `@types/jsonwebtoken` | **No** |
| `dotenv` | **No** |
| `cors` | **No** |

> **Conclusión:** El proyecto está más atrás de lo que la descripción indica. La Fase 2 de autenticación está planificada en detalle pero aún no implementada en código real. El análisis de lógica a continuación evalúa el código tal como fue diseñado (usando la descripción como fuente de verdad), lo cual es igualmente valioso para identificar problemas antes de escribirlo.

---

## Dimensión 1 — Análisis Completo de Lógica

### 1.1 Flujo de Register

#### ✅ Lo que está bien diseñado

**Verificación de email duplicado:** Usar `prisma.user.findUnique({ where: { email } })` antes de crear el usuario es el enfoque correcto. Es preferible a intentar la inserción y capturar el error de constraint único de Prisma (error `P2002`), porque produce un mensaje de error más claro y controlado.

**Hasheo con bcrypt — 10 salt rounds:** El número de salt rounds de `10` es el valor por defecto de bcrypt y era adecuado hasta aproximadamente 2022-2024. Para 2026, el estándar profesional ha subido. Los salt rounds definen cuántas veces el algoritmo itera, y cada unidad adicional duplica el tiempo de cómputo:

```
8 rounds  ≈ 40ms   (insuficiente hoy)
10 rounds ≈ 100ms  (acceptable, pero al límite)
12 rounds ≈ 400ms  (recomendado para 2026)
14 rounds ≈ 1600ms (muy seguro, pero lento para alta concurrencia)
```

Con hardware moderno y ataques de GPU, `10` rounds ya no ofrece la misma resistencia que antes. **Recomendación: subir a 12 rounds** para nuevos proyectos en 2026. El impacto en UX es mínimo (400ms en registro es imperceptible), pero la resistencia a ataques offline de diccionario aumenta significativamente.

**Exclusión del password via `select`:** Usar `select: { id: true, name: true, email: true, role: true, createdAt: true }` en el `prisma.user.create()` es la técnica correcta. Prisma solo retorna los campos marcados como `true`, garantizando que el hash de la contraseña nunca salga en la respuesta JSON. Es superior a la alternativa de hacer `delete user.password` después de la query porque ese enfoque depende de acordarse de hacerlo manualmente cada vez.

#### 🔴 Problemas críticos en el flujo de Register

**1. Ausencia total de validación de entrada**

Este es el problema más grave. Si el body del request llega sin `name`, sin `email`, o sin `password`, el código intenta acceder a `req.body.email` que será `undefined`, y luego `prisma.user.findUnique({ where: { email: undefined } })` hará una query inválida o devolverá `null`, continuando el flujo hasta intentar hashear `undefined` con bcrypt, lo que producirá un error inesperado que caerá en el `catch` genérico y retornará un 500 poco informativo.

El usuario que olvidó un campo recibirá "Internal server error" en vez de "El email es requerido". Esto es mala experiencia de usuario y dificulta el debugging.

**2. Auto-asignación del rol ADMIN — Vulnerabilidad crítica de seguridad**

El flujo descrito desestructura `role` de `req.body` y lo usa directamente:

```typescript
// ⚠️ Código con vulnerabilidad — solo ilustrativo
const { name, email, password, role } = req.body
// ...
await prisma.user.create({ data: { name, email, password: hashed, role } })
```

Esto significa que cualquier persona puede hacer una petición HTTP con `{ "role": "ADMIN" }` en el body y registrarse como administrador. No importa que exista el enum en Prisma — Prisma acepta el valor si está dentro del enum. **Cualquier atacante que lea la documentación o pruebe los endpoints puede crear una cuenta ADMIN.**

La solución conceptual es no tomar el role del body en el endpoint de registro público. Los usuarios siempre se crean como `EMPLOYEE`, y solo un `ADMIN` autenticado puede elevar el rol de otro usuario.

**3. Sin validación de formato de email**

Si el usuario envía `"email": "esto-no-es-un-email"`, Prisma lo guardará sin problema porque la columna es un `String` simple, no un campo con constraint de formato en PostgreSQL. La base de datos quedará con datos sucios, y el sistema de notificaciones (cuando se implemente) intentará enviar emails a direcciones inválidas.

**4. Sin validación de longitud mínima de password**

Si el usuario envía `"password": "a"`, bcrypt lo hasheará perfectamente y se creará la cuenta. La seguridad del sistema depende de cuán fuerte sea la contraseña del usuario, y aceptar contraseñas de un carácter es contrario a cualquier política de seguridad moderna.

#### 🟡 Edge cases no cubiertos

- **Body completamente vacío:** `req.body` puede ser `{}` si la petición llega sin `Content-Type: application/json`. Sin el middleware `express.json()` configurado correctamente, o si el cliente no envía el header correcto, `req.body` será `undefined`.
- **Campos con tipo incorrecto:** Si llega `"email": 123` (un número en vez de string), bcrypt y Prisma pueden comportarse de formas inesperadas.
- **Inyección de campos extra:** Si llega `{ "name": "...", "email": "...", "password": "...", "isAdmin": true }`, ese campo extra se ignora por la desestructuración, lo cual es correcto. Pero si en algún momento se usa spread (`...req.body`), sería un vector de ataque (mass assignment vulnerability).

---

### 1.2 Flujo de Login

#### ✅ Lo que está bien diseñado

**Mensaje genérico "Invalid credentials":** Usar el mismo mensaje para "email no existe" y "password incorrecto" es la práctica correcta de seguridad. Si el mensaje fuera "Email not found" vs "Password incorrect", un atacante podría hacer enumeración de usuarios: probar emails hasta recibir "Password incorrect" para confirmar que ese email sí está registrado en el sistema. El mensaje genérico elimina esa superficie de ataque.

**`bcrypt.compare` en vez de comparación directa:** Comparar el password del body con el hash almacenado usando `bcrypt.compare` es la única forma correcta. Nunca se comparan strings directamente porque el hash es diferente en cada ejecución (el salt es aleatorio).

**Claims adecuados en el JWT:** Guardar `{ id: user.id, role: user.role }` en el payload del JWT es correcto. El `id` permite identificar al usuario en requests posteriores, y el `role` permite hacer autorización sin consultar la base de datos en cada request.

#### 🔴 Problemas en el flujo de Login

**1. JWT_SECRET no garantizado sin dotenv explícito**

El código usa `process.env.JWT_SECRET as string`. El `as string` es un cast de TypeScript que silencia el error de tipo (porque TypeScript sabe que `process.env.JWT_SECRET` puede ser `undefined`), pero no garantiza que el valor exista en tiempo de ejecución.

Si `JWT_SECRET` no está en las variables de entorno cuando el servidor arranca (porque nadie cargó el `.env`), `jwt.sign()` recibirá `undefined` y producirá comportamiento inesperado — en algunos casos firma el JWT con la cadena `"undefined"`, en otros lanza un error. Ambos son problemas de seguridad o estabilidad.

La solución es cargar las variables de entorno explícitamente al inicio de la aplicación y fallar rápido si las variables críticas no están definidas (fail-fast pattern).

**2. Expiración de 24h — Análisis de tradeoffs**

Un JWT de 24 horas es un balance razonable para un MVP, pero tiene implicaciones:

| Aspecto | 24h | Mejor alternativa |
|---|---|---|
| UX | El usuario no se desloguea frecuentemente | Igual con refresh tokens |
| Seguridad si el token es robado | El atacante tiene 24h de acceso | Access token de 15min + refresh token |
| Revocación en caso de compromiso | **Imposible sin blacklist** | Refresh token revocable |
| Complejidad de implementación | Simple | Media |

Para un MVP de portfolio, 24h es aceptable. Para producción real, la recomendación es access tokens de 15 minutos + refresh tokens de 7 días almacenados en httpOnly cookies.

**3. Sin validación de entrada en Login**

Igual que en Register: si el body llega sin `email` o sin `password`, el comportamiento es impredecible y el error será un 500 genérico.

---

### 1.3 Middleware authenticate

#### ✅ Lo que está bien diseñado

**Verificación del formato Bearer:** Comprobar que el header existe y empieza con `"Bearer "` (con espacio) es correcto. Extraer el token con `authHeader.split(' ')[1]` funciona correctamente para el formato estándar.

**Propagación al siguiente middleware con `next()`:** Llamar `next()` en caso de éxito y retornar la respuesta de error en caso de fallo es el patrón correcto de Express.

**Uso de `req.user` con declaration merging:** Extender la interfaz `Request` de Express mediante `declare global { namespace Express { interface Request { user?: ... } } }` en `express.d.ts` es la técnica oficial recomendada. Sin esto, TypeScript se quejaría en cada acceso a `req.user`.

#### 🟡 Edge cases y mejoras

**1. El casting `as JwtPayload` es inseguro**

```typescript
// ⚠️ Ilustrativo — casting sin validación
const payload = jwt.verify(token, secret) as JwtPayload
req.user = payload
```

`jwt.verify` puede retornar un `string` además de un objeto (cuando el payload es un string JWT primitivo). El cast `as JwtPayload` le dice a TypeScript "confía en mí, esto es un objeto con `id` y `role`", pero no hay ninguna verificación en runtime de que esos campos realmente existen en el payload. Si el JWT fue creado por otro sistema o está malformado pero tiene firma válida, `req.user.id` sería `undefined`.

La práctica más segura es verificar explícitamente los campos después del decode:

```typescript
// Snippet ilustrativo — verificación post-decode
const decoded = jwt.verify(token, secret)
if (typeof decoded === 'string' || !decoded.id || !decoded.role) {
  res.status(401).json({ error: 'Token inválido' })
  return
}
req.user = { id: decoded.id, role: decoded.role }
```

**2. Algorithm Confusion Attack**

`jwt.verify()` sin opciones adicionales acepta el algoritmo que venga especificado en el header del JWT. Esto abre la puerta a un ataque donde un atacante construye un JWT con `"alg": "none"` (sin firma). La solución es especificar explícitamente el algoritmo esperado:

```typescript
// Snippet ilustrativo — especificar algoritmo
jwt.verify(token, secret, { algorithms: ['HS256'] })
```

---

### 1.4 Middleware authorize

#### ✅ Lo que está bien diseñado

**Higher-order function pattern:** El patrón `authorize(...roles: string[]) => middleware` es correcto y elegante. Permite escribir `router.get('/admin', authenticate, authorize('ADMIN'), controller)` de forma legible.

**`roles.includes(req.user.role)`:** La verificación es correcta para el caso de múltiples roles permitidos.

**Verificación de `req.user` antes de acceder a `req.user.role`:** Si `authenticate` siempre se usa antes que `authorize` en la cadena de middlewares, `req.user` siempre debería existir cuando `authorize` se ejecuta. Sin embargo, la verificación explícita de `req.user` antes de acceder a su propiedad `role` es una buena práctica defensiva.

#### 🟡 Mejora sugerida

**Retornar 401 vs 403:** La convención HTTP diferencia entre:
- `401 Unauthorized`: "No sé quién eres" (no hay token, o el token es inválido)
- `403 Forbidden`: "Sé quién eres, pero no tienes permiso"

`authenticate` debe retornar 401 (correcto según el diseño). `authorize` debe retornar 403 (correcto según el diseño). Esta distinción le permite al frontend decidir si redirigir al login (401) o mostrar una página de "acceso denegado" (403).

---

### 1.5 Vulnerabilidades de Seguridad

#### 🔴 CRÍTICAS — Requieren corrección antes de cualquier deploy

| # | Vulnerabilidad | Impacto | Solución |
|---|---|---|---|
| 1 | Auto-asignación de ADMIN en registro | Un atacante se crea cuenta ADMIN | Ignorar `role` del body, hardcodear `EMPLOYEE` |
| 2 | Sin rate limiting en `/auth/login` | Ataque de fuerza bruta viable | `express-rate-limit` |
| 3 | Sin CORS configurado | El frontend no puede conectarse | Paquete `cors` con origin específico |
| 4 | JWT_SECRET no garantizado cargado | JWT firmado con `undefined` | `dotenv` explícito + fail-fast |
| 5 | Sin validación de entrada | Datos sucios, errores 500 inesperados | `zod` en cada endpoint |

#### 🟡 IMPORTANTES — Corrección antes del MVP

| # | Vulnerabilidad | Impacto | Solución |
|---|---|---|---|
| 6 | Sin headers de seguridad | Vulnerable a XSS, clickjacking, MIME sniffing | `helmet` |
| 7 | Sin HTTPS enforcement | Tokens interceptables en red | Forzar HTTPS en producción |
| 8 | Errores internos expuestos en 500 | Information disclosure | Logging interno, mensaje genérico al cliente |
| 9 | Algorithm confusion en JWT | JWT forjado con `alg: none` | `algorithms: ['HS256']` en verify |

#### 🟢 NICE-TO-HAVE — Antes del deploy final

| # | Vulnerabilidad | Impacto | Solución |
|---|---|---|---|
| 10 | Single JWT sin revocación | Token robado válido por 24h | Refresh tokens + blacklist |
| 11 | Sin auditoría de accesos | No hay trazabilidad | Logging de requests con Morgan |

---

### 1.6 Manejo de Errores

El diseño actual usa un `try-catch` genérico en cada controller que captura cualquier error y retorna:

```typescript
// Patrón actual descrito — problemático
catch (error) {
  res.status(500).json({ error: 'Internal server error' })
}
```

**Problemas de este enfoque:**

**1. El error real se pierde silenciosamente.** Cuando algo falla en producción, no hay registro de qué falló exactamente. El desarrollador recibe una alerta "500 Internal Server Error" pero no sabe si fue un error de Prisma, un timeout de base de datos, un undefined is not a function, o un error de red. Debuggear en producción sin logs es extremadamente costoso en tiempo.

**2. Todos los errores reciben el mismo tratamiento.** Un error de Prisma por violación de constraint único (`P2002`) debería retornar 409 Conflict, no 500. Un error de conexión a la base de datos debería retornar 503 Service Unavailable. Retornar 500 para todo oculta la causa raíz y complica el debugging del frontend.

**3. El patrón se repite en cada controller.** Si hay 15 endpoints (3 módulos × 5 operaciones CRUD), hay 15 bloques de `catch` idénticos. Si se decide cambiar la estrategia de logging, hay que editar 15 archivos. Esto viola el principio DRY (Don't Repeat Yourself).

**La solución profesional** es un middleware de error centralizado en Express, que se registra una sola vez en `app.ts` y captura todos los errores no manejados de todos los controllers.

---

### 1.7 Validación de Datos de Entrada

**Ausencia de validación y sus consecuencias:**

| Consecuencia | Descripción |
|---|---|
| **Seguridad** | Datos malformados pueden causar excepciones no anticipadas que revelan información del sistema. Strings demasiado largos pueden causar problemas de memoria o rendimiento. |
| **Integridad de datos** | La base de datos puede llenarse con emails sin formato válido, passwords de 1 carácter, o names vacíos. Una vez en base de datos, limpiar datos sucios es costoso. |
| **Experiencia de usuario** | El usuario recibe "Internal server error" cuando debería recibir "El email no tiene un formato válido". El frontend no puede mostrar errores útiles. |
| **Debugging** | Sin validación, es imposible distinguir si un 500 viene de un input inválido o de un error real de la aplicación. |

**Zod como solución recomendada:**

Zod es la librería de validación de esquemas más usada en el ecosistema TypeScript moderno. La razón de elegirla sobre alternativas como `joi` o `express-validator` es que genera tipos de TypeScript automáticamente — defines el esquema una vez y obtienes tanto la validación en runtime como el tipo TypeScript, sin duplicar código.

```typescript
// Snippet ilustrativo — esquema Zod para register
import { z } from 'zod'

const registerSchema = z.object({
  name:     z.string().min(2).max(100),
  email:    z.string().email(),
  password: z.string().min(8).max(100),
  // 'role' no se acepta del body — siempre es EMPLOYEE
})

type RegisterInput = z.infer<typeof registerSchema> // Tipo TypeScript gratis
```

Con un middleware de validación genérico que recibe un schema Zod, se puede agregar validación a cualquier ruta con una línea:

```typescript
// Snippet ilustrativo — uso en la ruta
router.post('/register', validate(registerSchema), register)
```

---

## Dimensión 2 — Análisis Completo de Arquitectura

### 2.1 Separación en Capas

La arquitectura `routes → controllers → middlewares → models → config` es correcta para un proyecto Express de tamaño mediano. Sigue el patrón MVC adaptado a APIs REST y es la estructura que los reclutadores y equipos técnicos reconocen como profesional.

**Evaluación de escalabilidad:**

Cuando se agreguen los módulos `trips`, `expenses` y `activities`, la estructura crecerá de forma predecible:

```
src/
  routes/
    auth.routes.ts
    trips.routes.ts      ← se agrega
    expenses.routes.ts   ← se agrega
    activities.routes.ts ← se agrega
  controllers/
    auth.controller.ts
    trips.controller.ts      ← se agrega
    expenses.controller.ts   ← se agrega
    activities.controller.ts ← se agrega
```

Este crecimiento es lineal y manejable. La estructura actual escala bien hasta aproximadamente 10-15 módulos.

**¿Cuándo se vuelve difícil de manejar?** Cuando un módulo necesita su propio conjunto de tipos, validaciones, y servicios específicos. En ese punto se considera una estructura por feature (ver sección 2.2).

---

### 2.2 Estructura de Carpetas

#### Por tipo de archivo (actual) vs. por feature

**Estructura actual (por tipo):**
```
src/
  routes/        ← todos los routes juntos
  controllers/   ← todos los controllers juntos
  middlewares/   ← todos los middlewares juntos
```

**Ventajas del enfoque actual:**
- Simple de entender para un junior
- Claro para proyectos pequeños (3-5 módulos)
- Convención ampliamente conocida

**Desventajas a medida que crece:**
- Para modificar la funcionalidad de "trips", hay que navegar a 3 carpetas diferentes
- Si se divide en microservicios en el futuro, el código no está co-localizado

**Estructura alternativa (por feature):**
```
src/
  auth/
    auth.routes.ts
    auth.controller.ts
    auth.service.ts
    auth.types.ts
  trips/
    trips.routes.ts
    trips.controller.ts
    trips.service.ts
  shared/
    middlewares/
    config/
```

**Recomendación para este proyecto:** Mantener la estructura actual por tipo para el MVP. Es más simple de explicar en una entrevista y más fácil de mantener con 3-4 módulos. Si el proyecto crece a 10+ módulos o se considera dividir en microservicios, migrar a estructura por feature. **No es una decisión urgente — el coste de migrar es bajo.**

---

### 2.3 PrismaClient Singleton

El patrón implementado en `src/config/prisma.ts` es correcto para Express:

```typescript
// Implementación actual — correcta para Node.js/Express
import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()
export default prisma
```

**¿Por qué un singleton?** PrismaClient gestiona un pool de conexiones a la base de datos. Si se creara una nueva instancia en cada request (en cada controller), se abriría una nueva conexión por cada petición HTTP, agotando rápidamente las conexiones disponibles en PostgreSQL (que por defecto acepta 100 conexiones simultáneas).

**Diferencia con Next.js:** En Next.js, el patrón singleton requiere una precaución adicional. En desarrollo, Next.js usa Hot Module Replacement (HMR), que recarga módulos sin reiniciar el proceso Node.js. Cada recarga crearía una nueva instancia de PrismaClient (porque el módulo se re-evalúa), pero la instancia anterior no se destruye correctamente, acumulando conexiones. La solución en Next.js es guardar la instancia en `globalThis`:

```typescript
// Snippet ilustrativo — patrón correcto para Next.js (no Express)
const globalForPrisma = globalThis as unknown as { prisma: PrismaClient }
const prisma = globalForPrisma.prisma ?? new PrismaClient()
if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
```

En Express con `nodemon`, el proceso se reinicia completo en cada cambio, por lo que el singleton simple es suficiente y correcto. **No necesita modificarse.**

#### ⚠️ Observación sobre Prisma 7 y la ubicación del cliente

El `package.json` usa `@prisma/client: "^7.7.0"` y el `.gitignore` incluye `/src/generated/prisma`. Esto indica que Prisma 7 está generando el cliente en `src/generated/prisma/` en vez de en `node_modules/@prisma/client/` (comportamiento por defecto de Prisma 7).

Sin embargo, `src/config/prisma.ts` importa desde `@prisma/client`. Este puede o no funcionar dependiendo de si Prisma 7 mantiene la re-exportación desde `@prisma/client` hacia la ubicación generada. Si se encuentran errores de importación, la solución es actualizar el import path:

```typescript
// Snippet ilustrativo — import path para Prisma 7 con output local
import { PrismaClient } from '../generated/prisma'
```

---

### 2.4 Separación app.ts / index.ts

La separación implementada es correcta y aporta valor real:

```typescript
// src/app.ts — solo configura Express
const app = express()
app.use(express.json())
// rutas, middlewares...
export default app

// src/index.ts — solo arranca el servidor
import app from './app'
app.listen(PORT, () => console.log(`Server on port ${PORT}`))
```

**¿Por qué es valioso?**

En los tests de integración (con Supertest), se importa `app` sin llamar a `listen`. Si el servidor se iniciara dentro de `app.ts`, cada test abriría una conexión de red real y habría que gestionar el cierre del puerto manualmente. La separación permite:

```typescript
// Snippet ilustrativo — test sin iniciar servidor real
import request from 'supertest'
import app from '../src/app'

test('GET /health returns ok', async () => {
  const res = await request(app).get('/health')
  expect(res.status).toBe(200)
})
```

**La implementación actual es correcta.** No necesita modificarse.

---

### 2.5 Capa de Services

#### ¿Qué es y cuándo es necesaria?

La capa de services es una capa intermedia entre el controller y Prisma. El controller maneja el request/response de HTTP; el service contiene la lógica de negocio pura que no sabe nada de HTTP.

**¿Por qué agregarla?**

Considera el caso de register. Con la arquitectura actual (solo controller):

```
HTTP POST /auth/register → auth.controller.ts → prisma.user.create()
```

Si en el futuro se necesita enviar un email de bienvenida después del registro, o registrar en un sistema de auditoría, o notificar a un Slack de la empresa, esa lógica se acumularía en el controller, que crecería indefinidamente.

Con la capa de services:

```
HTTP POST /auth/register → auth.controller.ts → auth.service.ts → prisma.user.create()
                                                               → email.service.ts
                                                               → audit.service.ts
```

El controller solo orquesta; los services contienen la lógica.

**Ejemplo conceptual con auth.service.ts:**

```typescript
// Snippet ilustrativo — auth.service.ts
export class AuthService {
  async register(data: RegisterInput) {
    const existing = await prisma.user.findUnique({ where: { email: data.email } })
    if (existing) throw new ConflictError('Email already in use')
    const password = await bcrypt.hash(data.password, 12)
    return prisma.user.create({ data: { ...data, password, role: 'EMPLOYEE' }, select: { ... } })
  }
}
```

```typescript
// Snippet ilustrativo — auth.controller.ts con service
const authService = new AuthService()
export const register = async (req: Request, res: Response): Promise<void> => {
  const data = registerSchema.parse(req.body)
  const user = await authService.register(data)
  res.status(201).json({ message: 'User created', user })
}
```

**Recomendación para este proyecto:** Para el MVP con 3-4 módulos simples, la capa de services es opcional pero recomendada si el proyecto aspira a ser referenciado como ejemplo de arquitectura profesional. Si el tiempo es limitado, priorizar otras correcciones críticas primero. **La capa de services se puede agregar de forma incremental** — empieza sin ella y extráela cuando un controller supere las 80-100 líneas.

---

### 2.6 Configuración de tsconfig.json

#### ⚠️ Inconsistencia crítica: moduleResolution vs module

El `tsconfig.json` actual tiene:

```json
"moduleResolution": "bundler",
"module": "commonjs"
```

Esta combinación es problemática. `moduleResolution: "bundler"` fue diseñado para usarse con bundlers (Vite, Webpack, esbuild) que procesan los módulos antes de ejecutarlos. Según la documentación oficial de TypeScript, `bundler` como `moduleResolution` requiere que `module` sea `esnext` o `preserve`. Usarlo con `"module": "commonjs"` (el sistema de módulos de Node.js) es una inconsistencia que TypeScript en versiones estrictas puede rechazar o producir comportamiento inesperado.

La configuración correcta para un backend Node.js con Express es:

```json
// Opción A — recomendada para Node.js 18+
"module": "NodeNext",
"moduleResolution": "NodeNext"

// Opción B — compatible, sin deprecaciones
"module": "CommonJS",
"moduleResolution": "Node16"
```

El hecho de que ts-node esté compilando sin error puede deberse a que ts-node aplica sus propias reglas de resolución de módulos internamente, ignorando parcialmente el `moduleResolution` del tsconfig. En producción con `tsc` puro, puede comportarse diferente.

#### ⚠️ Comentarios en tsconfig.json

El `tsconfig.json` actual contiene comentarios `//`. El formato `tsconfig.json` usa JSONC (JSON with Comments), que TypeScript soporta oficialmente para su archivo de configuración. Esto es técnicamente válido y no causará errores. Sin embargo, hay que tener cuidado si otras herramientas leen el `tsconfig.json` como JSON estándar — algunas fallarán con los comentarios.

#### Opciones faltantes recomendadas

| Opción | Valor | Por qué |
|---|---|---|
| `"resolveJsonModule": true` | — | Permite importar archivos `.json` directamente |
| `"declaration": true` | — | Genera archivos `.d.ts` al compilar (útil si el backend exporta tipos al frontend) |
| `"paths"` | `{"@/*": ["./src/*"]}` | Permite imports absolutos como `import from '@/config/prisma'` |

---

### 2.7 Conventional Commits

La decisión de usar Conventional Commits es correcta y profesional. Los commits referenciados (`feat: initial Next.js setup...` y `feat: initial Express setup...`) siguen el formato correctamente.

**Granularidad:** Los dos commits descritos son commits de "setup inicial" que inevitablemente son grandes. A partir de ahora, la granularidad debería ser más fina:

| Commit correcto | Commit incorrecto |
|---|---|
| `feat(auth): add user registration endpoint` | `feat: auth` |
| `feat(auth): add JWT authentication middleware` | `feat: add all auth stuff` |
| `fix(auth): restrict role self-assignment in register` | `fix: security` |
| `chore(deps): add bcryptjs and jsonwebtoken` | `chore: install packages` |

Una buena regla: si el mensaje del commit necesita "y" para describir lo que hace, es demasiado grande. Ejemplo: "add register endpoint **y** login **y** middleware" → tres commits separados.

---

### 2.8 Decisiones Arquitectónicas a Corregir Ahora

Estas son decisiones que, si no se corrigen ahora, serán significativamente más costosas de cambiar después:

#### 🔴 1. Express v5 — Implicaciones no documentadas

El proyecto usa `express: "^5.2.1"`. Express v5 fue oficialmente lanzado en 2024 y tiene cambios importantes respecto a v4:

- **Los errores de async se propagan automáticamente:** En Express v5, si una función async lanza un error sin try-catch, Express automáticamente lo pasa al error handler. Esto significa que el patrón `try-catch` en cada controller, aunque funciona, es innecesariamente verbose en v5. Sin embargo, el try-catch explícito nunca hace daño — es más claro y explícito.
- **`res.json()` ya no devuelve el objeto Response:** En v5, `res.json()` retorna `void`, no `this`. Código que encadenaba `res.json({}).status(200)` fallaría.
- **Los parámetros de ruta con regex cambiaron:** `/users/:id(\\d+)` ya no funciona igual.

**Para el proyecto:** La principal implicación es que si se decide agregar un middleware de error centralizado, con Express v5 los errores de async controllers llegarán automáticamente sin necesitar un try-catch. Verificar que la documentación que se consulte sea específica para Express v5.

#### ⚠️ 2. package.json — Campo `main` incorrecto

```json
// Actual — incorrecto
"main": "index.js"

// Correcto para este proyecto
"main": "dist/index.js"
```

El campo `main` en `package.json` indica el punto de entrada del módulo cuando otro módulo hace `require('travel-api')`. Aunque en este proyecto el backend no es importado por otros paquetes, la convención correcta es apuntar al JavaScript compilado en `dist/`.

#### 🔴 3. dotenv no está instalado pero sí se usa

`prisma.config.ts` (generado por Prisma 7) tiene `import "dotenv/config"`, lo que requiere que el paquete `dotenv` esté instalado. Sin embargo, `dotenv` no aparece en `package.json`. Esto implica que o bien Prisma bundlea dotenv internamente (y el import funciona solo para los comandos Prisma), o bien el servidor Express arranca sin cargar el `.env`, haciendo que `process.env.PORT`, `process.env.JWT_SECRET` y similares sean `undefined`.

---

## Dimensión 3 — Estado Exacto del Proyecto y Roadmap

### 3.1 Estado Exacto dentro de la Fase 2

La Fase 2 (Autenticación) puede dividirse en los siguientes sub-items:

| Sub-item | Estado | Completado |
|---|---|---|
| Instalación de PostgreSQL local | ✅ Completado | — |
| Creación de base de datos `travel_db` | ✅ Completado | — |
| Instalación de Prisma | ✅ Completado | — |
| Definición del schema (User + Role) | ✅ Completado | — |
| Primera migración ejecutada | ✅ Completado | — |
| Creación del singleton PrismaClient | ✅ Completado | — |
| Instalación bcryptjs + jsonwebtoken | ❌ No realizado | — |
| Instalación dotenv + cors | ❌ No realizado | — |
| Creación auth.controller.ts | ❌ No realizado | — |
| Creación auth.routes.ts | ❌ No realizado | — |
| Creación auth.middleware.ts | ❌ No realizado | — |
| Creación src/types/express.d.ts | ❌ No realizado | — |
| Montaje de auth routes en app.ts | ❌ No realizado | — |
| Pruebas con Postman/curl | ❌ No realizado | — |
| Configuración de CORS | ❌ No realizado | — |

**Porcentaje de completado de la Fase 2: ~35%**

La infraestructura base (base de datos, schema, Prisma) está completa. El código de autenticación en sí (controllers, routes, middlewares) está pendiente.

---

### 3.2 Porcentaje de Avance General hacia el MVP

Definiendo el MVP como: autenticación funcional + CRUD de viajes + CRUD de viáticos + visualización de actividades + deploy.

| Fase | Descripción | Estado | Peso |
|---|---|---|---|
| Fase 0 — Arquitectura y diseño | Completada | ✅ | 5% |
| Fase 1 — Repositorios y estructura base | Completada | ✅ | 10% |
| Fase 2 — Autenticación backend | ~35% completada | 🔄 | 25% |
| Fase 2b — Autenticación frontend | No iniciada | ❌ | 10% |
| Fase 3 — Módulo Trips (CRUD) | No iniciado | ❌ | 15% |
| Fase 4 — Módulo Expenses (CRUD) | No iniciado | ❌ | 15% |
| Fase 5 — Módulo Activities | No iniciado | ❌ | 10% |
| Fase 6 — Deploy (Vercel + Railway) | No iniciado | ❌ | 10% |

**Avance general estimado: 20-25%**

El proyecto tiene una base sólida (arquitectura clara, base de datos configurada, stack seleccionado correctamente), pero el trabajo de implementación real está en su mayoría por delante.

---

### 3.3 Próximos Pasos Detallados

Los pasos ordenados cronológicamente para terminar la autenticación y avanzar al dashboard:

#### Paso 1 — Correcciones previas (1-2 horas)

Antes de escribir el código de auth, corregir las inconsistencias actuales:
- Instalar dependencias faltantes: `npm install bcryptjs jsonwebtoken dotenv cors zod` y las types correspondientes
- Cargar dotenv explícitamente en `src/index.ts` antes de todo
- Corregir el `tsconfig.json` (moduleResolution)
- Corregir el campo `main` en `package.json`

#### Paso 2 — Crear src/types/express.d.ts

Extender la interfaz Request de Express para agregar `req.user`. Debe hacerse primero porque los demás archivos dependen de que TypeScript conozca ese tipo.

#### Paso 3 — Crear auth.controller.ts

Implementar las funciones `register` y `login` con:
- Validación de entrada con Zod
- Role hardcodeado como `EMPLOYEE` en register
- Hasheo con bcrypt (12 rounds)
- Generación de JWT con id y role

#### Paso 4 — Crear auth.routes.ts

Definir las rutas POST `/register` y POST `/login` conectadas al controller.

#### Paso 5 — Crear auth.middleware.ts

Implementar `authenticate` y `authorize` con las correcciones de seguridad identificadas.

#### Paso 6 — Actualizar app.ts

Montar las rutas de auth bajo el prefijo `/auth` y configurar CORS.

#### Paso 7 — Probar con Postman o curl

Verificar todos los casos:
- Register exitoso
- Register con email duplicado (esperar 400)
- Register con body inválido (esperar error de validación)
- Login exitoso (recibir JWT)
- Login con credenciales incorrectas (esperar 401)
- Acceso a ruta protegida sin token (esperar 401)
- Acceso a ruta protegida con token válido (esperar 200)

#### Paso 8 — Construir formulario de login en Next.js

Crear `src/app/(auth)/login/page.tsx` con un formulario que llame al endpoint POST `/auth/login`.

#### Paso 9 — Manejar la sesión en el frontend

Ver sección 3.4 para el análisis de opciones de almacenamiento del JWT.

#### Paso 10 — Proteger rutas en Next.js

Usar el middleware de Next.js (`src/middleware.ts`) para verificar si hay token antes de mostrar páginas del dashboard.

---

### 3.4 Almacenamiento del JWT en el Frontend

Esta es una de las decisiones de mayor impacto en seguridad del frontend. Las tres opciones principales:

#### Opción A — localStorage

```typescript
// Snippet ilustrativo
localStorage.setItem('token', jwt)
const token = localStorage.getItem('token')
```

| Aspecto | Detalle |
|---|---|
| **Persistencia** | Persiste entre pestañas y reinicios del browser |
| **Accesibilidad** | Accesible desde JavaScript — fácil de usar |
| **Riesgo principal** | **Vulnerable a XSS** — si un atacante inyecta JavaScript en la página, puede leer el token |
| **Recomendación** | No usar para tokens de autenticación |

#### Opción B — sessionStorage

Similar a localStorage pero se borra al cerrar la pestaña. Mismo riesgo de XSS. No recomendado.

#### Opción C — httpOnly Cookie (recomendada)

El servidor envía el JWT en una cookie con los flags `httpOnly` y `Secure`. El browser la envía automáticamente en cada request pero **JavaScript nunca puede leerla** — ni el código de la app, ni un script malicioso inyectado.

```typescript
// Snippet ilustrativo — backend setea la cookie
res.cookie('token', jwt, {
  httpOnly: true,   // JavaScript no puede leerla
  secure: true,     // Solo se envía por HTTPS
  sameSite: 'strict', // Protección contra CSRF
  maxAge: 24 * 60 * 60 * 1000 // 24 horas en ms
})
```

| Aspecto | httpOnly Cookie |
|---|---|
| **Seguridad XSS** | ✅ Inmune — JS no puede acceder |
| **Seguridad CSRF** | ⚠️ Requiere `sameSite: 'strict'` o token CSRF |
| **Complejidad** | Mayor — requiere CORS con `credentials: true` |
| **Next.js** | Funciona bien con el App Router |
| **Recomendación** | ✅ La opción correcta para producción |

**Para el MVP de portfolio:** Si la complejidad es un obstáculo, comenzar con localStorage para avanzar rápido y documentar en el README que en producción se usarían httpOnly cookies. Esto es aceptable y honesto para un portfolio — muestra que conoces las implicaciones.

#### Manejo del estado del usuario en el frontend

Para compartir el estado del usuario (quién está logueado, su rol) entre componentes:

```typescript
// Snippet ilustrativo — React Context para auth
const AuthContext = createContext<{ user: User | null; logout: () => void } | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const logout = () => { setUser(null); localStorage.removeItem('token') }
  return <AuthContext.Provider value={{ user, logout }}>{children}</AuthContext.Provider>
}
```

**React Context es suficiente para un MVP.** Zustand o Jotai se consideran cuando el estado de auth necesita sincronizarse con muchas partes desconectadas de la UI, lo cual no es el caso en este proyecto.

---

### 3.5 MVP Mínimo Presentable para Portfolio

Para que el proyecto sea presentable y competitivo como portfolio, el MVP debe incluir:

#### Funcionalidades mínimas

| Feature | Descripción | Prioridad |
|---|---|---|
| Login funcional | Formulario → JWT → dashboard | 🔴 Bloqueante |
| Protección de rutas | Dashboard inaccesible sin login | 🔴 Bloqueante |
| CRUD de Viajes | Crear, listar, ver detalle, eliminar | 🔴 Core |
| CRUD de Viáticos | Crear, listar con monto total | 🔴 Core |
| Listado de Actividades | Por viaje, read-only | 🟡 Importante |
| Logout funcional | Limpiar token y redirigir | 🟡 Importante |
| Roles visibles | UI diferente para ADMIN vs EMPLOYEE | 🟢 Nice-to-have |

#### Calidad de código

| Aspecto | Mínimo | Profesional |
|---|---|---|
| Validación de inputs | Zod en backend | Zod en backend + frontend |
| Manejo de errores | try-catch básico | Middleware centralizado |
| TypeScript | Types básicos | Types estrictos, sin `any` |
| Variables de entorno | `.env.example` | Validación al arrancar |

#### UI/UX mínima

- Diseño limpio con Tailwind (no necesita ser original, puede ser minimalista)
- Estados de carga visibles (spinner mientras llama al API)
- Mensajes de error claros ("Credenciales incorrectas")
- Responsive (funcionar en móvil aunque sea básicamente)
- No es necesario ser "bonito" — sí es necesario ser "funcional y consistente"

#### Deploy funcional

- Backend en Railway con PostgreSQL en la nube
- Frontend en Vercel conectado al backend de Railway
- Variables de entorno configuradas en ambas plataformas
- El demo debe funcionar sin instrucciones — un reclutador no leerá un manual para probar la demo

#### README profesional

- Una oración que describe el proyecto
- Stack tecnológico con badges
- Capturas de pantalla o GIF del flujo principal
- Instrucciones de instalación local en 3-4 pasos
- Variables de entorno necesarias (referenciando `.env.example`)
- Link al demo desplegado en la parte superior

---

## Dimensión 4 — Recomendaciones y Sugerencias Exhaustivas

### 4.1 Categoría 1 — Correcciones Críticas

> Estas correcciones deben implementarse **antes de avanzar a la siguiente fase**. Son bloqueantes en términos de seguridad o funcionalidad básica.

---

#### 🔴 C1-1: Instalar y cargar dotenv explícitamente

**Problema que resuelve:** Sin cargar el `.env`, `process.env.JWT_SECRET`, `process.env.PORT` y todas las variables de entorno son `undefined` cuando el servidor arranca. El proyecto funciona aparentemente porque Prisma 7 carga el `.env` para sus propios comandos CLI, pero el servidor Express no tiene garantía de que esas variables estén disponibles.

**Cómo aplicarlo:**

```typescript
// Snippet ilustrativo — src/index.ts (primera línea del archivo)
import 'dotenv/config' // Debe ser la primera importación

import app from './app'
// ... resto del código
```

Y verificar que las variables críticas existen al arrancar (fail-fast pattern):

```typescript
// Snippet ilustrativo — validación de variables críticas
const requiredEnv = ['DATABASE_URL', 'JWT_SECRET', 'JWT_EXPIRES_IN']
for (const key of requiredEnv) {
  if (!process.env[key]) throw new Error(`Missing required env var: ${key}`)
}
```

**Prioridad:** Bloqueante — sin esto, cualquier código que use `process.env.JWT_SECRET` es inseguro.

---

#### 🔴 C1-2: Crear archivo `.env.example`

**Problema que resuelve:** Cuando alguien clone el repositorio del portfolio (un reclutador técnico, un colaborador), verá el proyecto pero no sabrá qué variables de entorno configurar porque el `.env` real está en `.gitignore`. Sin un `.env.example`, el proyecto no arrancará y la persona se rendirá.

**Cómo aplicarlo:** Crear `.env.example` en la raíz con los nombres de las variables pero sin valores reales:

```bash
# Snippet ilustrativo — .env.example
PORT=3001
DATABASE_URL=postgresql://USER:PASSWORD@localhost:5432/travel_db
JWT_SECRET=your-super-secret-key-change-this-in-production
JWT_EXPIRES_IN=24h
```

**Prioridad:** Bloqueante para portfolio — sin esto, el proyecto no puede ser evaluado por otros.

---

#### 🔴 C1-3: Configurar CORS antes de levantar el frontend

**Problema que resuelve:** Sin CORS configurado, cuando el frontend (corriendo en `localhost:3000`) intente llamar al backend (corriendo en `localhost:3001`), el browser bloqueará la petición con un error CORS. El backend funciona correctamente desde Postman o curl (que no implementan CORS), pero falla en el browser — que es exactamente el cliente real.

**Por qué:** Los browsers implementan Same-Origin Policy por seguridad. Una petición desde `localhost:3000` a `localhost:3001` tiene un origen diferente (diferente puerto = diferente origen). El servidor debe indicar explícitamente qué orígenes puede aceptar.

**Cómo aplicarlo:** Instalar el paquete `cors` y configurarlo en `app.ts`:

```typescript
// Snippet ilustrativo — app.ts con CORS
import cors from 'cors'

app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,     // necesario si se usan cookies
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
}))
```

Y agregar `FRONTEND_URL` al `.env` y al `.env.example`.

**Prioridad:** Bloqueante para el desarrollo del frontend — sin esto, el frontend no puede comunicarse con el backend.

---

#### 🔴 C1-4: Validación de datos de entrada con Zod

**Problema que resuelve:** Sin validación, cualquier dato malformado causa un error 500 genérico. La base de datos puede llenarse con datos inválidos. Un atacante puede intentar crashes enviando inputs inesperados.

**Cómo aplicarlo:** Instalar Zod y crear un middleware de validación reutilizable:

```typescript
// Snippet ilustrativo — middleware validate genérico
import { ZodSchema } from 'zod'
import { Request, Response, NextFunction } from 'express'

export const validate = (schema: ZodSchema) => (req: Request, res: Response, next: NextFunction) => {
  const result = schema.safeParse(req.body)
  if (!result.success) {
    res.status(400).json({ errors: result.error.flatten().fieldErrors })
    return
  }
  req.body = result.data  // datos limpios y tipados
  next()
}
```

```typescript
// Snippet ilustrativo — esquemas para auth
const registerSchema = z.object({
  name:     z.string().min(2, 'Nombre debe tener al menos 2 caracteres'),
  email:    z.string().email('Email inválido'),
  password: z.string().min(8, 'Password debe tener al menos 8 caracteres'),
})
```

**Prioridad:** Bloqueante para seguridad y UX.

---

#### 🔴 C1-5: Restringir la asignación del rol en register

**Problema que resuelve:** Cualquier persona puede crear una cuenta ADMIN enviando `{ "role": "ADMIN" }` en el body del register. Esto comprometería completamente la seguridad del sistema.

**Cómo aplicarlo:** En el controller de register, no tomar el `role` del body. Hardcodearlo siempre como `EMPLOYEE`:

```typescript
// Snippet ilustrativo — register seguro
const { name, email, password } = req.body  // 'role' no se desestructura
// ...
await prisma.user.create({
  data: { name, email, password: hashed, role: 'EMPLOYEE' } // siempre EMPLOYEE
})
```

Para que un ADMIN pueda cambiar el rol de un usuario, se crea un endpoint separado protegido:
`PATCH /users/:id/role` — solo accesible con `authorize('ADMIN')`.

**Prioridad:** Bloqueante de seguridad — esta vulnerabilidad invalida todo el sistema de roles.

---

#### 🔴 C1-6: Corregir la combinación moduleResolution en tsconfig.json

**Problema que resuelve:** La combinación `"moduleResolution": "bundler"` con `"module": "commonjs"` es inconsistente y puede producir errores en la compilación con `tsc` en producción, aunque ts-node la tolere en desarrollo.

**Cómo aplicarlo:** Cambiar a una combinación consistente para Node.js:

```json
// Snippet ilustrativo — tsconfig.json correcto para Node.js
{
  "compilerOptions": {
    "module": "CommonJS",
    "moduleResolution": "Node16",
    "target": "ES2020"
    // ... resto igual
  }
}
```

**Prioridad:** Importante antes del primer `npm run build` para producción.

---

### 4.2 Categoría 2 — Mejoras Importantes

> Estas mejoras deben implementarse **durante las próximas 2-3 fases** del proyecto, antes del deploy final.

---

#### 🟡 C2-1: Rate Limiting en rutas de autenticación

**Problema que resuelve:** Sin rate limiting, un atacante puede enviar miles de peticiones por segundo al endpoint `/auth/login` probando diferentes contraseñas hasta encontrar la correcta (ataque de fuerza bruta). Bcrypt hace que cada intento tarde ~100-400ms, pero con suficientes peticiones paralelas, es viable.

**Por qué es importante:** Es una de las primeras cosas que un pentester o un revisor de seguridad busca. Su ausencia es una señal de que la seguridad no fue considerada.

```typescript
// Snippet ilustrativo — rate limit en auth routes
import rateLimit from 'express-rate-limit'

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 minutos
  max: 10,                     // máximo 10 intentos por IP
  message: { error: 'Too many attempts, try again later' },
  standardHeaders: true,
})

router.post('/login', authLimiter, login)
```

**Prioridad:** Urgente antes del deploy a producción.

---

#### 🟡 C2-2: Middleware de error centralizado

**Problema que resuelve:** El patrón try-catch repetido en cada controller viola DRY, no diferencia tipos de errores, y no logea el error real.

**Cómo aplicarlo:** Crear `src/middlewares/error.middleware.ts` y registrarlo en `app.ts` después de todas las rutas:

```typescript
// Snippet ilustrativo — middleware de error centralizado
import { Request, Response, NextFunction } from 'express'

export const errorHandler = (err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error(`[ERROR] ${req.method} ${req.path}:`, err.message)

  if (err.name === 'PrismaClientKnownRequestError') {
    // Error de Prisma (ej. constraint único violado)
    res.status(409).json({ error: 'Resource conflict' })
    return
  }
  res.status(500).json({ error: 'Internal server error' })
}
```

Con Express v5, los errores de async controllers llegan automáticamente a este middleware sin necesidad de try-catch explícito.

**Prioridad:** Importante para debugging en producción y para no repetir código.

---

#### 🟡 C2-3: Logging de peticiones y errores

**Problema que resuelve:** Sin logs, cuando algo falla en producción, no hay forma de saber qué petición causó el error, quién la hizo, o cuándo ocurrió.

**Implementación en dos capas:**

```typescript
// Snippet ilustrativo — morgan para logs de requests (en app.ts)
import morgan from 'morgan'
app.use(morgan('combined'))  // logs: IP, método, ruta, status, tiempo
```

Para logging de errores internos en producción, el estándar de la industria es `pino` (más rápido) o `winston` (más flexible). Ambos permiten enviar logs a servicios externos como Datadog, Logtail o Papertrail.

**Prioridad:** Importante — imprescindible para debugging en producción.

---

#### 🟡 C2-4: Headers de seguridad con helmet

**Problema que resuelve:** Por defecto, Express no configura ningún header de seguridad HTTP. Esto deja el servidor vulnerable a ataques como:
- **XSS** (Cross-Site Scripting) — sin `Content-Security-Policy`
- **Clickjacking** — sin `X-Frame-Options`
- **MIME sniffing** — sin `X-Content-Type-Options`
- **Information disclosure** — Express envía `X-Powered-By: Express` revelando el stack

**Cómo aplicarlo:**

```typescript
// Snippet ilustrativo — helmet en app.ts (antes de las rutas)
import helmet from 'helmet'
app.use(helmet())  // configura 14 headers de seguridad automáticamente
```

Una línea configura automáticamente los headers de seguridad más importantes.

**Prioridad:** Importante — es una línea de código con alto impacto en seguridad.

---

#### 🟡 C2-5: Capa de Services entre Controllers y Prisma

Ya analizada en la sección 2.5. Recomendación: agregar cuando un controller supere las 80 líneas o cuando se necesite reutilizar lógica entre endpoints.

**Prioridad:** Importante para la escalabilidad a largo plazo — no urgente para el MVP.

---

### 4.3 Categoría 3 — Mejoras Profesionales

> Estas mejoras deben implementarse **antes del deploy final** para que el proyecto sea de calidad de portfolio profesional.

---

#### 🟢 C3-1: Testing con Jest + Supertest

**Problema que resuelve:** Sin tests, no hay forma de saber si un cambio rompió algo. Los tests de integración con Supertest verifican que los endpoints de la API funcionan correctamente de extremo a extremo.

**Por qué para portfolio:** Los reclutadores técnicos y los reviewers de código buscan tests activamente. Un proyecto sin tests señala que el desarrollador no ha trabajado en proyectos de producción real.

```typescript
// Snippet ilustrativo — test de integración para POST /auth/register
import request from 'supertest'
import app from '../src/app'

describe('POST /auth/register', () => {
  it('should create a user and return 201', async () => {
    const res = await request(app)
      .post('/auth/register')
      .send({ name: 'Test', email: 'test@test.com', password: 'password123' })
    expect(res.status).toBe(201)
    expect(res.body.user).not.toHaveProperty('password')
  })
  it('should return 400 if email is invalid', async () => {
    const res = await request(app)
      .post('/auth/register')
      .send({ name: 'Test', email: 'not-an-email', password: 'password123' })
    expect(res.status).toBe(400)
  })
})
```

**Prioridad:** Importante para portfolio — aunque sea coverage básico de los endpoints de auth.

---

#### 🟢 C3-2: Documentación de API con Swagger/OpenAPI

**Problema que resuelve:** Sin documentación de API, alguien que clone el proyecto (o un revisor técnico) no sabe qué endpoints existen, qué parámetros aceptan, qué retornan, o cómo autenticarse.

**Para portfolio:** Una interfaz Swagger en `/api-docs` es una señal inequívoca de profesionalismo. Permite al revisor probar los endpoints directamente desde el browser sin necesidad de Postman.

**Implementación con swagger-ui-express + swagger-jsdoc o con @asteasolutions/zod-to-openapi** (que genera la documentación automáticamente desde los schemas Zod).

**Prioridad:** Nice-to-have para el MVP, muy recomendado antes del deploy final.

---

#### 🟢 C3-3: Refresh Tokens

**Problema que resuelve:** Un JWT de acceso de 24h tiene dos problemas de seguridad:

1. Si el token es comprometido (robado), el atacante tiene acceso durante 24 horas. No hay forma de revocar un JWT sin implementar una blacklist.
2. Si el usuario cambia su contraseña, el token antiguo sigue siendo válido hasta que expire.

**La solución profesional:** Access tokens de 15 minutos + refresh tokens de 7 días almacenados en httpOnly cookie. El access token de corta vida limita la ventana de ataque, y el refresh token puede ser revocado desde la base de datos si se detecta un compromiso.

**Para portfolio:** Implementar refresh tokens es una señal de experiencia con seguridad. Su ausencia es aceptable en un MVP si se documenta el trade-off conscientemente en el README.

**Prioridad:** Nice-to-have para el MVP, importante para el deploy final en producción real.

---

#### 🟢 C3-4: Health Check robusto

**Problema que resuelve:** El `/health` actual solo retorna `{ status: 'ok' }` siempre — incluso si la base de datos está caída. Railway y otras plataformas usan el health check para decidir si reiniciar el servidor. Si el servidor responde `200 ok` pero no puede hacer queries a la base de datos, Railway no sabrá que el servidor está degradado.

**Cómo mejorarlo:**

```typescript
// Snippet ilustrativo — health check con verificación de DB
app.get('/health', async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`  // query mínima para verificar conexión
    res.json({ status: 'ok', db: 'connected' })
  } catch {
    res.status(503).json({ status: 'error', db: 'disconnected' })
  }
})
```

**Prioridad:** Importante antes del deploy en Railway.

---

#### 🟢 C3-5: CI/CD con GitHub Actions

**Problema que resuelve:** Sin CI/CD, es posible hacer push de código que rompe los tests o tiene errores de TypeScript. GitHub Actions permite ejecutar automáticamente el linter, los tests, y la compilación en cada push o pull request.

```yaml
# Snippet ilustrativo — .github/workflows/ci.yml
name: CI
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20' }
      - run: npm ci
      - run: npm run build
      - run: npm test
```

**Para portfolio:** Un badge de "CI passing" en el README es una señal visual inmediata de calidad. Los reclutadores técnicos lo buscan.

**Prioridad:** Nice-to-have para el MVP, muy recomendado antes de publicar el portfolio.

---

#### 🟢 C3-6: Seeds de Base de Datos con Prisma

**Problema que resuelve:** Cuando alguien clone el proyecto y configure la base de datos local, tendrá una base de datos vacía. Si el proyecto requiere datos previos para demostrarse (al menos un usuario ADMIN para poder loguear), la demo falla.

**Cómo aplicarlo:**

```typescript
// Snippet ilustrativo — prisma/seed.ts
import prisma from '../src/config/prisma'
import bcrypt from 'bcryptjs'

async function main() {
  await prisma.user.upsert({
    where: { email: 'admin@empresa.com' },
    update: {},
    create: { name: 'Admin Demo', email: 'admin@empresa.com',
               password: await bcrypt.hash('Admin1234!', 12), role: 'ADMIN' }
  })
}
main().finally(() => prisma.$disconnect())
```

Y en `package.json`:
```json
"prisma": { "seed": "ts-node prisma/seed.ts" }
```

Ejecutar con `npx prisma db seed`.

**Prioridad:** Importante para que la demo del portfolio funcione sin configuración manual.

---

#### 🟢 C3-7: README profesional en ambos repositorios

**Para travel-api:**

```markdown
## Travel & Viáticos Empresariales — API

![CI](badge-url) | [Demo](deploy-url) | [Frontend](frontend-url)

REST API para gestión de viajes y viáticos corporativos.
Stack: Node.js · Express · TypeScript · Prisma · PostgreSQL

### Setup rápido
# 1. Instalar dependencias
npm install
# 2. Configurar variables de entorno
cp .env.example .env  # edita los valores
# 3. Correr migraciones
npx prisma migrate dev
# 4. Cargar datos de ejemplo
npx prisma db seed
# 5. Iniciar servidor de desarrollo
npm run dev
```

**Prioridad:** Bloqueante para portfolio — sin README, el proyecto no puede ser evaluado por un reclutador.

---

## Resumen Ejecutivo

La siguiente tabla consolida todas las recomendaciones de este análisis ordenadas por prioridad y categoría.

| # | Recomendación | Categoría | Prioridad | Estado sugerido |
|---|---|---|---|---|
| C1-1 | Instalar y cargar dotenv explícitamente | Corrección crítica | 🔴 Bloqueante | Implementar hoy |
| C1-2 | Crear archivo `.env.example` | Corrección crítica | 🔴 Bloqueante | Implementar hoy |
| C1-3 | Configurar CORS antes del frontend | Corrección crítica | 🔴 Bloqueante | Implementar hoy |
| C1-4 | Validación de entrada con Zod | Corrección crítica | 🔴 Bloqueante | Implementar en auth |
| C1-5 | Restringir asignación de rol ADMIN | Corrección crítica | 🔴 Bloqueante | Implementar en auth |
| C1-6 | Corregir moduleResolution en tsconfig | Corrección crítica | 🔴 Urgente | Implementar antes del build |
| C2-1 | Rate limiting en `/auth/login` | Mejora importante | 🟡 Urgente pre-deploy | Implementar en Fase 2 |
| C2-2 | Middleware de error centralizado | Mejora importante | 🟡 Importante | Implementar en Fase 2 |
| C2-3 | Logging con Morgan + Pino/Winston | Mejora importante | 🟡 Importante | Implementar en Fase 3 |
| C2-4 | Headers de seguridad con Helmet | Mejora importante | 🟡 Importante | Implementar en Fase 2 |
| C2-5 | Capa de Services entre Controllers y Prisma | Mejora importante | 🟡 Importante | Implementar cuando un controller supere 80 líneas |
| C3-1 | Testing con Jest + Supertest | Mejora profesional | 🟢 Nice-to-have | Antes del deploy final |
| C3-2 | Documentación de API con Swagger | Mejora profesional | 🟢 Nice-to-have | Antes del deploy final |
| C3-3 | Refresh tokens | Mejora profesional | 🟢 Nice-to-have | Opcional para MVP |
| C3-4 | Health check robusto con DB check | Mejora profesional | 🟢 Importante pre-deploy | Antes de Railway |
| C3-5 | CI/CD con GitHub Actions | Mejora profesional | 🟢 Nice-to-have | Antes de publicar portfolio |
| C3-6 | Seeds de base de datos con Prisma | Mejora profesional | 🟢 Importante | Antes de la demo pública |
| C3-7 | README profesional en ambos repos | Mejora profesional | 🔴 Bloqueante para portfolio | Junto con el deploy |

### Valoración general del proyecto

El proyecto tiene una **base arquitectónica sólida**: la decisión de separar frontend y backend, usar Prisma como ORM, TypeScript en ambos lados, y el patrón routes/controllers/middlewares son decisiones profesionales correctas que reflejan experiencia en proyectos reales.

Los principales riesgos actuales son de seguridad (rol auto-asignable, sin rate limiting, sin validación de entrada) y de completitud de implementación (los archivos de auth no existen aún). Corregir las 6 correcciones críticas antes de escribir el código de autenticación transformará el proyecto de "potencialmente vulnerable" a "sólido y seguro".

El objetivo de portfolio es alcanzable y competitivo. Con las correcciones críticas implementadas, un MVP funcional desplegado, y un README profesional, este proyecto puede diferenciarse positivamente en el portfolio de un desarrollador junior con ambiciones de ser tratado como mid-level.

---

*Documento generado como análisis estático del código descrito. No constituye código de producción. Los snippets incluidos son ilustrativos y deben adaptarse al contexto específico del proyecto antes de implementar.*
