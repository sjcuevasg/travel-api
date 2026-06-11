import { type Request, type Response } from 'express'
import bcrypt from 'bcryptjs'
import { sign, type SignOptions } from 'jsonwebtoken'
import { z } from 'zod'
import prisma from '../config/prisma'

// Los esquemas se exportan para usarlos en las rutas con el middleware validate.
// Zod genera el tipo TypeScript automaticamente con z.infer — no se duplica codigo.
export const registerSchema = z.object({
  name:     z.string().min(2,  'El nombre debe tener al menos 2 caracteres'),
  email:    z.string().email(  'Formato de email inválido'),
  password: z.string().min(8,  'La contraseña debe tener al menos 8 caracteres'),
})

export const loginSchema = z.object({
  email:    z.string().email('Formato de email inválido'),
  password: z.string().min(1, 'La contraseña es requerida'),
})

type RegisterBody = z.infer<typeof registerSchema>
type LoginBody    = z.infer<typeof loginSchema>

export const register = async (req: Request, res: Response): Promise<void> => {
  try {
    // req.body ya fue validado y limpiado por el middleware validate(registerSchema).
    const { name, email, password } = req.body as RegisterBody

    const existing = await prisma.user.findUnique({ where: { email } })
    if (existing) {
      res.status(409).json({ error: 'El email ya está en uso' })
      return
    }

    // 12 salt rounds: balance optimo entre seguridad y rendimiento en 2026.
    // Cada round adicional duplica el tiempo de computo (~400ms con 12 rounds).
    const hashedPassword = await bcrypt.hash(password, 12)

    // El role SIEMPRE se fija en EMPLOYEE sin importar lo que venga en el body.
    // Esto previene que cualquier usuario se auto-asigne el rol ADMIN.
    // Para cambiar roles se usa un endpoint separado protegido con authorize('ADMIN').
    const user = await prisma.user.create({
      data: { name, email, password: hashedPassword, role: 'EMPLOYEE' },
      // select excluye el campo password de la respuesta.
      // Prisma solo retorna los campos marcados como true.
      select: { id: true, name: true, email: true, role: true, createdAt: true },
    })

    res.status(201).json({ message: 'Usuario creado exitosamente', user })
  } catch (error) {
    console.error('[auth.controller] register:', error)
    res.status(500).json({ error: 'Error interno del servidor' })
  }
}

export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body as LoginBody

    const user = await prisma.user.findUnique({ where: { email } })

    // Mismo mensaje para "email no existe" y "password incorrecto".
    // Si fueran mensajes distintos, un atacante podria enumerar emails validos
    // probando hasta recibir el mensaje de "password incorrecto".
    if (!user) {
      res.status(401).json({ error: 'Credenciales inválidas' })
      return
    }

    const passwordMatch = await bcrypt.compare(password, user.password)
    if (!passwordMatch) {
      res.status(401).json({ error: 'Credenciales inválidas' })
      return
    }

    const jwtOptions: SignOptions = {
      expiresIn: (process.env.JWT_EXPIRES_IN || '24h') as SignOptions['expiresIn'],
      algorithm: 'HS256',
    }

    // El payload contiene solo id y role: lo minimo necesario para identificar
    // al usuario y verificar permisos sin consultar la DB en cada request.
    // NUNCA incluir el password ni datos sensibles en el payload del JWT.
    const token = sign({ id: user.id, role: user.role }, process.env.JWT_SECRET!, jwtOptions)

    res.json({
      message: 'Login exitoso',
      token,
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
    })
  } catch (error) {
    console.error('[auth.controller] login:', error)
    res.status(500).json({ error: 'Error interno del servidor' })
  }
}
