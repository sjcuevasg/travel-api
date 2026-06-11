import { Router } from 'express'
import {
  getActivities, getActivityById, createActivity,
  updateActivity, deleteActivity,
  createActivitySchema, updateActivitySchema,
} from '../controllers/activities.controller'
import { authorize } from '../middlewares/auth.middleware'
import { validate } from '../middlewares/validate.middleware'

const router = Router()

// Todos los autenticados pueden ver actividades
router.get('/',    getActivities)
router.get('/:id', getActivityById)

// Solo ADMIN y MANAGER pueden crear, editar y eliminar actividades
router.post('/',    validate(createActivitySchema), authorize('ADMIN', 'MANAGER'), createActivity)
router.patch('/:id', validate(updateActivitySchema), authorize('ADMIN', 'MANAGER'), updateActivity)
router.delete('/:id', authorize('ADMIN', 'MANAGER'), deleteActivity)

export default router
