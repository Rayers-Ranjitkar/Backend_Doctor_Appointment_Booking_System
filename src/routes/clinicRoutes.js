import { Router } from 'express';
import {
  addPrescription,
  addReview,
  createAssistantChat,
  deleteAssistantChat,
  askAssistant,
  bookAppointment,
  getBootstrap,
  getQueue,
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
  markAllNotificationsRead,
  getAssistantChatMessages,
  listAssistantChats,
  sendAssistantChatMessage,
  initiateKhaltiPaymentForAppointment,
  verifyKhaltiPaymentForAppointment,
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
router.get('/queue', getQueue)
router.patch('/queue/:id', updateQueue);

// Reviews
router.post('/reviews', addReview);

// Doctors
router.patch('/doctors/:id/verification', verifyDoctor);
router.patch('/doctors/:id/schedule', updateDoctorSchedule);   // NEW

// Assistant
router.post('/assistant', askAssistant);

// MediBook AI chat history
router.get('/assistant/chats', listAssistantChats);
router.post('/assistant/chats', createAssistantChat);
router.get('/assistant/chats/:id/messages', getAssistantChatMessages);
router.post('/assistant/chats/:id/messages', sendAssistantChatMessage);
router.delete('/assistant/chats/:id', deleteAssistantChat);

// Reminders
router.post('/reminders/run', triggerReminders);

// Patients (admin)
router.delete('/patients/:id', deletePatient);                  // NEW

// Specialties (admin)
router.post('/specialties', addSpecialty);                      // NEW
router.patch('/specialties/:id', updateSpecialty);             // NEW
router.delete('/specialties/:id', deleteSpecialty);            // NEW
router.patch('/notifications/mark-read', markAllNotificationsRead);

// Payments (Khalti)
router.post('/payments/khalti/initiate', initiateKhaltiPaymentForAppointment);
router.post('/payments/khalti/verify', verifyKhaltiPaymentForAppointment);

export default router;
