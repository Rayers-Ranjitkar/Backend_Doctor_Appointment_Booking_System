// Express router for clinic services, appointments, reviews, queues, and AI assistant
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
  getBookedSlots,
} from '../controllers/clinicController.js';
import { requireAuth } from '../middleware/authMiddleware.js';

const router = Router();

// Enforce authentication on all clinic endpoints
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
router.patch('/doctors/:id/schedule', updateDoctorSchedule);   

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
router.delete('/patients/:id', deletePatient);                  

// Specialties (admin)
router.post('/specialties', addSpecialty);                      
router.patch('/specialties/:id', updateSpecialty);             
router.delete('/specialties/:id', deleteSpecialty);            
router.patch('/notifications/mark-read', markAllNotificationsRead);

// Payments (Khalti)
router.post('/payments/khalti/initiate', initiateKhaltiPaymentForAppointment);
router.post('/payments/khalti/verify', verifyKhaltiPaymentForAppointment);


//booked slots routes
router.get('/doctors/:id/booked-slots', getBookedSlots);
export default router;
