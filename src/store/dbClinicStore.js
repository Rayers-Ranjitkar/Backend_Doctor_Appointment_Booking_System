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

/**
 * Seeds a MongoDB collection only if it is empty.
 */
async function seedCollection(Model, items) {

  // Count existing documents
  const count = await Model.countDocuments();

  // Insert demo data only if collection is empty
  if (count === 0 && items.length) {
    await Model.insertMany(items, {
      ordered: false,
    });
  }
}

/**
 * Initializes all database seed data.
 */
export async function initializeDatabaseSeed() {

  await seedCollection(
    Specialty,
    demoClinic.specialties,
  );

  await seedCollection(
    Doctor,
    demoClinic.doctors,
  );

  await seedCollection(
    Patient,
    demoClinic.patients,
  );

  await seedCollection(
    Appointment,
    demoClinic.appointments,
  );

  await seedCollection(
    Notification,
    demoClinic.notifications,
  );

  await seedCollection(
    Prescription,
    demoClinic.prescriptions,
  );

  await seedCollection(
    QueueEntry,
    demoClinic.queueEntries,
  );

  await seedCollection(
    Review,
    demoClinic.reviews,
  );

  await seedCollection(
    Payment,
    demoClinic.payments,
  );
}

/**
 * Pushes notification for admin users.
 */
async function pushNotification(
  message,
  type = 'info',
) {

  await Notification.create(
    createNotification(
      message,
      type,
      'admin',
      null,
    ),
  );

  emitRealtime(
    'notifications:changed',
    {
      type: 'notification-created',
    },
  );
}

/**
 * Pushes notification for targeted user role/profile.
 */
async function pushTargetedNotification(
  message,
  type,
  recipientRole,
  recipientProfileId = null,
) {

  await Notification.create(
    createNotification(
      message,
      type,
      recipientRole,
      recipientProfileId,
    ),
  );

  emitRealtime(
    'notifications:changed',
    {
      type: 'notification-created',
    },
  );
}

/**
 * Builds complete application bootstrap data.
 * Used for dashboard initialization.
 */
async function buildBootstrap(auth) {

  /**
   * Load all required collections in parallel.
   */
  const [
    specialties,
    doctors,
    patients,
    appointments,
    notifications,
    prescriptions,
    queueEntries,
    reviews,
    payments,
  ] = await Promise.all([

    Specialty.find().lean(),

    Doctor.find().lean(),

    Patient.find().lean(),

    Appointment.find()
      .sort({ createdAt: -1 })
      .lean(),

    Notification.find()
      .sort({ createdAt: -1 })
      .lean(),

    Prescription.find()
      .sort({ createdAt: -1 })
      .lean(),

    QueueEntry.find()
      .sort({ createdAt: -1 })
      .lean(),

    Review.find()
      .sort({ createdAt: -1 })
      .lean(),

    Payment.find()
      .sort({ createdAt: -1 })
      .lean(),
  ]);

  // Current date string
  const todayStr =
    calendarDateStringLocal();

  /**
   * Filter queue entries only for today.
   */
  const queueEntriesForToday =
    filterQueueEntriesForCalendarDay(
      queueEntries,
      appointments,
      todayStr,
    );

  /**
   * Dashboard statistics
   */
  const stats = {

    totalDoctors:
      doctors.length,

    totalPatients:
      patients.length,

    totalAppointments:
      appointments.length,

    todayAppointments:
      appointments.filter(
        (appointment) =>
          appointment.date === todayStr,
      ).length,

    pendingRequests:
      appointments.filter(
        (appointment) =>
          appointment.status === 'pending',
      ).length,

    pendingDoctorVerifications:
      doctors.filter(
        (doctor) =>
          doctor.verificationStatus === 'pending',
      ).length,

    completedToday:
      appointments.filter(
        (appointment) =>
          appointment.date === todayStr &&
          appointment.status === 'completed',
      ).length,

    /**
     * Total revenue from paid payments
     */
    revenue:
      payments
        .filter(
          (payment) =>
            payment.status === 'paid',
        )
        .reduce(
          (sum, payment) =>
            sum + payment.amount,
          0,
        ),
  };

  /**
   * Show notifications only for authenticated user.
   */
  const visibleNotifications = auth
    ? notifications.filter(
        (notification) =>
          notification.recipientRole === auth.role &&
          (
            auth.role === 'admin' ||
            notification.recipientProfileId === auth.profileId
          ),
      )
    : [];

  return {
    specialties,
    doctors,
    patients,
    appointments,

    notifications:
      visibleNotifications,

    prescriptions,

    queueEntries:
      queueEntriesForToday,

    reviews,
    payments,
    stats,
  };
}

/**
 * Checks whether appointment slot is already taken.
 */
async function isSlotTaken({
  doctorId,
  date,
  time,
  excludeAppointmentId,
}) {

  const existing =
    await Appointment.findOne({

      doctorId,
      date,
      time,

      // Ignore current appointment while updating
      id: {
        $ne: excludeAppointmentId,
      },

      // Ignore cancelled appointments
      status: {
        $nin: ['cancelled'],
      },

      // Ignore failed/unpaid appointments
      paymentStatus: {
        $nin: ['awaiting_payment', 'failed'],
      },

    }).lean();

  return Boolean(existing);
}

/**
 * Creates queue entry for appointment.
 */
async function createQueueEntryForAppointment(
  appointment,
) {

  /**
   * Prevent duplicate active queue entries.
   */
  const activeExisting =
    await QueueEntry.findOne({
      appointmentId: appointment.id,

      status: {
        $in: [
          'waiting',
          'in_consultation',
        ],
      },
    }).lean();

  if (activeExisting) {

    // Sync queue number if changed
    if (
      appointment.queueNumber !==
      activeExisting.position
    ) {
      appointment.queueNumber =
        activeExisting.position;

      await appointment.save();
    }

    return activeExisting;
  }

  /**
   * Count active queue entries
   * for same doctor and day.
   */
  const count =
    await QueueEntry.countDocuments({

      doctorId: appointment.doctorId,

      status: {
        $in: [
          'waiting',
          'in_consultation',
        ],
      },

      appointmentDate:
        appointment.date,
    });

  const position = count + 1;

  /**
   * Estimated wait:
   * each patient = 15 mins
   */
  const estimatedWaitMinutes =
    position * 15;

  /**
   * Create queue entry
   */
  const entry = await QueueEntry.create({
    id: `q${Date.now()}`,

    appointmentId:
      appointment.id,

    appointmentDate:
      appointment.date,

    doctorId:
      appointment.doctorId,

    patientId:
      appointment.patientId,

    patientName:
      appointment.patientName,

    position,

    estimatedWaitMinutes,

    actualWaitMinutes: 0,

    status: 'waiting',
  });

  // Update appointment queue number
  appointment.queueNumber = position;

  await appointment.save();

  // Notify realtime listeners
  emitRealtime(
    'clinic:changed',
    {
      type: 'queue-created',
      appointmentId: appointment.id,
    },
  );

  return entry;
}

export const dbClinicStore = {

  /**
   * Returns application bootstrap data.
   */
  async getBootstrap(auth) {
    return buildBootstrap(auth);
  },

  /**
   * Returns queue entries based on user role.
   */
  async getQueue(auth) {

    let queueEntries;

    // Doctor sees own queue
    if (auth?.role === 'doctor') {

      queueEntries =
        await QueueEntry.find({
          doctorId: auth.profileId,
        })
          .sort({ position: 1 })
          .lean();

    // Patient sees own queue
    } else if (auth?.role === 'patient') {

      queueEntries =
        await QueueEntry.find({
          patientId: auth.profileId,
        })
          .sort({ createdAt: -1 })
          .lean();

    // Admin sees all queue entries
    } else if (auth?.role === 'admin') {

      queueEntries =
        await QueueEntry.find()
          .sort({ createdAt: -1 })
          .lean();

    } else {

      queueEntries = [];
    }

    /**
     * Collect appointment IDs from queue entries.
     */
    const ids = [
      ...new Set(
        queueEntries
          .map((e) => e.appointmentId)
          .filter(Boolean),
      ),
    ];

    /**
     * Fetch appointment dates
     * for queue filtering.
     */
    const appts = ids.length
      ? await Appointment.find({
          id: { $in: ids },
        })
          .select('id date')
          .lean()
      : [];

    const todayStr =
      calendarDateStringLocal();

    /**
     * Filter queue only for today.
     */
    queueEntries =
      filterQueueEntriesForCalendarDay(
        queueEntries,
        appts,
        todayStr,
      );

    return {
      queueEntries,
    };
  },
};