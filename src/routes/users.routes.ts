import { Router } from 'express'
import {
  getUsers, updateUserRole,
  updateRoleSchema,
} from '../controllers/users.controller'
import { authorize } from '../middlewares/auth.middleware'
import { validate } from '../middlewares/validate.middleware'

const router = Router()

// Solo ADMIN puede ver la lista de usuarios y cambiar roles
router.get('/',            authorize('ADMIN'), getUsers)
router.patch('/:id/role',  authorize('ADMIN'), validate(updateRoleSchema), updateUserRole)

export default router
