import { type Request, type Response } from 'express'
import { z } from 'zod'
import prisma from '../config/prisma'

// ─── SCHEMAS ──────────────────────────────────────────────────────────────────

const CATEGORIES = ['TRANSPORT', 'ACCOMMODATION', 'FOOD', 'ENTERTAINMENT', 'OFFICE', 'OTHER'] as const

export const createExpenseSchema = z.object({
  title:       z.string().min(2, 'El título debe tener al menos 2 caracteres'),
  amount:      z.number().positive('El monto debe ser mayor a 0'),
  category:    z.enum(CATEGORIES).optional(),
  date:        z.string().datetime('Fecha inválida'),
  description: z.string().optional(),
  receipt:     z.string().url('URL del comprobante inválida').optional(),
  tripId:      z.string().uuid('ID de viaje inválido'),
})

export const updateExpenseSchema = createExpenseSchema.omit({ tripId: true }).partial()

// ─── HANDLERS ─────────────────────────────────────────────────────────────────

// GET /expenses?tripId=xxx
export const getExpenses = async (req: Request, res: Response): Promise<void> => {
  try {
    const { tripId } = req.query

    const where = tripId ? { tripId: String(tripId) } : {}

    const expenses = await prisma.expense.findMany({
      where,
      orderBy: { date: 'desc' },
      include: {
        createdBy: { select: { id: true, name: true } },
      },
    })

    // Suma total útil para mostrar en el dashboard
    const total = expenses.reduce((sum, e) => sum + e.amount, 0)

    res.json({ expenses, total })
  } catch (error) {
    console.error('[expenses] getExpenses:', error)
    res.status(500).json({ error: 'Error interno del servidor' })
  }
}

// GET /expenses/:id
export const getExpenseById = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = req.params['id'] as string

    const expense = await prisma.expense.findUnique({
      where:   { id },
      include: { createdBy: { select: { id: true, name: true } } },
    })

    if (!expense) {
      res.status(404).json({ error: 'Gasto no encontrado' })
      return
    }

    res.json({ expense })
  } catch (error) {
    console.error('[expenses] getExpenseById:', error)
    res.status(500).json({ error: 'Error interno del servidor' })
  }
}

// POST /expenses — solo ADMIN y MANAGER
export const createExpense = async (req: Request, res: Response): Promise<void> => {
  try {
    const { title, amount, category, date, description, receipt, tripId } =
      req.body as z.infer<typeof createExpenseSchema>

    // Verificar que el viaje existe antes de crear el gasto
    const trip = await prisma.trip.findUnique({ where: { id: tripId } })
    if (!trip) {
      res.status(404).json({ error: 'El viaje especificado no existe' })
      return
    }

    const expense = await prisma.expense.create({
      data: {
        title,
        amount,
        category:    category ?? 'OTHER',
        date:        new Date(date),
        description,
        receipt,
        tripId,
        createdById: req.user!.id,
      },
      include: { createdBy: { select: { id: true, name: true } } },
    })

    res.status(201).json({ message: 'Gasto registrado exitosamente', expense })
  } catch (error) {
    console.error('[expenses] createExpense:', error)
    res.status(500).json({ error: 'Error interno del servidor' })
  }
}

// PATCH /expenses/:id
export const updateExpense = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = req.params['id'] as string
    const data    = req.body as z.infer<typeof updateExpenseSchema>

    const existing = await prisma.expense.findUnique({ where: { id } })
    if (!existing) {
      res.status(404).json({ error: 'Gasto no encontrado' })
      return
    }

    const updateData: Record<string, unknown> = { ...data }
    if (data.date) updateData['date'] = new Date(data.date)

    const expense = await prisma.expense.update({
      where:   { id },
      data:    updateData,
      include: { createdBy: { select: { id: true, name: true } } },
    })

    res.json({ message: 'Gasto actualizado', expense })
  } catch (error) {
    console.error('[expenses] updateExpense:', error)
    res.status(500).json({ error: 'Error interno del servidor' })
  }
}

// DELETE /expenses/:id
export const deleteExpense = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = req.params['id'] as string

    const existing = await prisma.expense.findUnique({ where: { id } })
    if (!existing) {
      res.status(404).json({ error: 'Gasto no encontrado' })
      return
    }

    await prisma.expense.delete({ where: { id } })

    res.json({ message: 'Gasto eliminado exitosamente' })
  } catch (error) {
    console.error('[expenses] deleteExpense:', error)
    res.status(500).json({ error: 'Error interno del servidor' })
  }
}
