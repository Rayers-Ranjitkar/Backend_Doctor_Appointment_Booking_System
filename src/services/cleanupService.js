import { Appointment } from '../models/Appointment.js';
import { Payment } from '../models/Payment.js';

// Cancels appointments that have remained in awaiting_payment state for over 30 minutes
export async function runPaymentExpiryCleanup() {
  const cutoff = new Date(Date.now() - 30 * 60 * 1000);
  const stale = await Appointment.find({
    paymentStatus: 'awaiting_payment',
    createdAt: { $lt: cutoff },
  });
  for (const appt of stale) {
    appt.status = 'cancelled';
    appt.paymentStatus = 'failed';
    await appt.save();
    await Payment.updateOne({ appointmentId: appt.id }, { $set: { status: 'failed' } });
  }
  return stale.length;
}

// Starts the periodic payment cleanup scheduler on the specified interval
export function startCleanupScheduler(intervalMs = 5 * 60 * 1000) {
  runPaymentExpiryCleanup();
  setInterval(runPaymentExpiryCleanup, intervalMs);
}
