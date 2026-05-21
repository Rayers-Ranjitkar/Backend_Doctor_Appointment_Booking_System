import { isDatabaseConnected } from '../config/database.js';
import { dbAuthStore } from '../store/dbAuthStore.js';
import { demoAuthStore } from '../store/demoAuthStore.js';

function activeAuthStore() {
  return isDatabaseConnected() ? dbAuthStore : demoAuthStore;
}

export async function login(req, res) {
  const result = await activeAuthStore().login(req.body);
  if (result.error) {
    return res.status(401).json(result);
  }
  return res.json(result);
}

function requireAdmin(req, res) {
  if (req.auth?.role !== 'admin') {
    res.status(403).json({ error: 'Admin access required.' });
    return false;
  }
  return true;
}

export async function signupPatient(req, res) {
  const result = await activeAuthStore().signupPatient(req.body);
  if (result.error) {
    return res.status(400).json(result);
  }
  return res.status(201).json(result);
}

export async function createAdmin(req, res) {
  if (!requireAdmin(req, res)) return;
  const result = await activeAuthStore().createAdmin(req.body);
  if (result.error) {
    return res.status(400).json(result);
  }
  return res.status(201).json(result);
}

export async function createDoctor(req, res) {
  if (!requireAdmin(req, res)) return;
  const result = await activeAuthStore().createDoctor(req.body);
  if (result.error) {
    return res.status(400).json(result);
  }
  return res.status(201).json(result);
}

export async function me(req, res) {
  const user = await activeAuthStore().me(req.auth);
  if (!user) {
    return res.status(404).json({ error: 'User not found.' });
  }
  return res.json({ user });
}

export async function changePassword(req, res) {
  const result = await activeAuthStore().changePassword(req.auth.sub, req.body.currentPassword, req.body.newPassword);
  if (result.error) {
    return res.status(400).json(result);
  }
  return res.json(result);
}
