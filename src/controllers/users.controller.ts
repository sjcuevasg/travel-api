import { type Request, type Response } from 'express'
import { z } from 'zod'
import prisma from '../config/prisma'

// ─── SCHEMAS ──────────────────────────────────────────────────────────────────

export const updateRoleSchema = z.object({
  role: z.enum(['ADMIN', 'MANAGER', 'EMPLOYEE']),
})

// ─── HANDLERS ─────────────────────────────────────────────────────────────────

// GET /users — lista todos los usuarios (solo ADMIN)
export const getUsers = async (req: Request, res: Response): Promise<void> => {
  try {
    const users = await prisma.user.findMany({
      select:  { id: true, name: true, email: true, role: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
    })

    res.json({ users })
  } catch (error) {
    console.error('[users] getUsers:', error)
    res.status(500).json({ error: 'Error interno del servidor' })
  }
}

// PATCH /users/:id/role — cambia el rol de un usuario (solo ADMIN)
// Este es el único endpoint que puede elevar un usuario a ADMIN o MANAGER.
// No existe forma pública de auto-asignarse un rol — solo el ADMIN puede hacerlo.
export const updateUserRole = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = req.params['id'] as string
    const { role } = req.body as z.infer<typeof updateRoleSchema>

    // Un ADMIN no puede quitarse su propio rol de ADMIN
    if (id === req.user!.id && role !== 'ADMIN') {
      res.status(400).json({ error: 'No puedes cambiar tu propio rol de ADMIN' })
      return
    }

    const existing = await prisma.user.findUnique({ where: { id } })
    if (!existing) {
      res.status(404).json({ error: 'Usuario no encontrado' })
      return
    }

    const user = await prisma.user.update({
      where:  { id },
      data:   { role },
      select: { id: true, name: true, email: true, role: true, updatedAt: true },
    })

    res.json({ message: `Rol actualizado a ${role}`, user })
  } catch (error) {
    console.error('[users] updateUserRole:', error)
    res.status(500).json({ error: 'Error interno del servidor' })
  }
}
