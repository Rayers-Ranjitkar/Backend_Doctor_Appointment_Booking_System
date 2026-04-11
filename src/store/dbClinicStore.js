import { demoClinic } from '../data/demoData.js';
import { Appointment } from '../models/Appointment.js';
import { Payment } from '../models/Payment.js';
import { createKhaltiPayment } from '../services/paymentService.js';

/* Seed initial data into database */
async function seedCollection(Model, items) {
  const count = await Model.countDocuments();
  if (count === 0 && items.length) {
    await Model.insertMany(items, { ordered: false });
  }
}

/* Initialize database with appointment and payment data */
export async function initializeDatabaseSeed() {
  await seedCollection(Appointment, demoClinic.appointments);
  await seedCollection(Payment, demoClinic.payments);
}

/* Build bootstrap data (used when app loads) */
async function buildBootstrap() {
  const [appointments, payments] = await Promise.all([
    Appointment.find().sort({ createdAt: -1 }).lean(),
    Payment.find().sort({ createdAt: -1 }).lean(),
  ]);

  /* Basic stats related to appointments and payments */
  const stats = {
    totalAppointments: appointments.length,
    pendingRequests: appointments.filter((a) => a.status === 'pending').length,
    completedToday: appointments.filter((a) => a.status === 'completed').length,
    revenue: payments
      .filter((p) => p.status === 'paid')
      .reduce((sum, p) => sum + p.amount, 0),
  };

  return { appointments, payments, stats };
}

/* Check if a doctor already has an appointment at given time */
async function isSlotTaken({ doctorId, date, time, excludeAppointmentId }) {
  const existing = await Appointment.findOne({
    doctorId,
    date,
    time,
    id: { $ne: excludeAppointmentId },
    status: { $ne: 'cancelled' },
  }).lean();
  return Boolean(existing);
}

export const dbClinicStore = {

  /* Get all appointments and payments */
  async getBootstrap() {
    return buildBootstrap();
  },

  /* Book a new appointment */
  async bookAppointment(payload) {

    /* Prevent double booking */
    if (await isSlotTaken(payload)) {
      return { error: 'Selected slot is already booked.' };
    }

    /* Create appointment */
    const appointment = await Appointment.create({
      id: `a${Date.now()}`,
      patientId: payload.patientId,
      patientName: payload.patientName,
      patientAge: payload.patientAge,
      doctorId: payload.doctorId,
      doctorName: payload.doctorName,
      specialty: payload.specialty,
      hospital: payload.hospital,
      date: payload.date,
      time: payload.time,
      status: payload.paymentStatus === 'paid' ? 'confirmed' : 'pending',
      paymentStatus: payload.paymentStatus,
      reason: payload.reason,
      notes: payload.notes || '',
      doctorImage: payload.doctorImage,
      queueNumber: 0,
      estimatedWaitMinutes: 0,
      reminderStatus: { sent24h: false, sent1h: false },
    });

    /* If already paid, create payment record */
    if (payload.paymentStatus === 'paid') {
      await Payment.create(
        createKhaltiPayment({
          amount: payload.amount,
          appointmentId: appointment.id,
          patientId: appointment.patientId,
          doctorId: appointment.doctorId,
        })
      );
    }

    return { appointment: appointment.toObject() };
  },

  /* Update appointment details */
  async updateAppointment(id, updates) {
    const appointment = await Appointment.findOne({ id });

    if (!appointment) {
      return { error: 'Appointment not found.' };
    }

    /* Prevent rescheduling to occupied slot */
    if (
      (updates.date || updates.time) &&
      (await isSlotTaken({
        doctorId: appointment.doctorId,
        date: updates.date || appointment.date,
        time: updates.time || appointment.time,
        excludeAppointmentId: appointment.id,
      }))
    ) {
      return { error: 'Requested reschedule slot is already taken.' };
    }

    Object.assign(appointment, updates);
    await appointment.save();

    return { appointment: appointment.toObject() };
  },

  /* Create payment for an appointment */
  async createPayment(payload) {
    const appointment = await Appointment.findOne({
      id: payload.appointmentId,
    });

    if (!appointment) {
      return { error: 'Appointment not found.' };
    }

    /* Create payment record */
    const payment = await Payment.create({
      id: `p${Date.now()}`,
      appointmentId: payload.appointmentId,
      doctorId: appointment.doctorId,
      patientId: appointment.patientId,
      amount: payload.amount,
      provider: payload.provider,
      reference: payload.reference,
      status: payload.status || 'paid',
      paidAt: new Date().toISOString(),
    });

    /* Update appointment payment status */
    appointment.paymentStatus = payment.status;

    if (payment.status === 'paid') {
      appointment.status = 'confirmed';
    }

    await appointment.save();

    return { payment: payment.toObject() };
  },

  /* Mark reminder as sent */
  async markReminderSent(id, reminderType, mode) {
    const appointment = await Appointment.findOne({ id });

    if (!appointment) return null;

    appointment.reminderStatus = {
      sent24h:
        reminderType === '24h'
          ? true
          : Boolean(appointment.reminderStatus?.sent24h),
      sent1h:
        reminderType === '1h'
          ? true
          : Boolean(appointment.reminderStatus?.sent1h),
      lastSentAt: new Date().toISOString(),
      lastSentMode: mode,
    };

    await appointment.save();
    return appointment.toObject();
  },
};