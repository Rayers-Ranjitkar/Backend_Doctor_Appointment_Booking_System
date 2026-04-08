import { Router } from 'express';
import {
  addPrescription,
  addReview,
  askAssistant,
  bookAppointment,
  getBootstrap,
  triggerReminders,
  updateAppointment,
  updatePrescription,
  updateQueue,
  verifyDoctor,
  // NEW — patients
  deletePatient,
  // NEW — specialties
  addSpecialty,
  updateSpecialty,
  deleteSpecialty,
} from '../controllers/clinicController.js';
import { requireAuth } from '../middleware/authMiddleware.js';

const router = Router();

router.use(requireAuth);

router.get('/bootstrap', getBootstrap);

// Appointments
router.post('/appointments', bookAppointment);
router.patch('/appointments/:id', updateAppointment);

// Prescriptions
router.post('/prescriptions', addPrescription);
router.patch('/prescriptions/:id', updatePrescription);

// Queue
router.patch('/queue/:id', updateQueue);

// Reviews
router.post('/reviews', addReview);

// Doctors
router.patch('/doctors/:id/verification', verifyDoctor);

// Assistant
router.post('/assistant', askAssistant);

// Reminders
router.post('/reminders/run', triggerReminders);

// NEW — Patients (admin only)
router.delete('/patients/:id', deletePatient);

// NEW — Specialties (admin only)
router.post('/specialties', addSpecialty);
router.patch('/specialties/:id', updateSpecialty);
router.delete('/specialties/:id', deleteSpecialty);

export default router;
