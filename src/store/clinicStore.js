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

/**
 * Creates a deep clone of an object or array.
 * Used to prevent direct mutation of demo data.
 */
function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

/**
 * Application in-memory state.
 * All clinic-related data is stored here temporarily.
 */
const state = clone(demoClinic);

/**
 * Finds a doctor using doctor ID.
 */
function findDoctor(doctorId) {
  return state.doctors.find((doctor) => doctor.id === doctorId);
}

/**
 * Checks whether a doctor appointment slot is already booked.
 *
 * excludeAppointmentId:
 * Used during appointment update/reschedule
 * to ignore the current appointment.
 */
function isSlotTaken({
  doctorId,
  date,
  time,
  excludeAppointmentId,
}) {
  return state.appointments.some(
    (appointment) =>
      appointment.doctorId === doctorId &&
      appointment.date === date &&
      appointment.time === time &&
      appointment.id !== excludeAppointmentId &&
      appointment.status !== 'cancelled',
  );
}

/**
 * Creates a queue entry for an appointment.
 * Also calculates queue position and estimated waiting time.
 */
function createQueueEntryForAppointment(appointment) {

  // Prevent duplicate active queue entries
  const duplicate = state.queueEntries.find(
    (entry) =>
      entry.appointmentId === appointment.id &&
      ['waiting', 'in_consultation'].includes(entry.status),
  );

  if (duplicate) {
    appointment.queueNumber = duplicate.position;
    return duplicate;
  }

  // Count existing queue entries for same doctor and day
  const count = state.queueEntries.filter(
    (entry) =>
      entry.doctorId === appointment.doctorId &&
      ['waiting', 'in_consultation'].includes(entry.status) &&
      entry.appointmentDate === appointment.date,
  ).length;

  const position = count + 1;

  // Create queue object
  const entry = {
    id: `q${Date.now()}`,
    appointmentId: appointment.id,
    appointmentDate: appointment.date,
    doctorId: appointment.doctorId,
    patientId: appointment.patientId,
    patientName: appointment.patientName,
    position,

    // Estimated wait time = queue position × 15 minutes
    estimatedWaitMinutes: position * 15,

    actualWaitMinutes: 0,
    status: 'waiting',
  };

  // Add queue entry at beginning
  state.queueEntries.unshift(entry);

  // Save queue number inside appointment
  appointment.queueNumber = position;

  // Notify realtime clients
  emitRealtime('clinic:changed', {
    type: 'queue-created',
    appointmentId: appointment.id,
  });

  return entry;
}

/**
 * Returns notifications for authenticated user.
 */
function notificationsForAuth(auth) {
  if (!auth) return [];

  return state.notifications.filter(
    (notification) =>
      notification.recipientRole === auth.role &&
      (
        notification.recipientRole === 'admin' ||
        notification.recipientProfileId === auth.profileId
      ),
  );
}

/**
 * Creates and stores notification.
 */
function addNotification(
  message,
  type,
  recipientRole,
  recipientProfileId = null,
) {
  state.notifications.unshift(
    createNotification(
      message,
      type,
      recipientRole,
      recipientProfileId,
    ),
  );
}

export const clinicStore = {

  /**
   * Returns all initial application data.
   * Includes statistics and today's queue.
   */
  getBootstrap(auth) {

    // Count pending doctor verification requests
    const pendingDoctors = state.doctors.filter(
      (doctor) => doctor.verificationStatus === 'pending',
    ).length;

    const todayStr = calendarDateStringLocal();

    // Clone state to avoid direct mutation
    const raw = clone(state);

    // Filter queue for today only
    raw.queueEntries = filterQueueEntriesForCalendarDay(
      raw.queueEntries,
      raw.appointments,
      todayStr,
    );

    // Dashboard statistics
    const stats = {
      totalDoctors: raw.doctors.length,
      totalPatients: raw.patients.length,
      totalAppointments: raw.appointments.length,

      todayAppointments: raw.appointments.filter(
        (appointment) => appointment.date === todayStr,
      ).length,

      pendingRequests: raw.appointments.filter(
        (appointment) => appointment.status === 'pending',
      ).length,

      pendingDoctorVerifications: pendingDoctors,

      completedToday: raw.appointments.filter(
        (appointment) =>
          appointment.date === todayStr &&
          appointment.status === 'completed',
      ).length,

      // Total paid revenue
      revenue: raw.payments
        .filter((payment) => payment.status === 'paid')
        .reduce((sum, payment) => sum + payment.amount, 0),
    };

    return {
      ...raw,
      notifications: clone(notificationsForAuth(auth)),
      stats,
    };
  },

  /**
   * Returns queue entries based on user role.
   */
  getQueue(auth) {
    const todayStr = calendarDateStringLocal();

    let queueEntries = [];

    // Doctor sees own queue
    if (auth?.role === 'doctor') {

      queueEntries = state.queueEntries
        .filter((entry) => entry.doctorId === auth.profileId)
        .slice()
        .sort(
          (a, b) => (a.position ?? 0) - (b.position ?? 0),
        );

    // Patient sees personal queue
    } else if (auth?.role === 'patient') {

      queueEntries = state.queueEntries
        .filter((entry) => entry.patientId === auth.profileId)
        .slice()
        .sort(
          (a, b) =>
            (b.createdAt || '').localeCompare(a.createdAt || ''),
        );

    // Admin sees all queue entries
    } else if (auth?.role === 'admin') {

      queueEntries = state.queueEntries
        .slice()
        .sort(
          (a, b) =>
            (b.createdAt || '').localeCompare(a.createdAt || ''),
        );
    }

    // Filter today's queue only
    queueEntries = filterQueueEntriesForCalendarDay(
      queueEntries,
      state.appointments,
      todayStr,
    );

    return {
      queueEntries: clone(queueEntries),
    };
  },

  /**
   * Books appointment directly.
   */
  bookAppointment(payload) {

    // Prevent past date booking
    if (isPastCalendarDate(payload.date)) {
      return {
        error: 'Cannot book appointments in the past.',
      };
    }

    // Prevent duplicate slot booking
    if (isSlotTaken(payload)) {
      return {
        error: 'Selected slot is already booked.',
      };
    }

    // Find doctor
    const doctor = findDoctor(payload.doctorId);

    if (!doctor) {
      return { error: 'Doctor not found.' };
    }

    // Create appointment object
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

      // Confirm immediately if paid
      status:
        payload.paymentStatus === 'paid'
          ? 'confirmed'
          : 'pending',

      paymentStatus: payload.paymentStatus,

      reason: payload.reason,
      notes: payload.notes || '',

      doctorImage: doctor.image,

      queueNumber: 0,
      estimatedWaitMinutes: 0,
    };

    // Add appointment
    state.appointments.unshift(appointment);

    /**
     * Create payment record if payment completed
     */
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

    /**
     * Create queue entry if:
     * - payment completed
     * - or waiting for payment
     */
    if (
      payload.paymentStatus === 'paid' ||
      payload.paymentStatus === 'awaiting_payment'
    ) {
      createQueueEntryForAppointment(appointment);
    }

    /**
     * Patient notification
     */
    addNotification(
      payload.paymentStatus === 'paid'
        ? `Appointment booked successfully with ${doctor.name} on ${payload.date} at ${payload.time}.`
        : `Appointment request submitted for ${doctor.name}. Complete payment to confirm.`,
      payload.paymentStatus === 'paid'
        ? 'confirmation'
        : 'payment',
      'patient',
      appointment.patientId,
    );

    /**
     * Doctor notification
     */
    addNotification(
      `${appointment.patientName} booked an appointment with you on ${appointment.date} at ${appointment.time}.`,
      'confirmation',
      'doctor',
      appointment.doctorId,
    );

    /**
     * Admin notification
     */
    addNotification(
      `New appointment created: ${appointment.patientName} with ${appointment.doctorName} on ${appointment.date} at ${appointment.time}.`,
      'confirmation',
      'admin',
    );

    // Emit realtime events
    emitRealtime('clinic:changed', {
      type: 'appointment-created',
      appointmentId: appointment.id,
    });

    emitRealtime('notifications:changed', {
      type: 'notification-created',
    });

    return {
      appointment: clone(appointment),
    };
  },
};