import express, { type Application } from 'express'
import cors from 'cors'
import helmet from 'helmet'
import morgan from 'morgan'
import authRoutes       from './routes/auth.routes'
import tripsRoutes      from './routes/trips.routes'
import expensesRoutes   from './routes/expenses.routes'
import activitiesRoutes from './routes/activities.routes'
import usersRoutes      from './routes/users.routes'
import { authenticate } from './middlewares/auth.middleware'
import { errorHandler } from './middlewares/error.middleware'
import prisma           from './config/prisma'

const app: Application = express()

// ─── MIDDLEWARES GLOBALES ─────────────────────────────────────────────────────
app.use(helmet())
app.use(cors({
  origin:      process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
  methods:     ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
}))
app.use(morgan('dev'))
app.use(express.json())

// ─── RUTAS PÚBLICAS (sin autenticación) ──────────────────────────────────────
app.use('/auth', authRoutes)

// ─── RUTAS PROTEGIDAS (requieren JWT válido) ──────────────────────────────────
// authenticate se aplica aquí una sola vez y protege todos los módulos debajo.
// Dentro de cada router se aplica authorize() para el control por rol.
app.use('/trips',      authenticate, tripsRoutes)
app.use('/expenses',   authenticate, expensesRoutes)
app.use('/activities', authenticate, activitiesRoutes)
app.use('/users',      authenticate, usersRoutes)

// ─── HEALTH CHECK ─────────────────────────────────────────────────────────────
app.get('/health', async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`
    res.json({ status: 'ok', db: 'connected', message: 'travel-api running' })
  } catch {
    res.status(503).json({ status: 'error', db: 'disconnected' })
  }
})

// ─── ERROR HANDLER (siempre al final) ─────────────────────────────────────────
app.use(errorHandler)

export default app
