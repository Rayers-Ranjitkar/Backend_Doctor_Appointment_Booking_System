import { demoClinic } from '../data/demoData.js';
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

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

const state = clone(demoClinic);

function findDoctor(doctorId) {
  return state.doctors.find((doctor) => doctor.id === doctorId);
}

function isSlotTaken({ doctorId, date, time, excludeAppointmentId }) {
  return state.appointments.some(
    (appointment) =>
      appointment.doctorId === doctorId &&
      appointment.date === date &&
      appointment.time === time &&
      appointment.id !== excludeAppointmentId &&
      appointment.status !== 'cancelled',
  );
}

function createQueueEntryForAppointment(appointment) {
  const duplicate = state.queueEntries.find(
    (entry) =>
      entry.appointmentId === appointment.id &&
      ['waiting', 'in_consultation'].includes(entry.status),
  );
  if (duplicate) {
    appointment.queueNumber = duplicate.position;
    return duplicate;
  }

  const count = state.queueEntries.filter(
    (entry) =>
      entry.doctorId === appointment.doctorId &&
      ['waiting', 'in_consultation'].includes(entry.status) &&
      entry.appointmentDate === appointment.date,
  ).length;
  const position = count + 1;
  const entry = {
    id: `q${Date.now()}`,
    appointmentId: appointment.id,
    appointmentDate: appointment.date,
    doctorId: appointment.doctorId,
    patientId: appointment.patientId,
    patientName: appointment.patientName,
    position,
    estimatedWaitMinutes: position * 15,
    actualWaitMinutes: 0,
    status: 'waiting',
  };
  state.queueEntries.unshift(entry);
  appointment.queueNumber = position;
  emitRealtime('clinic:changed', { type: 'queue-created', appointmentId: appointment.id });
  return entry;
}

function notificationsForAuth(auth) {
  if (!auth) return [];
  return state.notifications.filter((notification) => (
    notification.recipientRole === auth.role &&
    (notification.recipientRole === 'admin' || notification.recipientProfileId === auth.profileId)
  ));
}

function addNotification(message, type, recipientRole, recipientProfileId = null) {
  state.notifications.unshift(createNotification(message, type, recipientRole, recipientProfileId));
}

export const clinicStore = {
    // Aggregates all clinic stats and records for app load in memory
  getBootstrap(auth) {
    const pendingDoctors = state.doctors.filter((doctor) => doctor.verificationStatus === 'pending').length;
    const todayStr = calendarDateStringLocal();
    const raw = clone(state);
    raw.queueEntries = filterQueueEntriesForCalendarDay(raw.queueEntries, raw.appointments, todayStr);
    const stats = {
      totalDoctors: raw.doctors.length,
      totalPatients: raw.patients.length,
      totalAppointments: raw.appointments.length,
      todayAppointments: raw.appointments.filter((appointment) => appointment.date === todayStr).length,
      pendingRequests: raw.appointments.filter((appointment) => appointment.status === 'pending').length,
      pendingDoctorVerifications: pendingDoctors,
      completedToday: raw.appointments.filter((appointment) => appointment.date === todayStr && appointment.status === 'completed').length,
      revenue: raw.payments.filter((payment) => payment.status === 'paid').reduce((sum, payment) => sum + payment.amount, 0),
    };

    return { ...raw, notifications: clone(notificationsForAuth(auth)), stats };
  },

    // Retrieves the current day's queue for the authenticated user role in memory
  getQueue(auth) {
    const todayStr = calendarDateStringLocal();
    let queueEntries = [];
    if (auth?.role === 'doctor') {
      queueEntries = state.queueEntries
        .filter((entry) => entry.doctorId === auth.profileId)
        .slice()
        .sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
    } else if (auth?.role === 'patient') {
      queueEntries = state.queueEntries
        .filter((entry) => entry.patientId === auth.profileId)
        .slice()
        .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
    } else if (auth?.role === 'admin') {
      queueEntries = state.queueEntries
        .slice()
        .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
    }
    queueEntries = filterQueueEntriesForCalendarDay(queueEntries, state.appointments, todayStr);
    return { queueEntries: clone(queueEntries) };
  },

    // Registers a new appointment booking in memory
  bookAppointment(payload) {
    if (isPastCalendarDate(payload.date)) {
      return { error: 'Cannot book appointments in the past.' };
    }

    if (isSlotTaken(payload)) {
      return { error: 'Selected slot is already booked.' };
    }

    const doctor = findDoctor(payload.doctorId);
    if (!doctor) {
      return { error: 'Doctor not found.' };
    }

    const appointment = {
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
    };

    state.appointments.unshift(appointment);

    if (payload.paymentStatus === 'paid') {
      state.payments.unshift(
        createKhaltiPayment({
          amount: doctor.price,
          appointmentId: appointment.id,
          patientId: appointment.patientId,
          doctorId: appointment.doctorId,
        }),
      );
    }

    if (payload.paymentStatus === 'paid' || payload.paymentStatus === 'awaiting_payment') {
      createQueueEntryForAppointment(appointment);
    }

    addNotification(
      payload.paymentStatus === 'paid'
        ? `Appointment booked successfully with ${doctor.name} on ${payload.date} at ${payload.time}.`
        : `Appointment request submitted for ${doctor.name}. Complete payment to confirm.`,
      payload.paymentStatus === 'paid' ? 'confirmation' : 'payment',
      'patient',
      appointment.patientId,
    );
    addNotification(
      `${appointment.patientName} booked an appointment with you on ${appointment.date} at ${appointment.time}.`,
      'confirmation',
      'doctor',
      appointment.doctorId,
    );
    addNotification(
      `New appointment created: ${appointment.patientName} with ${appointment.doctorName} on ${appointment.date} at ${appointment.time}.`,
      'confirmation',
      'admin',
    );

    emitRealtime('clinic:changed', { type: 'appointment-created', appointmentId: appointment.id });
    emitRealtime('notifications:changed', { type: 'notification-created' });

    return { appointment: clone(appointment) };
  },

    // Initiates Khalti payment gateway transaction for appointment in memory
  async initiateKhaltiAppointmentPayment(payload) {
    if (isPastCalendarDate(payload.date)) {
      return { error: 'Cannot book appointments in the past.' };
    }

    if (isSlotTaken(payload)) {
      return { error: 'Selected slot is already booked.' };
    }

    const doctor = findDoctor(payload.doctorId);
    if (!doctor) {
      return { error: 'Doctor not found.' };
    }

    const appointmentId = `a${Date.now()}`;
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
      khaltiInit = await initiateKhaltiPayment({
        return_url: `${env.clientUrl}/patient/khalti/callback`,
        website_url: env.clientUrl,
        amount: amountInPaisa,
        purchase_order_id: appointmentId,
        purchase_order_name: `Appointment with ${doctor.name}`,
        ...(Object.keys(customerInfo).length ? { customer_info: customerInfo } : {}),
      });
    } catch (error) {
      return { error: error instanceof Error ? error.message : 'Unable to initiate Khalti payment.' };
    }

    const appointment = {
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
    };
    state.appointments.unshift(appointment);
    state.payments.unshift(
      createKhaltiPayment({
        amount: doctor.price,
        appointmentId,
        patientId: payload.patientId,
        doctorId: payload.doctorId,
        status: 'initiated',
        reference: khaltiInit.pidx,
      }),
    );
    emitRealtime('clinic:changed', { type: 'appointment-created', appointmentId });
    return {
      appointment: clone(appointment),
      khalti: {
        pidx: khaltiInit.pidx,
        payment_url: khaltiInit.payment_url,
        expires_at: khaltiInit.expires_at,
        expires_in: khaltiInit.expires_in,
      },
    };
  },

    // Verifies the status of a Khalti payment callback in memory
  async verifyKhaltiAppointmentPayment(pidx) {
    let lookup;
    try {
      lookup = await lookupKhaltiPayment(pidx);
    } catch (error) {
      return { error: error instanceof Error ? error.message : 'Unable to verify Khalti payment.' };
    }

    const payment = state.payments.find((item) => item.reference === pidx);
    if (!payment) {
      return { error: 'Payment record not found for this Khalti transaction.' };
    }

    const appointment = state.appointments.find((item) => item.id === payment.appointmentId);
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
      addNotification(
        `Khalti payment completed for your appointment with ${appointment.doctorName}.`,
        'payment',
        'patient',
        appointment.patientId,
      );
      createQueueEntryForAppointment(appointment);
    } else if (lookup.status === 'User canceled' || lookup.status === 'Expired') {
      payment.status = 'failed';
      appointment.paymentStatus = 'failed';
      appointment.status = 'cancelled';
    } else {
      payment.status = lookup.status.toLowerCase();
    }

    emitRealtime('clinic:changed', { type: 'appointment-updated', appointmentId: appointment.id, status: appointment.status });
    emitRealtime('notifications:changed', { type: 'notification-created' });
    return { lookup, appointment: clone(appointment) };
  },

    // Updates an appointment's details or status in memory
  updateAppointment(id, updates) {
    const appointment = state.appointments.find((item) => item.id === id);
    if (!appointment) {
      return { error: 'Appointment not found.' };
    }

    if (updates.date && isPastCalendarDate(updates.date)) {
      return { error: 'Cannot reschedule to a date in the past.' };
    }

    if ((updates.date || updates.time) && isSlotTaken({
      doctorId: appointment.doctorId,
      date: updates.date || appointment.date,
      time: updates.time || appointment.time,
      excludeAppointmentId: appointment.id,
    })) {
      return { error: 'Requested reschedule slot is already taken.' };
    }

    Object.assign(appointment, updates);
    if (updates.date) {
      state.queueEntries
        .filter((entry) => entry.appointmentId === id)
        .forEach((entry) => {
          entry.appointmentDate = appointment.date;
        });
    }
    addNotification(`Your appointment ${appointment.id.toUpperCase()} was updated to ${appointment.status}.`, 'info', 'patient', appointment.patientId);
    addNotification(`${appointment.patientName}'s appointment ${appointment.id.toUpperCase()} is now ${appointment.status}.`, 'info', 'doctor', appointment.doctorId);
    addNotification(`Appointment ${appointment.id.toUpperCase()} updated to ${appointment.status}.`, 'info', 'admin');
    if (appointment.status === 'completed') {
      addNotification(`Your appointment with ${appointment.doctorName} was marked completed. You can now leave feedback.`, 'confirmation', 'patient', appointment.patientId);
    }
    emitRealtime('clinic:changed', { type: 'appointment-updated', appointmentId: appointment.id, status: appointment.status });
    emitRealtime('notifications:changed', { type: 'notification-created' });
    return { appointment: clone(appointment) };
  },

    // Uploads a new prescription record for an appointment in memory
  addPrescription(payload) {
    const prescription = {
      id: `rx${Date.now()}`,
      ...payload,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    state.prescriptions.unshift(prescription);
    addNotification(`New prescription uploaded by ${payload.doctorName} for your visit.`, 'info', 'patient', payload.patientId);
    addNotification(`Prescription saved for ${payload.patientName}.`, 'info', 'doctor', payload.doctorId);
    emitRealtime('clinic:changed', { type: 'prescription-created', prescriptionId: prescription.id });
    emitRealtime('notifications:changed', { type: 'notification-created' });
    return clone(prescription);
  },

    // Edits an existing prescription record in memory
  updatePrescription(id, updates) {
    const prescription = state.prescriptions.find((item) => item.id === id);
    if (!prescription) {
      return { error: 'Prescription not found.' };
    }

    Object.assign(prescription, updates, { updatedAt: new Date().toISOString() });
    addNotification(`Your prescription was updated by ${prescription.doctorName}.`, 'info', 'patient', prescription.patientId);
    addNotification(`Prescription updated for ${prescription.patientName}.`, 'info', 'doctor', prescription.doctorId);
    emitRealtime('clinic:changed', { type: 'prescription-updated', prescriptionId: prescription.id });
    emitRealtime('notifications:changed', { type: 'notification-created' });
    return { prescription: clone(prescription) };
  },

    // Updates status or position of a queue entry in memory
  updateQueue(id, updates) {
    const entry = state.queueEntries.find((item) => item.id === id);
    if (!entry) {
      return { error: 'Queue entry not found.' };
    }

    Object.assign(entry, updates);
    addNotification(`Queue updated. You are now at position ${entry.position}.`, 'queue', 'patient', entry.patientId);
    addNotification(`Queue updated for ${entry.patientName}. Position ${entry.position}.`, 'queue', 'doctor', entry.doctorId);
    emitRealtime('clinic:changed', { type: 'queue-updated', queueEntryId: entry.id });
    emitRealtime('notifications:changed', { type: 'notification-created' });
    return { entry: clone(entry) };
  },

    // Submits a feedback review for a doctor in memory
  addReview(payload) {
    const appointment = state.appointments.find((item) => item.id === payload.appointmentId && item.patientId === payload.patientId);
    if (!appointment) {
      return { error: 'Appointment not found.' };
    }
    if (appointment.status !== 'completed') {
      return { error: 'Feedback is available only after the appointment is completed by the doctor.' };
    }
    const review = {
      id: `r${Date.now()}`,
      ...payload,
      createdAt: new Date().toISOString(),
    };
    state.reviews.unshift(review);
    emitRealtime('clinic:changed', { type: 'review-created', reviewId: review.id });
    return { review: clone(review) };
  },

    // Updates doctor verification status in memory
  verifyDoctor(id, verificationStatus) {
    const doctor = state.doctors.find((item) => item.id === id);
    if (!doctor) {
      return { error: 'Doctor not found.' };
    }

    doctor.verificationStatus = verificationStatus;
    addNotification(`Your verification status was updated to ${verificationStatus}.`, 'info', 'doctor', doctor.id);
    addNotification(`${doctor.name} verification updated to ${verificationStatus}.`, 'info', 'admin');
    emitRealtime('clinic:changed', { type: 'doctor-verification', doctorId: doctor.id });
    emitRealtime('notifications:changed', { type: 'notification-created' });
    return { doctor: clone(doctor) };
  },

    // Sends a question to the AI assistant using in-memory context
  askAssistant(prompt, conversationHistory = []) {
    return answerAssistant(prompt, state, conversationHistory);
  },

  registerPatientProfile(patient) {
    state.patients.unshift(clone(patient));
  },

  registerDoctorProfile(doctor) {
    state.doctors.unshift(clone(doctor));
  },

  pushSystemNotification(message, type = 'info', recipientRole = 'admin', recipientProfileId = null) {
    addNotification(message, type, recipientRole, recipientProfileId);
    emitRealtime('notifications:changed', { type: 'notification-created' });
  },

  markReminderSent(id, reminderType, mode) {
    const appointment = state.appointments.find((item) => item.id === id);
    if (!appointment) return null;

    appointment.reminderStatus = {
      sent24h: reminderType === '24h' ? true : Boolean(appointment.reminderStatus?.sent24h),
      sent1h: reminderType === '1h' ? true : Boolean(appointment.reminderStatus?.sent1h),
      lastSentAt: new Date().toISOString(),
      lastSentMode: mode,
    };

    emitRealtime('clinic:changed', { type: 'reminder-sent', appointmentId: appointment.id });

    return appointment;
  },


  
  updateDoctorSchedule(id, { availableDays, timeSlots }) {
    const doctor = state.doctors.find((d) => d.id === id);
    if (!doctor) {
      return { error: 'Doctor not found.' };
    }
    doctor.availableDays = availableDays;
    doctor.timeSlots = timeSlots;
    addNotification('Your schedule has been updated.', 'info', 'doctor', id);
    emitRealtime('clinic:changed', { type: 'doctor-schedule-updated', doctorId: id });
    emitRealtime('notifications:changed', { type: 'notification-created' });
    return { doctor: clone(doctor) };
  },

  // ── Patients ──────────────────────────────────────────────────────────────

  deletePatient(id) {
    const index = state.patients.findIndex((p) => p.id === id);
    if (index === -1) {
      return { error: 'Patient not found.' };
    }
    const [patient] = state.patients.splice(index, 1);
    addNotification(`Patient ${patient.name} was removed from the system.`, 'info', 'admin');
    emitRealtime('clinic:changed', { type: 'patient-deleted', patientId: id });
    emitRealtime('notifications:changed', { type: 'notification-created' });
    return { ok: true };
  },

  // ── Specialties ───────────────────────────────────────────────────────────

  addSpecialty(payload) {
    const { name, icon, color, doctorCount = 0 } = payload;
    if (!name) {
      return { error: 'Specialty name is required.' };
    }
    const specialty = {
      id: `sp${Date.now()}`,
      name,
      icon: icon || '🏥',
      color: color || '#3B82F6',
      doctorCount,
    };
    state.specialties.push(specialty);
    emitRealtime('clinic:changed', { type: 'specialty-created', specialtyId: specialty.id });
    return { specialty: clone(specialty) };
  },

  updateSpecialty(id, updates) {
    const specialty = state.specialties.find((s) => s.id === id);
    if (!specialty) {
      return { error: 'Specialty not found.' };
    }
    const allowed = ['name', 'icon', 'color', 'doctorCount'];
    allowed.forEach((key) => {
      if (updates[key] !== undefined) specialty[key] = updates[key];
    });
    emitRealtime('clinic:changed', { type: 'specialty-updated', specialtyId: id });
    return { specialty: clone(specialty) };
  },

  deleteSpecialty(id) {
    const index = state.specialties.findIndex((s) => s.id === id);
    if (index === -1) {
      return { error: 'Specialty not found.' };
    }
    state.specialties.splice(index, 1);
    emitRealtime('clinic:changed', { type: 'specialty-deleted', specialtyId: id });
    return { ok: true };
  },
    
};
