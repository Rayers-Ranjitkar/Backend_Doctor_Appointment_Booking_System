import { Router } from 'express';
import { changePassword, createAdmin, createDoctor, login, me, signupPatient } from '../controllers/authController.js';
import { requireAuth } from '../middleware/authMiddleware.js';

const router = Router();

// Authentication and session endpoints
router.post('/login', login);
router.post('/signup/patient', signupPatient);

// Administrative account creation endpoints
router.post('/create/admin', requireAuth, createAdmin);
router.post('/create/doctor', requireAuth, createDoctor);

// User profile and management endpoints
router.get('/me', requireAuth, me);
router.post('/change-password', requireAuth, changePassword);

export default router;
