import { isDatabaseConnected } from '../config/database.js';
import { dbAuthStore } from '../store/dbAuthStore.js';
import { demoAuthStore } from '../store/demoAuthStore.js';

// Selects the active auth store (MongoDB vs in-memory demo store) based on DB connectivity
function activeAuthStore() {
  return isDatabaseConnected() ? dbAuthStore : demoAuthStore;
}

// Controller handling user login
export async function login(req, res) {
  const result = await activeAuthStore().login(req.body);
  if (result.error) {
    return res.status(401).json(result);
  }
  return res.json(result);
}

// Helper middleware-like function to verify administrative privileges
function requireAdmin(req, res) {
  if (req.auth?.role !== 'admin') {
    res.status(403).json({ error: 'Admin access required.' });
    return false;
  }
  return true;
}

// Controller handling patient self-registration
export async function signupPatient(req, res) {
  const result = await activeAuthStore().signupPatient(req.body);
  if (result.error) {
    return res.status(400).json(result);
  }
  return res.status(201).json(result);
}

// Controller handling administrator account creation by an existing admin
export async function createAdmin(req, res) {
  if (!requireAdmin(req, res)) return;
  const result = await activeAuthStore().createAdmin(req.body);
  if (result.error) {
    return res.status(400).json(result);
  }
  return res.status(201).json(result);
}

// Controller handling doctor account creation by an existing admin
export async function createDoctor(req, res) {
  if (!requireAdmin(req, res)) return;
  const result = await activeAuthStore().createDoctor(req.body);
  if (result.error) {
    return res.status(400).json(result);
  }
  return res.status(201).json(result);
}

// Controller handling retrieval of current authenticated user profile
export async function me(req, res) {
  const user = await activeAuthStore().me(req.auth);
  if (!user) {
    return res.status(404).json({ error: 'User not found.' });
  }
  return res.json({ user });
}

// Controller handling password change requests for the authenticated user
export async function changePassword(req, res) {
  const result = await activeAuthStore().changePassword(req.auth.sub, req.body.currentPassword, req.body.newPassword);
  if (result.error) {
    return res.status(400).json(result);
  }
  return res.json(result);
}
