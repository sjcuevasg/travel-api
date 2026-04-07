import express, { Application } from 'express'

const app: Application = express()

app.use(express.json())

app.get('/health', (req: express.Request, res: express.Response): void => {
  res.json({ status: 'ok', message: 'travel-api running' })
})

export default app