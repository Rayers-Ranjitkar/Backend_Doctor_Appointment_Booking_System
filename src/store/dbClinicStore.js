import { demoClinic } from '../data/demoData.js';
import { Appointment } from '../models/Appointment.js';
import { Doctor } from '../models/Doctor.js';
import { Notification } from '../models/Notification.js';
import { Patient } from '../models/Patient.js';
import { Payment } from '../models/Payment.js';
import { Prescription } from '../models/Prescription.js';
import { QueueEntry } from '../models/QueueEntry.js';
import { Review } from '../models/Review.js';
import { Specialty } from '../models/Specialty.js';
import { createNotification } from '../services/notificationService.js';
import {
  buildKhaltiCustomerInfo,
  createKhaltiPayment,
  initiateKhaltiPayment,
  lookupKhaltiPayment,
} from '../services/paymentService.js';
import { answerAssistant } from '../services/aiService.js';
import { emitRealtime } from '../services/realtimeService.js';
import { env } from '../config/env.js';
import {
  calendarDateStringLocal,
  filterQueueEntriesForCalendarDay,
  isPastCalendarDate,
} from '../utils/calendarDate.js';



async function seedCollection(Model, items) {
  const count = await Model.countDocuments();
  if (count === 0 && items.length) {
    await Model.insertMany(items, { ordered: false });
  }
}

export async function initializeDatabaseSeed() {
  await seedCollection(Specialty, demoClinic.specialties);
  await seedCollection(Doctor, demoClinic.doctors);
  await seedCollection(Patient, demoClinic.patients);
  await seedCollection(Appointment, demoClinic.appointments);
  await seedCollection(Notification, demoClinic.notifications);
  await seedCollection(Prescription, demoClinic.prescriptions);
  await seedCollection(QueueEntry, demoClinic.queueEntries);
  await seedCollection(Review, demoClinic.reviews);
  await seedCollection(Payment, demoClinic.payments);
}

async function pushNotification(message, type = 'info') {
  await Notification.create(createNotification(message, type, 'admin', null));
  emitRealtime('notifications:changed', { type: 'notification-created' });
}

async function pushTargetedNotification(message, type, recipientRole, recipientProfileId = null) {
  await Notification.create(createNotification(message, type, recipientRole, recipientProfileId));
  emitRealtime('notifications:changed', { type: 'notification-created' });
}



async function buildBootstrap(auth) {
  const [specialties, doctors, patients, appointments, notifications, prescriptions, queueEntries, reviews, payments] = await Promise.all([
    Specialty.find().lean(),
    Doctor.find().lean(),
    Patient.find().lean(),
    Appointment.find().sort({ createdAt: -1 }).lean(),
    Notification.find().sort({ createdAt: -1 }).lean(),
    Prescription.find().sort({ createdAt: -1 }).lean(),
    QueueEntry.find().sort({ createdAt: -1 }).lean(),
    Review.find().sort({ createdAt: -1 }).lean(),
    Payment.find().sort({ createdAt: -1 }).lean(),
  ]);

  const todayStr = calendarDateStringLocal();
  const queueEntriesForToday = filterQueueEntriesForCalendarDay(queueEntries, appointments, todayStr);

  const stats = {
    totalDoctors: doctors.length,
    totalPatients: patients.length,
    totalAppointments: appointments.length,
    todayAppointments: appointments.filter((appointment) => appointment.date === todayStr).length,
    pendingRequests: appointments.filter((appointment) => appointment.status === 'pending').length,
    pendingDoctorVerifications: doctors.filter((doctor) => doctor.verificationStatus === 'pending').length,
    completedToday: appointments.filter((appointment) => appointment.date === todayStr && appointment.status === 'completed').length,
    revenue: payments.filter((payment) => payment.status === 'paid').reduce((sum, payment) => sum + payment.amount, 0),
  };

  const visibleNotifications = auth
    ? notifications.filter((notification) => notification.recipientRole === auth.role && (auth.role === 'admin' || notification.recipientProfileId === auth.profileId))
    : [];

  return { specialties, doctors, patients, appointments, notifications: visibleNotifications, prescriptions, queueEntries: queueEntriesForToday, reviews, payments, stats };
}

async function isSlotTaken({ doctorId, date, time, excludeAppointmentId }) {
  const existing = await Appointment.findOne({
    doctorId, date, time,
    id: { $ne: excludeAppointmentId },
    status: { $nin: ['cancelled'] },
    paymentStatus: { $nin: ['awaiting_payment', 'failed'] },
  }).lean();
  return Boolean(existing);
}

async function createQueueEntryForAppointment(appointment) {
  const activeExisting = await QueueEntry.findOne({
    appointmentId: appointment.id,
    status: { $in: ['waiting', 'in_consultation'] },
  }).lean();
  if (activeExisting) {
    if (appointment.queueNumber !== activeExisting.position) {
      appointment.queueNumber = activeExisting.position;
      await appointment.save();
    }
    return activeExisting;
  }

  const count = await QueueEntry.countDocuments({
    doctorId: appointment.doctorId,
    status: { $in: ['waiting', 'in_consultation'] },
    appointmentDate: appointment.date,
  });

  const position = count + 1;
  const estimatedWaitMinutes = position * 15;

  const entry = await QueueEntry.create({
    id: `q${Date.now()}`,
    appointmentId: appointment.id,
    appointmentDate: appointment.date,
    doctorId: appointment.doctorId,
    patientId: appointment.patientId,
    patientName: appointment.patientName,
    position,
    estimatedWaitMinutes,
    actualWaitMinutes: 0,
    status: 'waiting',
  });

  appointment.queueNumber = position;
  await appointment.save();

  emitRealtime('clinic:changed', { type: 'queue-created', appointmentId: appointment.id });
  return entry;
}

export const dbClinicStore = {
    // Aggregates all clinic stats and records for app load from MongoDB
  async getBootstrap(auth) {
    return buildBootstrap(auth);
  },

    // Retrieves the current day's queue for the authenticated user role from MongoDB
  async getQueue(auth) {
    let queueEntries;
    if (auth?.role === 'doctor') {
      queueEntries = await QueueEntry.find({ doctorId: auth.profileId }).sort({ position: 1 }).lean();
    } else if (auth?.role === 'patient') {
      queueEntries = await QueueEntry.find({ patientId: auth.profileId }).sort({ createdAt: -1 }).lean();
    } else if (auth?.role === 'admin') {
      queueEntries = await QueueEntry.find().sort({ createdAt: -1 }).lean();
    } else {
      queueEntries = [];
    }

    const ids = [...new Set(queueEntries.map((e) => e.appointmentId).filter(Boolean))];
    const appts = ids.length
      ? await Appointment.find({ id: { $in: ids } }).select('id date').lean()
      : [];
    const todayStr = calendarDateStringLocal();
    queueEntries = filterQueueEntriesForCalendarDay(queueEntries, appts, todayStr);

    return { queueEntries };
  },

    // Registers a new appointment booking in MongoDB
  async bookAppointment(payload) {
    if (isPastCalendarDate(payload.date)) {
      return { error: 'Cannot book appointments in the past.' };
    }

    if (await isSlotTaken(payload)) {
      return { error: 'Selected slot is already booked.' };
    }

    const doctor = await Doctor.findOne({ id: payload.doctorId }).lean();
    if (!doctor) {
      return { error: 'Doctor not found.' };
    }

    const appointment = await Appointment.create({
      id: `a${Date.now()}`,
      patientId: payload.patientId,
      patientName: payload.patientName,
      patientAge: payload.patientAge,
      doctorId: payload.doctorId,
      doctorName: doctor.name,
      specialty: doctor.specialty,
      hospital: doctor.hospital,
      date: payload.date,
      time: payload.time,
      status: payload.paymentStatus === 'paid' ? 'confirmed' : 'pending',
      paymentStatus: payload.paymentStatus,
      reason: payload.reason,
      notes: payload.notes || '',
      doctorImage: doctor.image,
      queueNumber: 0,
      estimatedWaitMinutes: 0,
      reminderStatus: { sent24h: false, sent1h: false },
    });

    if (payload.paymentStatus === 'paid') {
      await Payment.create(createKhaltiPayment({
        amount: doctor.price,
        appointmentId: appointment.id,
        patientId: appointment.patientId,
        doctorId: appointment.doctorId,
      }));
    }

    if (payload.paymentStatus === 'paid' || payload.paymentStatus === 'awaiting_payment') {
      await createQueueEntryForAppointment(appointment);
    }

    await pushTargetedNotification(
      payload.paymentStatus === 'paid'
        ? `Appointment booked successfully with ${doctor.name} on ${payload.date} at ${payload.time}.`
        : `Appointment request submitted for ${doctor.name}. Complete payment to confirm.`,
      payload.paymentStatus === 'paid' ? 'confirmation' : 'payment',
      'patient',
      appointment.patientId,
    );
    await pushTargetedNotification(
      `${appointment.patientName} booked an appointment with you on ${appointment.date} at ${appointment.time}.`,
      'confirmation',
      'doctor',
      appointment.doctorId,
    );
    await pushTargetedNotification(
      `New appointment created: ${appointment.patientName} with ${appointment.doctorName} on ${appointment.date} at ${appointment.time}.`,
      'confirmation',
      'admin',
    );

    emitRealtime('clinic:changed', { type: 'appointment-created', appointmentId: appointment.id });

    return { appointment: appointment.toObject() };
  },

    // Initiates Khalti payment gateway transaction for appointment in MongoDB
  async initiateKhaltiAppointmentPayment(payload) {
    console.log('>>> INITIATE CALLED', payload);  // ADD THIS
    if (isPastCalendarDate(payload.date)) {
      return { error: 'Cannot book appointments in the past.' };
    }

    if (await isSlotTaken(payload)) {
      return { error: 'Selected slot is already booked.' };
    }

    const doctor = await Doctor.findOne({ id: payload.doctorId }).lean();
    if (!doctor) {
      return { error: 'Doctor not found.' };
    }

    const appointmentId = `a${Date.now()}`;
    const returnUrl = `${env.clientUrl}/patient/khalti/callback`;
    const amountInPaisa = Math.round(Number(doctor.price || 0) * 100);
    if (amountInPaisa < 1000) {
      return { error: 'Appointment amount must be at least NPR 10 for Khalti checkout.' };
    }

    let khaltiInit;
    try {
      const customerInfo = buildKhaltiCustomerInfo({
        patientName: payload.patientName,
        patientEmail: payload.patientEmail,
        patientPhone: payload.patientPhone,
      });
      console.log('>>> AMOUNT IN PAISA:', amountInPaisa);
      console.log('>>> DOCTOR:', doctor?.name, doctor?.price);
      console.log('>>> RETURN URL:', returnUrl);
      khaltiInit = await initiateKhaltiPayment({
        return_url: returnUrl,
        website_url: env.clientUrl,
        amount: amountInPaisa,
        purchase_order_id: appointmentId,
        purchase_order_name: `Appointment with ${doctor.name}`,
        ...(Object.keys(customerInfo).length ? { customer_info: customerInfo } : {}),
      });
      console.log('>>> KHALTI RESPONSE', khaltiInit); // ADD AFTER
    } catch (error) {
      return { error: error instanceof Error ? error.message : 'Unable to initiate Khalti payment.' };
    }

    const appointment = await Appointment.create({
      id: appointmentId,
      patientId: payload.patientId,
      patientName: payload.patientName,
      patientAge: payload.patientAge,
      doctorId: payload.doctorId,
      doctorName: doctor.name,
      specialty: doctor.specialty,
      hospital: doctor.hospital,
      date: payload.date,
      time: payload.time,
      status: 'pending',
      paymentStatus: 'awaiting_payment',
      reason: payload.reason,
      notes: payload.notes || '',
      doctorImage: doctor.image,
      queueNumber: 0,
      estimatedWaitMinutes: 0,
      reminderStatus: { sent24h: false, sent1h: false },
    });

    await Payment.create(createKhaltiPayment({
      amount: doctor.price,
      appointmentId: appointment.id,
      patientId: appointment.patientId,
      doctorId: appointment.doctorId,
      status: 'initiated',
      reference: khaltiInit.pidx,
    }));

    emitRealtime('clinic:changed', { type: 'appointment-created', appointmentId: appointment.id });
    return {
      appointment: appointment.toObject(),
      khalti: {
        pidx: khaltiInit.pidx,
        payment_url: khaltiInit.payment_url,
        expires_at: khaltiInit.expires_at,
        expires_in: khaltiInit.expires_in,
      },
    };
  },

    // Verifies the status of a Khalti payment callback in MongoDB
  async verifyKhaltiAppointmentPayment(pidx) {
    let lookup;
    try {
      lookup = await lookupKhaltiPayment(pidx);
    } catch (error) {
      return { error: error instanceof Error ? error.message : 'Unable to verify Khalti payment.' };
    }

    const payment = await Payment.findOne({ reference: pidx });
    if (!payment) {
      return { error: 'Payment record not found for this Khalti transaction.' };
    }

    const appointment = await Appointment.findOne({ id: payment.appointmentId });
    if (!appointment) {
      return { error: 'Appointment not found for this payment.' };
    }

    if (lookup.status === 'Completed') {
      payment.status = 'paid';
      payment.paidAt = new Date().toISOString();
      appointment.paymentStatus = 'paid';
      if (appointment.status === 'pending') {
        appointment.status = 'confirmed';
      }
      await pushTargetedNotification(
        `Khalti payment completed for your appointment with ${appointment.doctorName}.`,
        'payment',
        'patient',
        appointment.patientId,
      );
      await pushTargetedNotification(
        `${appointment.patientName} completed Khalti payment for appointment ${appointment.id.toUpperCase()}.`,
        'payment',
        'doctor',
        appointment.doctorId,
      );

      await createQueueEntryForAppointment(appointment);
    } else if (lookup.status === 'User canceled' || lookup.status === 'Expired') {
      payment.status = 'failed';
      appointment.paymentStatus = 'failed';
      appointment.status = 'cancelled';
    } else {
      payment.status = lookup.status.toLowerCase();
    }

    await payment.save();
    await appointment.save();
    emitRealtime('clinic:changed', { type: 'appointment-updated', appointmentId: appointment.id, status: appointment.status });
    return { lookup, appointment: appointment.toObject() };
  },

    // Updates an appointment's details or status in MongoDB
  async updateAppointment(id, updates) {
    const appointment = await Appointment.findOne({ id });
    if (!appointment) {
      return { error: 'Appointment not found.' };
    }

    if (updates.date && isPastCalendarDate(updates.date)) {
      return { error: 'Cannot reschedule to a date in the past.' };
    }

    if ((updates.date || updates.time) && await isSlotTaken({
      doctorId: appointment.doctorId,
      date: updates.date || appointment.date,
      time: updates.time || appointment.time,
      excludeAppointmentId: appointment.id,
    })) {
      return { error: 'Requested reschedule slot is already taken.' };
    }

    const previousStatus = appointment.status;
    Object.assign(appointment, updates);
    await appointment.save();

    if (updates.date) {
      await QueueEntry.updateMany({ appointmentId: id }, { $set: { appointmentDate: appointment.date } });
    }

    if (previousStatus !== 'completed' && appointment.status === 'completed') {
      await pushTargetedNotification(
        `Your appointment with ${appointment.doctorName} was marked completed. You can now leave feedback.`,
        'confirmation',
        'patient',
        appointment.patientId,
      );
    } else {
      await pushTargetedNotification(`Your appointment ${appointment.id.toUpperCase()} was updated to ${appointment.status}.`, 'info', 'patient', appointment.patientId);
    }
    await pushTargetedNotification(`${appointment.patientName}'s appointment ${appointment.id.toUpperCase()} is now ${appointment.status}.`, 'info', 'doctor', appointment.doctorId);
    await pushTargetedNotification(`Appointment ${appointment.id.toUpperCase()} updated to ${appointment.status}.`, 'info', 'admin');

    emitRealtime('clinic:changed', { type: 'appointment-updated', appointmentId: appointment.id, status: appointment.status });

    return { appointment: appointment.toObject() };
  },

    // Uploads a new prescription record for an appointment in MongoDB
  async addPrescription(payload) {
    const prescription = await Prescription.create({
      id: `rx${Date.now()}`,
      ...payload,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    await pushTargetedNotification(`New prescription uploaded by ${payload.doctorName} for your visit.`, 'info', 'patient', payload.patientId);
    await pushTargetedNotification(`Prescription saved for ${payload.patientName}.`, 'info', 'doctor', payload.doctorId);
    emitRealtime('clinic:changed', { type: 'prescription-created', prescriptionId: prescription.id });
    return prescription.toObject();
  },

    // Edits an existing prescription record in MongoDB
  async updatePrescription(id, updates) {
    const prescription = await Prescription.findOneAndUpdate(
      { id },
      { $set: { ...updates, updatedAt: new Date().toISOString() } },
      { new: true },
    ).lean();
    if (!prescription) {
      return { error: 'Prescription not found.' };
    }
    await pushTargetedNotification(`Your prescription was updated by ${prescription.doctorName}.`, 'info', 'patient', prescription.patientId);
    await pushTargetedNotification(`Prescription updated for ${prescription.patientName}.`, 'info', 'doctor', prescription.doctorId);
    emitRealtime('clinic:changed', { type: 'prescription-updated', prescriptionId: prescription.id });
    return { prescription };
  },

    // Updates status or position of a queue entry in MongoDB
  async updateQueue(id, updates) {
    const allowedFields = ['status', 'position', 'estimatedWaitMinutes', 'actualWaitMinutes'];
    const safeUpdates = Object.fromEntries(Object.entries(updates).filter(([k]) => allowedFields.includes(k)));

    const entry = await QueueEntry.findOneAndUpdate({ id }, { $set: safeUpdates }, { new: true });
    if (!entry) return { error: 'Queue entry not found.' };

    if (safeUpdates.status === 'completed') {
      // Decrement position of all remaining 'waiting' entries for this doctor
      const waiting = await QueueEntry.find({ doctorId: entry.doctorId, status: 'waiting' }).sort({ position: 1 });
      for (const w of waiting) {
        w.position = w.position - 1;
        w.estimatedWaitMinutes = Math.max(0, (w.position - 1) * 15);
        await w.save();
        await pushTargetedNotification(
          `Queue update: you are now position ${w.position}. Estimated wait: ${w.estimatedWaitMinutes} mins.`,
          'queue', 'patient', w.patientId
        );
      }
      emitRealtime('clinic:changed', { type: 'queue-reordered', doctorId: entry.doctorId });
    } else {
      await pushTargetedNotification(`Queue updated. You are now at position ${entry.position}.`, 'queue', 'patient', entry.patientId);
    }

    await pushTargetedNotification(`Queue updated for ${entry.patientName}.`, 'queue', 'doctor', entry.doctorId);
    emitRealtime('clinic:changed', { type: 'queue-updated', queueEntryId: entry.id });
    return { entry: entry.toObject() };
  },

    // Submits a feedback review for a doctor in MongoDB
  async addReview(payload) {
    const appointment = await Appointment.findOne({ id: payload.appointmentId, patientId: payload.patientId }).lean();
    if (!appointment) {
      return { error: 'Appointment not found.' };
    }
    if (appointment.status !== 'completed') {
      return { error: 'Feedback is available only after the appointment is completed by the doctor.' };
    }
    const review = await Review.create({
      id: `r${Date.now()}`,
      ...payload,
      createdAt: new Date().toISOString(),
    });
    emitRealtime('clinic:changed', { type: 'review-created', reviewId: review.id });
    return { review: review.toObject() };
  },

    // Updates doctor verification status in MongoDB
  async verifyDoctor(id, verificationStatus) {
    const doctor = await Doctor.findOneAndUpdate({ id }, { $set: { verificationStatus } }, { new: true }).lean();
    if (!doctor) {
      return { error: 'Doctor not found.' };
    }
    await pushTargetedNotification(`Your verification status was updated to ${verificationStatus}.`, 'info', 'doctor', doctor.id);
    await pushTargetedNotification(`${doctor.name} verification updated to ${verificationStatus}.`, 'info', 'admin');
    emitRealtime('clinic:changed', { type: 'doctor-verification', doctorId: doctor.id });
    return { doctor };
  },

    // Sends a question to the AI assistant using MongoDB context
  async askAssistant(prompt, conversationHistory = []) {
    const bootstrap = await buildBootstrap();
    return answerAssistant(prompt, bootstrap, conversationHistory);
  },

  async pushSystemNotification(message, type = 'info', recipientRole = 'admin', recipientProfileId = null) {
    await pushTargetedNotification(message, type, recipientRole, recipientProfileId);
  },

  async markReminderSent(id, reminderType, mode) {
    const appointment = await Appointment.findOne({ id });
    if (!appointment) return null;

    appointment.reminderStatus = {
      sent24h: reminderType === '24h' ? true : Boolean(appointment.reminderStatus?.sent24h),
      sent1h: reminderType === '1h' ? true : Boolean(appointment.reminderStatus?.sent1h),
      lastSentAt: new Date().toISOString(),
      lastSentMode: mode,
    };
    await appointment.save();
    emitRealtime('clinic:changed', { type: 'reminder-sent', appointmentId: appointment.id });
    return appointment.toObject();
  },




  async updateDoctorSchedule(id, { availableDays, timeSlots }) {
    const doctor = await Doctor.findOneAndUpdate(
      { id },
      { $set: { availableDays, timeSlots } },
      { new: true }
    ).lean();
    if (!doctor) {
      return { error: 'Doctor not found.' };
    }
    await pushTargetedNotification('Your schedule has been updated.', 'info', 'doctor', id);
    emitRealtime('clinic:changed', { type: 'doctor-schedule-updated', doctorId: id });
    return { doctor };
  },

  // ── Patients ──────────────────────────────────────────────────────────────

  async deletePatient(id) {
    const patient = await Patient.findOneAndDelete({ id }).lean();
    if (!patient) {
      return { error: 'Patient not found.' };
    }
    await pushNotification(`Patient ${patient.name} was removed from the system.`, 'info');
    emitRealtime('clinic:changed', { type: 'patient-deleted', patientId: id });
    return { ok: true };
  },

  // ── Specialties ───────────────────────────────────────────────────────────

  async addSpecialty(payload) {
    const { name, icon, color, doctorCount = 0 } = payload;
    if (!name) {
      return { error: 'Specialty name is required.' };
    }
    const specialty = await Specialty.create({
      id: `sp${Date.now()}`,
      name,
      icon: icon || '🏥',
      color: color || '#3B82F6',
      doctorCount,
    });
    emitRealtime('clinic:changed', { type: 'specialty-created', specialtyId: specialty.id });
    return { specialty: specialty.toObject() };
  },

  async updateSpecialty(id, updates) {
    const allowed = ['name', 'icon', 'color', 'doctorCount'];
    const safe = Object.fromEntries(
      Object.entries(updates).filter(([key]) => allowed.includes(key))
    );
    const specialty = await Specialty.findOneAndUpdate({ id }, { $set: safe }, { new: true }).lean();
    if (!specialty) {
      return { error: 'Specialty not found.' };
    }
    emitRealtime('clinic:changed', { type: 'specialty-updated', specialtyId: id });
    return { specialty };
  },

  async deleteSpecialty(id) {
    const specialty = await Specialty.findOneAndDelete({ id }).lean();
    if (!specialty) {
      return { error: 'Specialty not found.' };
    }
    emitRealtime('clinic:changed', { type: 'specialty-deleted', specialtyId: id });
    return { ok: true };
  },

  async markAllNotificationsRead(auth) {
    await Notification.updateMany(
      {
        recipientRole: auth.role,
        ...(auth.role !== 'admin' ? { recipientProfileId: auth.profileId } : {}),
      },
      { $set: { read: true } }
    );
    emitRealtime('notifications:changed', { type: 'notifications-read' });
    return { ok: true };
  },

  async getBookedSlots(doctorId, date) {
    const appointments = await Appointment.find({
      doctorId,
      date,
      status: { $nin: ['cancelled'] },
      paymentStatus: { $nin: ['awaiting_payment', 'failed'] },
    }).lean();
    return { bookedSlots: appointments.map((a) => a.time) };
  },

};
