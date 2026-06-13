import { type Request, type Response } from 'express'
import { z } from 'zod'
import prisma from '../config/prisma'

// ─── SCHEMAS ──────────────────────────────────────────────────────────────────

export const createActivitySchema = z.object({
  title:       z.string().min(2, 'El título debe tener al menos 2 caracteres'),
  description: z.string().optional(),
  date:        z.string().datetime('Fecha inválida'),
  location:    z.string().optional(),
  duration:    z.number().int().positive('La duración debe ser un número entero positivo (minutos)').optional(),
  tripId:      z.string().uuid('ID de viaje inválido'),
})

export const updateActivitySchema = createActivitySchema.omit({ tripId: true }).partial()

// ─── HANDLERS ─────────────────────────────────────────────────────────────────

// GET /activities?tripId=xxx
export const getActivities = async (req: Request, res: Response): Promise<void> => {
  try {
    const { tripId } = req.query

    const where = tripId ? { tripId: String(tripId) } : {}

    const activities = await prisma.activity.findMany({
      where,
      orderBy: { date: 'asc' }, // Cronológico: primero las más tempranas
    })

    res.json({ activities })
  } catch (error) {
    console.error('[activities] getActivities:', error)
    res.status(500).json({ error: 'Error interno del servidor' })
  }
}

// GET /activities/:id
export const getActivityById = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = req.params['id'] as string

    const activity = await prisma.activity.findUnique({
      where:   { id },
      include: { trip: { select: { id: true, title: true, destination: true } } },
    })

    if (!activity) {
      res.status(404).json({ error: 'Actividad no encontrada' })
      return
    }

    res.json({ activity })
  } catch (error) {
    console.error('[activities] getActivityById:', error)
    res.status(500).json({ error: 'Error interno del servidor' })
  }
}

// POST /activities — solo ADMIN y MANAGER
export const createActivity = async (req: Request, res: Response): Promise<void> => {
  try {
    const { title, description, date, location, duration, tripId } =
      req.body as z.infer<typeof createActivitySchema>

    const trip = await prisma.trip.findUnique({ where: { id: tripId } })
    if (!trip) {
      res.status(404).json({ error: 'El viaje especificado no existe' })
      return
    }

    const activity = await prisma.activity.create({
      data: {
        title,
        description,
        date:     new Date(date),
        location,
        duration,
        tripId,
      },
    })

    res.status(201).json({ message: 'Actividad creada exitosamente', activity })
  } catch (error) {
    console.error('[activities] createActivity:', error)
    res.status(500).json({ error: 'Error interno del servidor' })
  }
}

// PATCH /activities/:id
export const updateActivity = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = req.params['id'] as string
    const data    = req.body as z.infer<typeof updateActivitySchema>

    const existing = await prisma.activity.findUnique({ where: { id } })
    if (!existing) {
      res.status(404).json({ error: 'Actividad no encontrada' })
      return
    }

    const updateData: Record<string, unknown> = { ...data }
    if (data.date) updateData['date'] = new Date(data.date)

    const activity = await prisma.activity.update({
      where: { id },
      data:  updateData,
    })

    res.json({ message: 'Actividad actualizada', activity })
  } catch (error) {
    console.error('[activities] updateActivity:', error)
    res.status(500).json({ error: 'Error interno del servidor' })
  }
}

// DELETE /activities/:id
export const deleteActivity = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = req.params['id'] as string

    const existing = await prisma.activity.findUnique({ where: { id } })
    if (!existing) {
      res.status(404).json({ error: 'Actividad no encontrada' })
      return
    }

    await prisma.activity.delete({ where: { id } })

    res.json({ message: 'Actividad eliminada exitosamente' })
  } catch (error) {
    console.error('[activities] deleteActivity:', error)
    res.status(500).json({ error: 'Error interno del servidor' })
  }
}
