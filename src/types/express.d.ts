// Extiende la interfaz Request de Express para agregar la propiedad user.
// Sin este archivo TypeScript se quejaria al acceder a req.user en los middlewares.
// El signo ? hace que sea opcional: no existe antes de authenticate, si existe despues.
declare global {
  namespace Express {
    interface Request {
      user?: {
        id:   string
        role: string
      }
    }
  }
}

// export {} convierte este archivo en un modulo de TypeScript.
// Sin el, el declare global no funciona correctamente.
export {}
