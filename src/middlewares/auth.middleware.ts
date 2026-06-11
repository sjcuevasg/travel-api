import { type Request, type Response, type NextFunction } from 'express'
import { verify } from 'jsonwebtoken'

// authenticate verifica que la peticion traiga un JWT valido en el header Authorization.
// Formato esperado del header: "Authorization: Bearer <token>"
export const authenticate = (req: Request, res: Response, next: NextFunction): void => {
  const authHeader = req.headers.authorization

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Token no proporcionado' })
    return
  }

  const token = authHeader.split(' ')[1]

  try {
    // algorithms: ['HS256'] previene el "algorithm confusion attack":
    // un atacante podria construir un JWT con alg:"none" para saltarse la firma.
    // Al especificar el algoritmo esperado, el servidor rechaza cualquier otro.
    const decoded = verify(token, process.env.JWT_SECRET!, { algorithms: ['HS256'] })

    // jwt.verify puede retornar un string si el payload es primitivo. Lo descartamos.
    if (typeof decoded === 'string' || !decoded['id'] || !decoded['role']) {
      res.status(401).json({ error: 'Token con formato inválido' })
      return
    }

    req.user = {
      id:   decoded['id'] as string,
      role: decoded['role'] as string,
    }
    next()
  } catch {
    // jwt.verify lanza JsonWebTokenError si la firma no coincide,
    // y TokenExpiredError si el token ya expiro. Ambos reciben 401.
    res.status(401).json({ error: 'Token inválido o expirado' })
  }
}

// authorize es una higher-order function que recibe los roles permitidos
// y retorna el middleware que hace la verificacion de permisos.
// Uso: router.get('/admin', authenticate, authorize('ADMIN'), controller)
// Uso multiple: router.get('/report', authenticate, authorize('ADMIN', 'MANAGER'), controller)
export const authorize =
  (...roles: string[]) =>
  (req: Request, res: Response, next: NextFunction): void => {
    // Este chequeo es una guardia defensiva: authenticate siempre debe ir antes.
    if (!req.user) {
      res.status(401).json({ error: 'No autenticado' })
      return
    }

    if (!roles.includes(req.user.role)) {
      // 403 Forbidden: el servidor sabe quien eres pero no tienes permiso.
      // Diferente al 401 (el servidor no sabe quien eres).
      res.status(403).json({ error: 'Permisos insuficientes' })
      return
    }

    next()
  }
