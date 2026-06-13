import { type Request, type Response } from 'express'
import { z } from 'zod'
import prisma from '../config/prisma'

// ─── SCHEMAS ──────────────────────────────────────────────────────────────────

export const createTripSchema = z.object({
  title:       z.string().min(3,   'El título debe tener al menos 3 caracteres'),
  destination: z.string().min(2,   'El destino debe tener al menos 2 caracteres'),
  startDate:   z.string().datetime('Fecha de inicio inválida'),
  endDate:     z.string().datetime('Fecha de fin inválida'),
  description: z.string().optional(),
  budget:      z.number().positive('El presupuesto debe ser mayor a 0').optional(),
})

export const updateTripSchema = createTripSchema.partial()

export const updateStatusSchema = z.object({
  status: z.enum(['PENDING', 'APPROVED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED']),
})

// Campos que siempre se retornan en respuestas (excluye datos innecesarios)
const tripSelect = {
  id:          true,
  title:       true,
  destination: true,
  startDate:   true,
  endDate:     true,
  status:      true,
  description: true,
  budget:      true,
  createdAt:   true,
  updatedAt:   true,
  manager: {
    select: { id: true, name: true, email: true, role: true },
  },
} as const

// ─── HANDLERS ─────────────────────────────────────────────────────────────────

// GET /trips
// ADMIN ve todos los viajes.
// MANAGER ve solo los viajes que él gestiona.
// EMPLOYEE ve todos los viajes (lectura) — se puede ajustar por rol si se necesita.
export const getTrips = async (req: Request, res: Response): Promise<void> => {
  try {
    const { role, id: userId } = req.user!

    const where = role === 'MANAGER' ? { managerId: userId } : {}

    const trips = await prisma.trip.findMany({
      where,
      select:  tripSelect,
      orderBy: { createdAt: 'desc' },
    })

    res.json({ trips })
  } catch (error) {
    console.error('[trips] getTrips:', error)
    res.status(500).json({ error: 'Error interno del servidor' })
  }
}

// GET /trips/:id — detalle completo con gastos y actividades
export const getTripById = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = req.params['id'] as string

    const trip = await prisma.trip.findUnique({
      where:   { id },
      include: {
        manager:    { select: { id: true, name: true, email: true } },
        expenses:   { orderBy: { date: 'asc' } },
        activities: { orderBy: { date: 'asc' } },
      },
    })

    if (!trip) {
      res.status(404).json({ error: 'Viaje no encontrado' })
      return
    }

    res.json({ trip })
  } catch (error) {
    console.error('[trips] getTripById:', error)
    res.status(500).json({ error: 'Error interno del servidor' })
  }
}

// POST /trips — solo ADMIN y MANAGER
export const createTrip = async (req: Request, res: Response): Promise<void> => {
  try {
    const { title, destination, startDate, endDate, description, budget } =
      req.body as z.infer<typeof createTripSchema>

    if (new Date(startDate) >= new Date(endDate)) {
      res.status(400).json({ error: 'La fecha de inicio debe ser anterior a la de fin' })
      return
    }

    const trip = await prisma.trip.create({
      data: {
        title,
        destination,
        startDate:   new Date(startDate),
        endDate:     new Date(endDate),
        description,
        budget,
        managerId:   req.user!.id,
      },
      select: tripSelect,
    })

    res.status(201).json({ message: 'Viaje creado exitosamente', trip })
  } catch (error) {
    console.error('[trips] createTrip:', error)
    res.status(500).json({ error: 'Error interno del servidor' })
  }
}

// PATCH /trips/:id — actualiza campos del viaje
export const updateTrip = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = req.params['id'] as string
    const data    = req.body as z.infer<typeof updateTripSchema>

    const existing = await prisma.trip.findUnique({ where: { id } })
    if (!existing) {
      res.status(404).json({ error: 'Viaje no encontrado' })
      return
    }

    // Un MANAGER solo puede editar sus propios viajes
    if (req.user!.role === 'MANAGER' && existing.managerId !== req.user!.id) {
      res.status(403).json({ error: 'Solo puedes editar los viajes que gestionas' })
      return
    }

    const updateData: Record<string, unknown> = { ...data }
    if (data.startDate) updateData['startDate'] = new Date(data.startDate)
    if (data.endDate)   updateData['endDate']   = new Date(data.endDate)

    const trip = await prisma.trip.update({
      where:  { id },
      data:   updateData,
      select: tripSelect,
    })

    res.json({ message: 'Viaje actualizado', trip })
  } catch (error) {
    console.error('[trips] updateTrip:', error)
    res.status(500).json({ error: 'Error interno del servidor' })
  }
}

// PATCH /trips/:id/status — cambia el estado del viaje
export const updateTripStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = req.params['id'] as string
    const { status } = req.body as z.infer<typeof updateStatusSchema>

    const existing = await prisma.trip.findUnique({ where: { id } })
    if (!existing) {
      res.status(404).json({ error: 'Viaje no encontrado' })
      return
    }

    const trip = await prisma.trip.update({
      where:  { id },
      data:   { status },
      select: tripSelect,
    })

    res.json({ message: `Estado del viaje cambiado a ${status}`, trip })
  } catch (error) {
    console.error('[trips] updateTripStatus:', error)
    res.status(500).json({ error: 'Error interno del servidor' })
  }
}

// DELETE /trips/:id — solo ADMIN
export const deleteTrip = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = req.params['id'] as string

    const existing = await prisma.trip.findUnique({ where: { id } })
    if (!existing) {
      res.status(404).json({ error: 'Viaje no encontrado' })
      return
    }

    // onDelete: Cascade en el schema elimina automáticamente los expenses y activities
    await prisma.trip.delete({ where: { id } })

    res.json({ message: 'Viaje eliminado exitosamente' })
  } catch (error) {
    console.error('[trips] deleteTrip:', error)
    res.status(500).json({ error: 'Error interno del servidor' })
  }
}
