import { type ErrorRequestHandler } from 'express'

// Middleware de error centralizado. Express lo reconoce como error handler
// porque tiene exactamente 4 parametros (err, req, res, next).
// Debe registrarse DESPUES de todas las rutas en app.ts con app.use(errorHandler).
// En Express 5 los errores de funciones async llegan aqui automaticamente.
export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  const message = err instanceof Error ? err.message : String(err)
  console.error(`[ERROR] ${req.method} ${req.path} →`, message)

  // Error de Prisma: violacion de constraint UNIQUE (ej. email duplicado).
  // Prisma asigna el codigo 'P2002' a este tipo de error.
  if (err?.code === 'P2002') {
    res.status(409).json({ error: 'El recurso ya existe' })
    return
  }

  res.status(500).json({ error: 'Error interno del servidor' })
}
