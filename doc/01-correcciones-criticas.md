# Correcciones Críticas Previas — travel-api

**Fecha:** 7 de junio de 2026  
**Bloque:** Correcciones pre-autenticación  
**Estado:** ✅ Completado

---

## Tabla de Contenidos

1. [Resumen de cambios](#resumen-de-cambios)
2. [Dependencias instaladas](#1-dependencias-instaladas)
3. [tsconfig.json — migración a NodeNext](#2-tsconfigjson--migración-a-nodenext)
4. [package.json — campo main corregido](#3-packagejson--campo-main-corregido)
5. [src/index.ts — dotenv y fail-fast](#4-srcindexts--dotenv-y-fail-fast)
6. [Archivo .env.example](#5-archivo-envexample)
7. [Vulnerabilidades de npm audit](#6-vulnerabilidades-de-npm-audit)
8. [Prisma generate — contexto de ejecución](#7-prisma-generate--contexto-de-ejecución)
9. [Tabla de prioridades](#tabla-de-prioridades)

---

## Resumen de Cambios

Antes de escribir el código de autenticación se realizaron correcciones estructurales que de no hacerse habrían creado bugs silenciosos o problemas de seguridad difíciles de rastrear en producción.

| Archivo | Tipo de cambio |
|---|---|
| `package.json` | 8 dependencias nuevas instaladas + campo `main` corregido |
| `tsconfig.json` | `moduleResolution` migrado de `bundler` (inválido) a `NodeNext` |
| `src/index.ts` | Carga explícita de dotenv + patrón fail-fast para env vars |
| `.env.example` | Archivo nuevo — documenta las variables requeridas para el proyecto |

---

## 1. Dependencias Instaladas

### Dependencias de producción

```bash
npm install dotenv cors bcryptjs jsonwebtoken zod helmet morgan express-rate-limit
```

| Paquete | Versión instalada | Para qué sirve |
|---|---|---|
| `dotenv` | ^17 | Carga variables del archivo `.env` a `process.env` |
| `cors` | ^2 | Habilita Cross-Origin Resource Sharing para el frontend |
| `bcryptjs` | ^3 | Hasheo seguro de contraseñas (pure JS, sin dependencias nativas) |
| `jsonwebtoken` | ^9 | Generación y verificación de JSON Web Tokens |
| `zod` | ^4 | Validación de esquemas con generación automática de tipos TypeScript |
| `helmet` | ^8 | Configura 14 headers de seguridad HTTP en una línea |
| `morgan` | ^1 | Logger de requests HTTP para desarrollo |
| `express-rate-limit` | ^8 | Rate limiting para prevenir ataques de fuerza bruta |

### Dependencias de desarrollo (tipos TypeScript)

```bash
npm install -D @types/cors @types/bcryptjs @types/jsonwebtoken @types/morgan
```

> **Nota:** `zod`, `dotenv`, `helmet` y `express-rate-limit` incluyen sus propios tipos — no necesitan el paquete `@types/...` separado.

### ¿Por qué estas dependencias antes de la autenticación?

Sin estas dependencias el código de autenticación no puede existir. Instalarlas primero, antes de crear los archivos, evita errores de importación inmediatos y permite que `tsc --noEmit` valide los tipos correctamente desde el primer momento.

---

## 2. tsconfig.json — Migración a NodeNext

### Problema detectado

🔴 **Prioridad: Bloqueante antes del build de producción**

La configuración anterior combinaba:
```json
"module": "commonjs",
"moduleResolution": "bundler"
```

Esta combinación es **inválida en TypeScript 5+**. `moduleResolution: "bundler"` está diseñado para bundlers (Vite, Webpack) con módulos ESM, **no** para proyectos Node.js CommonJS. TypeScript 6 lo marcó como deprecated y TypeScript 7 lo eliminará.

El error del compilador al intentar usar `"node"` (el alias de `node10`) fue:

```
Option 'moduleResolution=node10' is deprecated and will stop functioning in TypeScript 7.0.
```

### Solución aplicada

```json
// ANTES
"module": "commonjs",
"moduleResolution": "bundler"

// DESPUÉS
"module": "NodeNext",
"moduleResolution": "NodeNext"
```

### ¿Por qué `NodeNext` y no otra opción?

| Opción | Estado | Para usar cuando... |
|---|---|---|
| `node` / `node10` | ⚠️ Deprecated en TS6, eliminado en TS7 | Proyectos legacy que no pueden migrar |
| `node16` | ✅ Válido | Proyectos Node.js 16+ con CJS o ESM |
| `NodeNext` | ✅ Recomendado TS6+ | La opción moderna — se adapta automáticamente a CJS o ESM según `package.json` |
| `bundler` | ⚠️ Solo con `module: esnext` | Proyectos con Vite, Webpack, etc. |

**Clave:** Con `"type": "commonjs"` en `package.json`, TypeScript interpreta todos los `.ts` como módulos CommonJS. Esto significa que los imports relativos (`import foo from './bar'`) **no necesitan la extensión `.js`** — igual que antes.

### Configuración de ts-node

Se agregó una sección `"ts-node"` al `tsconfig.json` para ser explícitos:

```json
"ts-node": {
  "esm": false,
  "transpileOnly": false
}
```

Esto le dice a ts-node que NO use modo ESM aunque el module setting sea NodeNext, respetando el `"type": "commonjs"` del `package.json`.

---

## 3. package.json — Campo main Corregido

### Problema detectado

🟡 **Prioridad: Importante antes del deploy**

```json
// ANTES — incorrecto
"main": "index.js"

// DESPUÉS — correcto
"main": "dist/index.js"
```

### ¿Por qué importa?

El campo `main` en `package.json` indica el punto de entrada del módulo en producción. El código fuente real está en `src/index.ts`, que el script `npm run build` compila a `dist/index.js`. Cuando Railway u otra plataforma ejecuta `npm start` (`node dist/index.js`), el campo `main` debe apuntar al archivo compilado — no al TypeScript fuente.

Aunque en este proyecto el backend no es importado como librería por otros paquetes, la convención correcta evita confusión y es la práctica estándar en todos los proyectos Node.js con TypeScript.

---

## 4. src/index.ts — dotenv y Fail-Fast

### Problema detectado

🔴 **Prioridad: Bloqueante de seguridad**

El `index.ts` original no cargaba variables de entorno. Esto significaba que `process.env.JWT_SECRET`, `process.env.PORT` y `process.env.DATABASE_URL` eran `undefined` cuando el servidor arrancaba.

El resultado silencioso: `jwt.sign()` firmaba tokens con la cadena literal `"undefined"` como secret. Cualquier atacante que descubriera esta vulnerabilidad podría fabricar JWTs válidos para el sistema.

### Solución aplicada

```typescript
// src/index.ts — primera línea del archivo
import 'dotenv/config'   // 1. Carga el .env ANTES que cualquier otro módulo
import app from './app'  // 2. app.ts se evalúa con process.env ya poblado

// Patrón fail-fast: si falta una variable crítica el servidor NO arranca
const requiredEnv = ['DATABASE_URL', 'JWT_SECRET', 'JWT_EXPIRES_IN'] as const

for (const key of requiredEnv) {
  if (!process.env[key]) {
    throw new Error(`[startup] Variable de entorno requerida no encontrada: ${key}`)
  }
}
```

### ¿Por qué `import 'dotenv/config'` debe ser la primera línea?

En CommonJS compilado, los `import` se convierten en `require()` y se ejecutan **en el orden en que aparecen** en el archivo fuente. Si `import 'dotenv/config'` está antes de `import app from './app'`, en el JavaScript compilado `require('dotenv/config')` ejecuta antes de `require('./app')`. Esto garantiza que `process.env` esté completamente poblado cuando `app.ts` se evalúa.

### ¿Qué es el patrón fail-fast?

Es el principio de que un sistema debe **fallar inmediatamente y con un error claro** cuando detecta una condición que lo haría funcionar incorrectamente. En vez de arrancar el servidor con `JWT_SECRET = undefined` y descubrir el problema en el primer login de producción, el servidor se niega a arrancar con un mensaje explicativo. Esto hace que el error sea evidente en el deploy en lugar de en el uso real.

---

## 5. Archivo .env.example

### Problema detectado

🔴 **Prioridad: Bloqueante para portfolio**

Sin `.env.example`, alguien que clone el repositorio (un reclutador técnico, un compañero de equipo) no sabrá qué variables de entorno configurar. El proyecto no arrancará y la persona se rendirá.

### Archivo creado: `.env.example`

```bash
PORT=3001
DATABASE_URL=postgresql://USER:PASSWORD@localhost:5432/travel_db
JWT_SECRET=your-super-secret-key-at-least-32-characters-change-this
JWT_EXPIRES_IN=24h
FRONTEND_URL=http://localhost:3000
```

### Regla de oro

- `.env` → **jamás a GitHub** (contiene credenciales reales, está en `.gitignore`)  
- `.env.example` → **siempre a GitHub** (solo muestra la estructura, sin valores reales)

### ⚠️ Acción requerida por el desarrollador

Debes crear tu archivo `.env` local con los valores reales:

```bash
# Copia el ejemplo
cp .env.example .env

# Luego edita .env con tus valores reales:
# - DATABASE_URL: tu conexión a PostgreSQL local
# - JWT_SECRET: una cadena larga y aleatoria (mínimo 32 caracteres)
# - JWT_EXPIRES_IN: "24h" está bien para desarrollo
# - FRONTEND_URL: "http://localhost:3000" para desarrollo local
```

---

## 6. Vulnerabilidades de npm audit

Al instalar las dependencias, `npm audit` reportó 7 vulnerabilidades. Se ejecutó `npm audit fix` para las reparables:

| Vulnerabilidad | Paquete afectado | Solución | Estado |
|---|---|---|---|
| DoS en brace-expansion | `brace-expansion` | `npm audit fix` | ✅ Reparado |
| Path traversal en fast-uri | `fast-uri` | `npm audit fix` | ✅ Reparado |
| HTML injection en hono (JSX) | `hono` | `npm audit fix` | ✅ Reparado |
| DoS en qs | `qs` | `npm audit fix` | ✅ Reparado |
| Middleware bypass en @hono/node-server | `@prisma/dev` (interno) | Requiere bajar a Prisma 6 | ⚠️ Pendiente |

### ¿Por qué se deja la vulnerabilidad de Prisma?

El paquete `@hono/node-server` es una dependencia **interna** de `@prisma/dev`, que a su vez es una dependencia **interna** de la CLI de Prisma. No es código que el proyecto usa directamente — es tooling de Prisma. El "fix" disponible (`npm audit fix --force`) bajaría Prisma de v7 a v6, lo cual es un breaking change que invalidaría toda la configuración de Prisma 7. Se acepta este riesgo residual y se documenta.

---

## 7. Prisma generate — Contexto de Ejecución

### Situación encontrada

Al intentar `npx prisma generate`, Prisma 7 falló porque su archivo de configuración (`prisma.config.ts`) necesita la variable `DATABASE_URL` para evaluar el config en tiempo de carga:

```
PrismaConfigEnvError: Cannot resolve environment variable: DATABASE_URL.
```

Esto ocurrió porque el `.env` no existía aún en la máquina.

### Solución aplicada

Se ejecutó `prisma generate` con la variable inline, sin necesitar el `.env`:

```bash
DATABASE_URL="postgresql://postgres:placeholder@localhost:5432/travel_db" npx prisma generate
```

> `prisma generate` **no se conecta a la base de datos**. Solo lee el `schema.prisma` y genera código TypeScript. La URL solo es necesaria para satisfacer el sistema de config de Prisma 7.

### Resultado

El cliente se regeneró en `node_modules/@prisma/client` (comportamiento correcto para este proyecto). La importación `import { PrismaClient } from '@prisma/client'` en `src/config/prisma.ts` es válida.

### Verificación final de TypeScript

```bash
npx tsc --noEmit
# Sin output = sin errores ✅
```

---

## Tabla de Prioridades

| # | Corrección | Severidad | Prioridad | Estado |
|---|---|---|---|---|
| 1 | Instalar dotenv y cargarlo explícitamente | 🔴 Bloqueante de seguridad | Inmediata | ✅ |
| 2 | Crear `.env.example` | 🔴 Bloqueante para portfolio | Inmediata | ✅ |
| 3 | Corregir `moduleResolution` en tsconfig | 🔴 Bloqueante en producción | Inmediata | ✅ |
| 4 | Corregir campo `main` en package.json | 🟡 Importante pre-deploy | Alta | ✅ |
| 5 | Instalar dependencias de auth y seguridad | 🔴 Bloqueante funcional | Inmediata | ✅ |
| 6 | Reparar vulnerabilidades con `npm audit fix` | 🟡 Importante | Alta | ✅ |
| 7 | Vulnerabilidad residual en `@prisma/dev` | 🟡 Aceptada con documentación | Media | ⚠️ Documentada |
| 8 | Regenerar cliente Prisma 7 | 🔴 Bloqueante funcional | Inmediata | ✅ |

---

*Este documento es la memoria técnica del bloque de correcciones previas. El siguiente paso es el Módulo de Autenticación — ver `doc/02-modulo-autenticacion.md`.*
