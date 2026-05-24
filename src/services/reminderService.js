import { sendReminderEmail } from './emailService.js';
import { clinicStore } from '../store/clinicStore.js';
import { dbClinicStore } from '../store/dbClinicStore.js';
import { isDatabaseConnected } from '../config/database.js';

const sentReminderKeys = new Set();

// Parses appointment date and time strings into a unified JavaScript Date object
function appointmentDateTime(appointment) {
  const [time, meridiem] = appointment.time.split(' ');
  const [hourPart, minutePart] = time.split(':').map(Number);
  let hour = hourPart;

  if (meridiem === 'PM' && hour !== 12) hour += 12;
  if (meridiem === 'AM' && hour === 12) hour = 0;

  const dt = new Date(`${appointment.date}T00:00:00`);
  dt.setHours(hour, minutePart, 0, 0);
  return dt;
}

// Categorizes the reminder window based on remaining minutes until the appointment
function reminderTypeFromMinutes(minutesUntil) {
  if (minutesUntil <= 60 && minutesUntil > 0) return '1h';
  if (minutesUntil <= 24 * 60 && minutesUntil > 60) return '24h';
  return null;
}

// Sweeps through confirmed appointments and fires due email/system reminders
export async function runReminderSweep() {
  const store = isDatabaseConnected() ? dbClinicStore : clinicStore;
  const snapshot = await store.getBootstrap();
  const now = Date.now();
  const dueAppointments = snapshot.appointments.filter((appointment) => appointment.status === 'confirmed');

  const results = [];

  for (const appointment of dueAppointments) {
    const patient = snapshot.patients.find((item) => item.id === appointment.patientId);
    if (!patient?.email) continue;

    const appointmentAt = appointmentDateTime(appointment).getTime();
    const minutesUntil = Math.round((appointmentAt - now) / 60000);
    const reminderType = reminderTypeFromMinutes(minutesUntil);

    if (!reminderType) continue;

    const reminderKey = `${appointment.id}:${reminderType}`;
    if (sentReminderKeys.has(reminderKey)) continue;

    const subject = reminderType === '24h'
      ? `Reminder: appointment tomorrow with ${appointment.doctorName}`
      : `Reminder: appointment in 1 hour with ${appointment.doctorName}`;

    const text = [
      `Hello ${appointment.patientName},`,
      '',
      `This is a reminder for your ${appointment.specialty} appointment with ${appointment.doctorName}.`,
      `Date: ${appointment.date}`,
      `Time: ${appointment.time}`,
      `Hospital: ${appointment.hospital}`,
      '',
      'Please arrive on time and keep your queue tracker open for wait-time updates.',
    ].join('\n');

    const delivery = await sendReminderEmail({
      to: patient.email,
      subject,
      text,
    });

    await store.markReminderSent(appointment.id, reminderType, delivery.mode);

    await store.pushSystemNotification(
      `Reminder sent: your appointment with ${appointment.doctorName} is coming up on ${appointment.date} at ${appointment.time}.`,
      'reminder',
      'patient',
      appointment.patientId,
    );
    await store.pushSystemNotification(
      `Reminder sent to ${appointment.patientName} for appointment ${appointment.id.toUpperCase()} (${reminderType}, ${delivery.mode}).`,
      'reminder',
      'admin',
    );

    sentReminderKeys.add(reminderKey);
    results.push({ appointmentId: appointment.id, reminderType, email: patient.email, mode: delivery.mode });
  }

  return results;
}

// Sets up the periodic interval timer to run the reminder sweep
export function startReminderScheduler(pollMs) {
  setInterval(() => {
    runReminderSweep().catch((error) => {
      console.error('Reminder sweep failed:', error);
    });
  }, pollMs);
}
