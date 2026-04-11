import { isDatabaseConnected } from '../config/database.js';
import { dbClinicStore } from '../store/dbClinicStore.js';
import { clinicStore } from '../store/clinicStore.js';
import { runReminderSweep } from '../services/reminderService.js';

/* Decide which store to use (DB or local) */
function activeStore() {
  return isDatabaseConnected() ? dbClinicStore : clinicStore;
}

/* Get appointments + payments data */
export async function getBootstrap(req, res) {
  res.json(await activeStore().getBootstrap(req.auth));
}

/* Book new appointment */
export async function bookAppointment(req, res) {
  const result = await activeStore().bookAppointment(req.body);

  if (result.error) return res.status(400).json(result);

  return res.status(201).json(result);
}

/* Update appointment */
export async function updateAppointment(req, res) {
  const result = await activeStore().updateAppointment(
    req.params.id,
    req.body
  );

  if (result.error) return res.status(400).json(result);

  return res.json(result);
}

/* Create payment for an appointment */
export async function createPayment(req, res) {
  const result = await activeStore().createPayment(req.body);

  if (result.error) return res.status(400).json(result);

  return res.status(201).json(result);
}

/* Trigger reminder system */
export async function triggerReminders(_req, res) {
  const results = await runReminderSweep();
  res.json({ sent: results.length, results });
}