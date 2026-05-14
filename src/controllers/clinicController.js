import { isDatabaseConnected } from '../config/database.js';
import { dbClinicStore } from '../store/dbClinicStore.js';
import { clinicStore } from '../store/clinicStore.js';
import { dbAssistantChatStore } from '../store/dbAssistantChatStore.js';
import { assistantChatStore } from '../store/assistantChatStore.js';
import { runReminderSweep } from '../services/reminderService.js';

function activeStore() {
  return isDatabaseConnected() ? dbClinicStore : clinicStore;
}

function activeAssistantChatStore() {
  return isDatabaseConnected() ? dbAssistantChatStore : assistantChatStore;
}

export async function getBootstrap(req, res) {
  res.json(await activeStore().getBootstrap(req.auth));  // req.auth — set by authMiddleware
}

export async function getQueue(req, res) {
  const result = await activeStore().getQueue(req.auth);
  res.json(result);
}

export async function bookAppointment(req, res) {
  const result = await activeStore().bookAppointment(req.body);
  if (result.error) return res.status(400).json(result);
  return res.status(201).json(result);
}

export async function updateAppointment(req, res) {
  const result = await activeStore().updateAppointment(req.params.id, req.body);
  if (result.error) return res.status(400).json(result);
  return res.json(result);
}

export async function addPrescription(req, res) {
  const prescription = await activeStore().addPrescription(req.body);
  res.status(201).json({ prescription });
}

export async function updatePrescription(req, res) {
  const result = await activeStore().updatePrescription(req.params.id, req.body);
  if (result.error) return res.status(404).json(result);
  return res.json(result);
}

export async function updateQueue(req, res) {
  const result = await activeStore().updateQueue(req.params.id, req.body);
  if (result.error) return res.status(404).json(result);
  return res.json(result);
}

export async function addReview(req, res) {
  const result = await activeStore().addReview(req.body);
  if (result.error) return res.status(400).json(result);
  return res.status(201).json(result);
}

export async function verifyDoctor(req, res) {
  const result = await activeStore().verifyDoctor(req.params.id, req.body.verificationStatus);
  if (result.error) return res.status(404).json(result);
  return res.json(result);
}

export async function askAssistant(req, res) {
  res.json(await activeStore().askAssistant(req.body.prompt || ''));
}

export async function triggerReminders(_req, res) {
  const results = await runReminderSweep();
  res.json({ sent: results.length, results });
}

// ─── NEW ──────────────────────────────────────────────────────────────────────

export async function updateDoctorSchedule(req, res) {
  const result = await activeStore().updateDoctorSchedule(req.params.id, req.body);
  if (result.error) return res.status(404).json(result);
  return res.json(result);
}

export async function deletePatient(req, res) {
  const result = await activeStore().deletePatient(req.params.id);
  if (result.error) return res.status(404).json(result);
  return res.json(result);
}

export async function addSpecialty(req, res) {
  const result = await activeStore().addSpecialty(req.body);
  if (result.error) return res.status(400).json(result);
  return res.status(201).json(result);
}

export async function updateSpecialty(req, res) {
  const result = await activeStore().updateSpecialty(req.params.id, req.body);
  if (result.error) return res.status(404).json(result);
  return res.json(result);
}

export async function deleteSpecialty(req, res) {
  const result = await activeStore().deleteSpecialty(req.params.id);
  if (result.error) return res.status(404).json(result);
  return res.json(result);
}

export async function markAllNotificationsRead(req, res) {
  const result = await activeStore().markAllNotificationsRead(req.auth);
  res.json(result);
}

export async function initiateKhaltiPaymentForAppointment(req, res) {
  const result = await activeStore().initiateKhaltiAppointmentPayment(req.body);
  if (result.error) return res.status(400).json(result);
  return res.status(201).json(result);
}

export async function verifyKhaltiPaymentForAppointment(req, res) {
  const pidx = (req.body?.pidx || '').toString().trim();
  if (!pidx) return res.status(400).json({ error: 'pidx is required.' });
  const result = await activeStore().verifyKhaltiAppointmentPayment(pidx);
  if (result.error) return res.status(400).json(result);
  return res.json(result);
}

// ─── MediBook AI Chat History ──────────────────────────────────────────────

export async function createAssistantChat(req, res) {
  const result = await activeAssistantChatStore().createChat(req.auth);
  res.status(201).json(result);
}

export async function listAssistantChats(req, res) {
  res.json(await activeAssistantChatStore().listChats(req.auth));
}

export async function getAssistantChatMessages(req, res) {
  const result = await activeAssistantChatStore().getChatMessages(req.params.id, req.auth);
  if (result?.error) return res.status(404).json(result);
  res.json(result);
}

export async function sendAssistantChatMessage(req, res) {
  const prompt = (req.body?.prompt || '').toString().trim();
  if (!prompt) return res.status(400).json({ error: 'Prompt is required.' });
  if (prompt.length > 2000) return res.status(400).json({ error: 'Prompt is too long.' });

  const threadId = req.params.id;

  const userStoreResult = await activeAssistantChatStore().storeUserMessage(threadId, req.auth, prompt);
  if (userStoreResult?.error) return res.status(404).json(userStoreResult);

  const contextResult = await activeAssistantChatStore().getConversationContext(threadId, req.auth, 12);
  if (contextResult?.error) return res.status(404).json(contextResult);

  const assistantReply = await activeStore().askAssistant(
    prompt,
    contextResult.messages.slice(0, -1),
  );

  const assistantStoreResult = await activeAssistantChatStore().storeAssistantMessage(
    threadId,
    req.auth,
    assistantReply,
  );
  if (assistantStoreResult?.error) return res.status(404).json(assistantStoreResult);

  res.json(assistantReply);
}

export async function deleteAssistantChat(req, res) {
  const result = await activeAssistantChatStore().deleteChat(req.params.id, req.auth);
  if (result?.error) return res.status(404).json(result);
  res.json(result);
}