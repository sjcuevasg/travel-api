import { Router } from 'express'
import {
  getTrips, getTripById, createTrip,
  updateTrip, updateTripStatus, deleteTrip,
  createTripSchema, updateTripSchema, updateStatusSchema,
} from '../controllers/trips.controller'
import { authorize } from '../middlewares/auth.middleware'
import { validate } from '../middlewares/validate.middleware'

const router = Router()

// Todos los usuarios autenticados pueden ver viajes
router.get('/',    getTrips)
router.get('/:id', getTripById)

// Solo ADMIN y MANAGER pueden crear y editar
router.post('/',                validate(createTripSchema),  authorize('ADMIN', 'MANAGER'), createTrip)
router.patch('/:id',            validate(updateTripSchema),  authorize('ADMIN', 'MANAGER'), updateTrip)
router.patch('/:id/status',     validate(updateStatusSchema),authorize('ADMIN', 'MANAGER'), updateTripStatus)

// Solo ADMIN puede eliminar viajes
router.delete('/:id', authorize('ADMIN'), deleteTrip)

export default router
