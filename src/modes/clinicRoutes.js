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
  // NEW
  updateDoctorSchedule,
  deletePatient,
  addSpecialty,
  updateSpecialty,
  deleteSpecialty,
  markAllNotificationsRead
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
router.patch('/doctors/:id/schedule', updateDoctorSchedule);   // NEW

// Assistant
router.post('/assistant', askAssistant);

// Reminders
router.post('/reminders/run', triggerReminders);

// Patients (admin)
router.delete('/patients/:id', deletePatient);                  // NEW

// Specialties (admin)
router.post('/specialties', addSpecialty);                      // NEW
router.patch('/specialties/:id', updateSpecialty);             // NEW
router.delete('/specialties/:id', deleteSpecialty);            // NEW
router.patch('/notifications/mark-read', markAllNotificationsRead);

export default router;

