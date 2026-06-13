import { type ZodSchema } from 'zod'
import { type Request, type Response, type NextFunction } from 'express'

// Middleware de validacion reutilizable: recibe un esquema Zod y retorna un middleware.
// Patron higher-order function: validate(schema) devuelve la funcion middleware real.
// Uso en rutas: router.post('/register', validate(registerSchema), controllerFn)
export const validate =
  (schema: ZodSchema) =>
  (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body)

    if (!result.success) {
      res.status(400).json({
        error:   'Datos de entrada inválidos',
        details: result.error.flatten().fieldErrors,
      })
      return
    }

    // Reemplaza req.body con los datos ya validados y transformados por Zod.
    // Esto garantiza que el controller recibe datos limpios con los tipos correctos.
    req.body = result.data
    next()
  }
