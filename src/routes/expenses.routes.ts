import { Router } from 'express'
import {
  getExpenses, getExpenseById, createExpense,
  updateExpense, deleteExpense,
  createExpenseSchema, updateExpenseSchema,
} from '../controllers/expenses.controller'
import { authorize } from '../middlewares/auth.middleware'
import { validate } from '../middlewares/validate.middleware'

const router = Router()

// Todos los autenticados pueden ver gastos
router.get('/',    getExpenses)
router.get('/:id', getExpenseById)

// Solo ADMIN y MANAGER pueden crear, editar y eliminar gastos
router.post('/',    validate(createExpenseSchema), authorize('ADMIN', 'MANAGER'), createExpense)
router.patch('/:id', validate(updateExpenseSchema), authorize('ADMIN', 'MANAGER'), updateExpense)
router.delete('/:id', authorize('ADMIN', 'MANAGER'), deleteExpense)

export default router
