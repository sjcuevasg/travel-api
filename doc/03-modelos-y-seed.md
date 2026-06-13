# Doc 03 — Modelos Prisma, Migración SQLite y Seed

## Prioridad de los hallazgos

| # | Hallazgo | Prioridad |
|---|----------|-----------|
| 1 | PostgreSQL no disponible localmente → migración a SQLite | **CRÍTICA** (bloqueante) |
| 2 | Prisma 7 rompe `url` en `schema.prisma` → requiere adapter LibSQL | **CRÍTICA** (bloqueante) |
| 3 | `PrismaLibSql` toma opciones directas, no cliente externo | **ALTA** (error de API) |
| 4 | Seed necesita `dotenv/config` en `prisma.ts`, no solo en `seed.ts` | **ALTA** (orden de módulos) |
| 5 | `tsconfig.json` faltaba `"types": ["node"]` | **MEDIA** (errores en seed) |

---

## 1 · Cambio de proveedor: PostgreSQL → SQLite

### Problema

No había PostgreSQL disponible en la máquina de desarrollo (sin servicio, sin psql, Docker ausente). El proveedor original del schema era `postgresql`, y `prisma migrate dev` fallaba con `P1001: Can't reach database server at localhost:5432`.

### Solución

Cambiar el proveedor a `sqlite` para desarrollo local. En producción (Railway) se usará PostgreSQL — solo se cambia `DATABASE_URL` y el provider en el schema.

```diff
// prisma/schema.prisma
datasource db {
-  provider = "postgresql"
+  provider = "sqlite"
}
```

```diff
// .env
-  DATABASE_URL="postgresql://postgres:@localhost:5432/travel_db"
+  DATABASE_URL="file:./prisma/dev.db"
```

El archivo `dev.db` es un único archivo binario SQLite local. **No requiere servidor, no requiere instalación adicional.**

### Migración regenerada

La migración PostgreSQL anterior fue eliminada y se generó una nueva para SQLite:

```
prisma/migrations/20260607201116_init/migration.sql
```

---

## 2 · Ruptura de Prisma 7: `url` ya no va en `schema.prisma`

### Problema

Prisma 7 eliminó por completo el campo `url` del bloque `datasource` en `schema.prisma`. Al intentar agregarlo, Prisma lanzaba:

```
Error code: P1012
error: The datasource property `url` is no longer supported in schema files.
```

### Arquitectura de Prisma 7

| Componente | Responsabilidad |
|------------|----------------|
| `prisma.config.ts` | URL para la CLI (migraciones, generate) |
| `src/config/prisma.ts` | URL para el cliente en runtime (via adapter) |
| `schema.prisma` datasource | Solo `provider`, sin `url` |

```typescript
// prisma.config.ts — para la CLI
export default defineConfig({
  datasource: { url: env("DATABASE_URL") },  // solo para migrate/generate
})
```

```typescript
// src/config/prisma.ts — para el cliente runtime
const adapter = new PrismaLibSql({ url: process.env.DATABASE_URL })
const prisma  = new PrismaClient({ adapter })
```

---

## 3 · Adapter LibSQL para Prisma 7 + SQLite

### Paquetes instalados

```bash
npm install @prisma/adapter-libsql @libsql/client
```

### API correcta de `PrismaLibSql`

`PrismaLibSql` recibe un objeto de configuración, **no** un cliente libsql externo:

```typescript
// ❌ INCORRECTO (API antigua de otras versiones)
const libsql  = createClient({ url })
const adapter = new PrismaLibSql(libsql)

// ✅ CORRECTO para @prisma/adapter-libsql actual
const adapter = new PrismaLibSql({ url, authToken? })
```

El `authToken` solo se necesita para Turso cloud; para SQLite local es opcional.

---

## 4 · Configuración final de `src/config/prisma.ts`

```typescript
import 'dotenv/config'                          // garantiza DATABASE_URL antes de todo
import { PrismaLibSql } from '@prisma/adapter-libsql'
import { PrismaClient } from '@prisma/client'

const url = process.env.DATABASE_URL
if (!url) throw new Error('[prisma] DATABASE_URL is not set — check your .env file')

const adapter = new PrismaLibSql({ url })
const prisma  = new PrismaClient({ adapter })

export default prisma
```

**Por qué `import 'dotenv/config'` aquí y no solo en `seed.ts` o `index.ts`:**

En CommonJS, las importaciones se resuelven en el orden en que aparecen en el archivo compilado. `prisma.ts` crea el adapter al inicializarse el módulo (código de nivel superior), por lo que `DATABASE_URL` debe estar disponible *en el momento en que este módulo se carga*. Poner dotenv en el mismo archivo garantiza esto independientemente de quién importe a `prisma.ts`.

---

## 5 · Corrección de tsconfig: `"types": ["node"]`

### Problema

El seed fallaba al compilar con ts-node fuera de `src/`:

```
error TS2584: Cannot find name 'console'. Do you need to change your target library?
error TS2591: Cannot find name 'process'. Do you need to install type definitions for node?
```

### Causa

`@types/node` estaba instalado (v25.5.2) pero no declarado explícitamente en `compilerOptions.types`. Sin `types`, TypeScript debería auto-incluirlos, pero al compilar archivos fuera del `include` glob (`src/**/*`), el comportamiento puede variar.

### Solución

```diff
// tsconfig.json
"lib": ["ES2020"],
+ "types": ["node"],
```

Esto dice explícitamente: "incluye los tipos globales de Node.js (`process`, `console`, `Buffer`, etc.)".

---

## 6 · Seed (`prisma/seed.ts`)

### Datos creados

| Entidad | Cantidad | Detalle |
|---------|----------|---------|
| Usuarios | 3 | ADMIN, MANAGER, EMPLOYEE |
| Viajes | 2 | Lima (APPROVED) y Bogotá (PENDING) |
| Gastos | 4 | TRANSPORT x2, ACCOMMODATION, FOOD |
| Actividades | 4 | Registro, Keynote, Workshop, Presentación |

### Credenciales de demo

```
ADMIN    → admin@empresa.com    / Admin1234!
MANAGER  → manager@empresa.com  / Manager1234!
EMPLOYEE → empleado@empresa.com / Empleado1234!
```

### Idempotencia

- Usuarios: `upsert` con `where: { email }`. Correr el seed N veces no duplica usuarios.
- Viajes: verificación previa con `count()`. Si ya existen, no se crean nuevos.

### Ejecutar

```bash
npx ts-node --transpile-only prisma/seed.ts
# o
npx prisma db seed
```
