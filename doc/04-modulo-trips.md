# Doc 04 — Módulo de Viajes (Trips)

## Archivos creados

| Archivo | Rol |
|---------|-----|
| `src/controllers/trips.controller.ts` | Lógica de negocio + schemas Zod |
| `src/routes/trips.routes.ts` | Definición de rutas con autorización por rol |

---

## Endpoints

| Método | Ruta | Roles permitidos | Descripción |
|--------|------|-----------------|-------------|
| `GET` | `/trips` | ADMIN, MANAGER, EMPLOYEE | Lista viajes (MANAGER ve solo los suyos) |
| `GET` | `/trips/:id` | Todos | Detalle con gastos y actividades incluidos |
| `POST` | `/trips` | ADMIN, MANAGER | Crear viaje nuevo |
| `PATCH` | `/trips/:id` | ADMIN, MANAGER | Actualizar campos del viaje |
| `PATCH` | `/trips/:id/status` | ADMIN, MANAGER | Cambiar estado del ciclo de vida |
| `DELETE` | `/trips/:id` | ADMIN | Eliminar viaje (cascada a gastos y actividades) |

---

## Ciclo de vida del estado

```
PENDING → APPROVED → IN_PROGRESS → COMPLETED
                  ↘
                CANCELLED
```

El `updateTripStatus` acepta cualquier transición — la validación de flujo avanzada (por ejemplo, no ir de COMPLETED a PENDING) puede agregarse en una iteración futura si se requiere.

---

## Lógica de visibilidad por rol

```typescript
// GET /trips
const where = role === 'MANAGER' ? { managerId: userId } : {}
```

- **ADMIN**: ve todos los viajes
- **MANAGER**: ve solo los viajes donde él es el `managerId`
- **EMPLOYEE**: ve todos los viajes (solo lectura)

---

## Validación con Zod

```typescript
export const createTripSchema = z.object({
  title:       z.string().min(3),
  destination: z.string().min(2),
  startDate:   z.string().datetime(),
  endDate:     z.string().datetime(),
  description: z.string().optional(),
  budget:      z.number().positive().optional(),
})
```

Regla adicional de negocio en el controller:

```typescript
if (new Date(startDate) >= new Date(endDate)) {
  res.status(400).json({ error: 'La fecha de inicio debe ser anterior a la de fin' })
  return
}
```

---

## Protección de propiedad (MANAGER)

Un MANAGER solo puede editar/actualizar viajes que él gestiona:

```typescript
if (req.user!.role === 'MANAGER' && existing.managerId !== req.user!.id) {
  res.status(403).json({ error: 'Solo puedes editar los viajes que gestionas' })
  return
}
```

---

## `tripSelect` — campo compartido

En lugar de repetir qué campos retornar en cada query, se definió un objeto constante:

```typescript
const tripSelect = {
  id: true, title: true, destination: true, startDate: true, endDate: true,
  status: true, description: true, budget: true, createdAt: true, updatedAt: true,
  manager: { select: { id: true, name: true, email: true, role: true } },
} as const
```

Esto garantiza que todas las respuestas de trips tienen la misma forma.

---

## Fix de TypeScript: `req.params` en Express 5

`@types/express` v5 define `req.params` con valores `string | string[]`. Al usar esos valores en un `where` de Prisma (que espera `string`), TypeScript lanzaba 19 errores.

```typescript
// ❌ Error TS2322: Type 'string | string[]' is not assignable to type 'string'
const { id } = req.params

// ✅ Correcto: aserción explícita
const id = req.params['id'] as string
```

Este patrón se aplicó en todos los controllers donde se usa un parámetro de ruta.

---

## Eliminación en cascada

Cuando se elimina un viaje, Prisma elimina automáticamente sus gastos y actividades relacionados gracias a `onDelete: Cascade` en el schema:

```prisma
expenses   Expense[]  @relation("TripExpenses",   ...)  // onDelete: Cascade
activities Activity[] @relation("TripActivities", ...)  // onDelete: Cascade
```

No se necesita código adicional en el controller.
