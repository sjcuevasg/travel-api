// dotenv DEBE ser la primera importacion del archivo.
// En CommonJS compilado, los require() se ejecutan en orden de aparicion.
// Al ponerlo primero garantizamos que las variables del .env esten disponibles
// cuando se evaluen los demas modulos (incluido app.ts que usa process.env).
import 'dotenv/config'
import app from './app'

// Patron fail-fast: si falta una variable critica el servidor NO arranca.
// Es preferible un error explicito al inicio que un comportamiento impredecible
// en produccion (ej. JWT_SECRET undefined hace que jwt.sign firme con "undefined").
const requiredEnv = ['DATABASE_URL', 'JWT_SECRET', 'JWT_EXPIRES_IN'] as const

for (const key of requiredEnv) {
  if (!process.env[key]) {
    throw new Error(`[startup] Variable de entorno requerida no encontrada: ${key}`)
  }
}

const PORT = process.env.PORT || 3001

app.listen(PORT, () => {
  console.log(`[server] Corriendo en el puerto ${PORT} — entorno: ${process.env.NODE_ENV ?? 'development'}`)
})
