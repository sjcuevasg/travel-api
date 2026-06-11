# Doc 05 — Módulos de Gastos, Actividades y Usuarios

## Archivos creados

| Archivo | Rol |
|---------|-----|
| `src/controllers/expenses.controller.ts` | Gastos + schemas Zod |
| `src/controllers/activities.controller.ts` | Actividades + schemas Zod |
| `src/controllers/users.controller.ts` | Gestión de usuarios + schema Zod |
| `src/routes/expenses.routes.ts` | Rutas de gastos |
| `src/routes/activities.routes.ts` | Rutas de actividades |
| `src/routes/users.routes.ts` | Rutas de usuarios |

---

## Módulo: Gastos (`/expenses`)

### Endpoints

| Método | Ruta | Roles | Descripción |
|--------|------|-------|-------------|
| `GET` | `/expenses?tripId=` | Todos | Lista gastos, opcionalmente filtrados por viaje |
| `GET` | `/expenses/:id` | Todos | Detalle de un gasto |
| `POST` | `/expenses` | ADMIN, MANAGER | Registrar nuevo gasto |
| `PATCH` | `/expenses/:id` | ADMIN, MANAGER | Actualizar gasto |
| `DELETE` | `/expenses/:id` | ADMIN, MANAGER | Eliminar gasto |

### Respuesta de `GET /expenses`

```json
{
  "expenses": [...],
  "total": 1670.00
}
```

El campo `total` suma el `amount` de todos los gastos en el resultado. Útil para dashboards y reportes sin necesitar una segunda llamada.

### Schema Zod

```typescript
export const createExpenseSchema = z.object({
  title:       z.string().min(2),
  amount:      z.number().positive(),
  category:    z.enum(['TRANSPORT','ACCOMMODATION','FOOD','ENTERTAINMENT','OFFICE','OTHER']).optional(),
  date:        z.string().datetime(),
  description: z.string().optional(),
  receipt:     z.string().url().optional(),   // URL del comprobante
  tripId:      z.string().uuid(),
})
```

Si no se envía `category`, el sistema asigna `OTHER` como valor predeterminado.

---

## Módulo: Actividades (`/activities`)

### Endpoints

| Método | Ruta | Roles | Descripción |
|--------|------|-------|-------------|
| `GET` | `/activities?tripId=` | Todos | Lista actividades, filtro opcional por viaje |
| `GET` | `/activities/:id` | Todos | Detalle de actividad con info del viaje |
| `POST` | `/activities` | ADMIN, MANAGER | Crear actividad |
| `PATCH` | `/activities/:id` | ADMIN, MANAGER | Actualizar actividad |
| `DELETE` | `/activities/:id` | ADMIN, MANAGER | Eliminar actividad |

### Schema Zod

```typescript
export const createActivitySchema = z.object({
  title:       z.string().min(2),
  description: z.string().optional(),
  date:        z.string().datetime(),
  location:    z.string().optional(),
  duration:    z.number().int().positive().optional(),  // minutos
  tripId:      z.string().uuid(),
})
```

El campo `duration` representa minutos (entero positivo). Permite calcular tiempo total de actividades por viaje.

### Ordenamiento

Las actividades se retornan ordenadas cronológicamente (`orderBy: { date: 'asc' }`), lo que facilita mostrar el itinerario del viaje en el frontend.

---

## Módulo: Usuarios (`/users`)

### Endpoints

| Método | Ruta | Roles | Descripción |
|--------|------|-------|-------------|
| `GET` | `/users` | ADMIN | Lista todos los usuarios |
| `PATCH` | `/users/:id/role` | ADMIN | Cambiar rol de un usuario |

**Principio de mínimo privilegio:** La gestión de roles es exclusiva del ADMIN. Ningún usuario puede auto-asignarse un rol.

### Protección de auto-degradación

```typescript
// Un ADMIN no puede quitarse su propio rol
if (id === req.user!.id && role !== 'ADMIN') {
  res.status(400).json({ error: 'No puedes cambiar tu propio rol de ADMIN' })
  return
}
```

Esto previene que el único ADMIN del sistema quede bloqueado por error.

---

## Patrón compartido: filtro por `tripId` en query string

`GET /expenses?tripId=<uuid>` y `GET /activities?tripId=<uuid>` usan el mismo patrón:

```typescript
const { tripId } = req.query
const where = tripId ? { tripId: String(tripId) } : {}

const results = await prisma.model.findMany({ where })
```

`String(tripId)` convierte el valor del query param (que puede ser `string | string[]`) a un `string` seguro.

---

## Patrón compartido: actualización parcial

El update de gastos y actividades permite actualizar solo los campos enviados. Para manejar la conversión de fechas:

```typescript
const updateData: Record<string, unknown> = { ...data }
if (data.date) updateData['date'] = new Date(data.date)

await prisma.model.update({ where: { id }, data: updateData })
```

`updateData` es `Record<string, unknown>` para permitir la mezcla dinámica de campos sin conflictos de tipos con Prisma.

---

## Verificación de existencia previa en updates/deletes

Todos los endpoints de actualización y eliminación verifican que el recurso existe antes de operar:

```typescript
const existing = await prisma.expense.findUnique({ where: { id } })
if (!existing) {
  res.status(404).json({ error: 'Gasto no encontrado' })
  return
}
```

Esto da un 404 claro en lugar de un error genérico de Prisma, mejorando la experiencia del consumidor de la API.

---

## Estado final del backend: pruebas realizadas

```
✅ GET  /health              → { status: 'ok', db: 'connected' }
✅ POST /auth/login          → JWT token + datos de usuario
✅ POST /auth/register       → crea usuario con rol EMPLOYEE
✅ POST /auth/login (wrong)  → 'Credenciales inválidas' (mensaje genérico)
✅ GET  /trips (sin token)   → 401 'Token no proporcionado'
✅ GET  /trips (ADMIN)       → 2 viajes con manager incluido
✅ GET  /users (ADMIN)       → 3 usuarios
✅ GET  /expenses            → 4 gastos, total: 1670
✅ GET  /activities          → 4 actividades ordenadas por fecha
```
