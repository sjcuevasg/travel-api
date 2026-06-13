import 'dotenv/config'
import { PrismaLibSql } from '@prisma/adapter-libsql'
import { PrismaClient } from '@prisma/client'

const url = process.env.DATABASE_URL
if (!url) throw new Error('[prisma] DATABASE_URL is not set — check your .env file')

const adapter = new PrismaLibSql({ url })

const prisma = new PrismaClient({ adapter })

export default prisma
