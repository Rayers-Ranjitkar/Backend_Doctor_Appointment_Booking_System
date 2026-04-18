import { isDatabaseConnected } from '../config/database.js';
import { dbClinicStore } from '../store/dbClinicStore.js';
import { clinicStore } from '../store/clinicStore.js';
import { runReminderSweep } from '../services/reminderService.js';

/* Select active data store (database or in-memory) */
function activeStore() {
  return isDatabaseConnected() ? dbClinicStore : clinicStore;
}

/* Get initial data (appointments, payments, etc.) */
export async function getBootstrap(req, res) {
  res.json(await activeStore().getBootstrap(req.auth));  // req.auth set by authMiddleware
}

/* Book a new appointment */
export async function bookAppointment(req, res) {
  const result = await activeStore().bookAppointment(req.body);
  if (result.error) return res.status(400).json(result);
  return res.status(201).json(result);
}

/* Update an existing appointment */
export async function updateAppointment(req, res) {
  const result = await activeStore().updateAppointment(req.params.id, req.body);
  if (result.error) return res.status(400).json(result);
  return res.json(result);
}

/* Add prescription for a patient */
export async function addPrescription(req, res) {
  const prescription = await activeStore().addPrescription(req.body);
  res.status(201).json({ prescription });
}

/* Update prescription details */
export async function updatePrescription(req, res) {
  const result = await activeStore().updatePrescription(req.params.id, req.body);
  if (result.error) return res.status(404).json(result);
  return res.json(result);
}

/* Update queue position/status */
export async function updateQueue(req, res) {
  const result = await activeStore().updateQueue(req.params.id, req.body);
  if (result.error) return res.status(404).json(result);
  return res.json(result);
}

/* Add review after appointment completion */
export async function addReview(req, res) {
  const result = await activeStore().addReview(req.body);
  if (result.error) return res.status(400).json(result);
  return res.status(201).json(result);
}

/* Verify doctor profile */
export async function verifyDoctor(req, res) {
  const result = await activeStore().verifyDoctor(req.params.id, req.body.verificationStatus);
  if (result.error) return res.status(404).json(result);
  return res.json(result);
}

/* AI assistant query handler */
export async function askAssistant(req, res) {
  res.json(await activeStore().askAssistant(req.body.prompt || ''));
}

/* Trigger reminder notifications (cron/manual) */
export async function triggerReminders(_req, res) {
  const results = await runReminderSweep();
  res.json({ sent: results.length, results });
}


/* Update doctor's available schedule */
export async function updateDoctorSchedule(req, res) {
  const result = await activeStore().updateDoctorSchedule(req.params.id, req.body);
  if (result.error) return res.status(404).json(result);
  return res.json(result);
}

/* Delete a patient from system */
export async function deletePatient(req, res) {
  const result = await activeStore().deletePatient(req.params.id);
  if (result.error) return res.status(404).json(result);
  return res.json(result);
}

/* Add a new specialty */
export async function addSpecialty(req, res) {
  const result = await activeStore().addSpecialty(req.body);
  if (result.error) return res.status(400).json(result);
  return res.status(201).json(result);
}

/* Update specialty details */
export async function updateSpecialty(req, res) {
  const result = await activeStore().updateSpecialty(req.params.id, req.body);
  if (result.error) return res.status(404).json(result);
  return res.json(result);
}

/* Delete a specialty */
export async function deleteSpecialty(req, res) {
  const result = await activeStore().deleteSpecialty(req.params.id);
  if (result.error) return res.status(404).json(result);
  return res.json(result);
}

/* Mark all notifications as read */
export async function markAllNotificationsRead(req, res) {
  const result = await activeStore().markAllNotificationsRead(req.auth);
  res.json(result);
}