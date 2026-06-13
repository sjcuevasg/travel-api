import { Router } from 'express'
import { rateLimit } from 'express-rate-limit'
import { register, login, registerSchema, loginSchema } from '../controllers/auth.controller'
import { validate } from '../middlewares/validate.middleware'

const router = Router()

// Rate limiting independiente para login (mas estricto) y register (menos estricto).
// El objetivo es hacer inviable el ataque de fuerza bruta sin afectar usuarios reales.
const loginLimiter = rateLimit({
  windowMs:       15 * 60 * 1000, // ventana de 15 minutos
  max:            10,              // max 10 intentos por IP en esa ventana
  message:        { error: 'Demasiados intentos de login. Intenta de nuevo en 15 minutos.' },
  standardHeaders: true,           // incluye los headers RateLimit-* en la respuesta
  legacyHeaders:   false,          // no incluye los headers X-RateLimit-* deprecados
})

const registerLimiter = rateLimit({
  windowMs:        60 * 60 * 1000, // ventana de 1 hora
  max:             5,               // max 5 registros por IP por hora
  message:         { error: 'Demasiados registros. Intenta de nuevo en una hora.' },
  standardHeaders: true,
  legacyHeaders:   false,
})

// Cadena de middlewares por ruta:
// 1. Rate limiter  → rechaza si supera el limite
// 2. validate(...)  → valida y limpia el body con Zod (retorna 400 si falla)
// 3. controller    → ejecuta la logica de negocio (recibe body ya limpio)
router.post('/register', registerLimiter, validate(registerSchema), register)
router.post('/login',    loginLimiter,    validate(loginSchema),    login)

export default router
