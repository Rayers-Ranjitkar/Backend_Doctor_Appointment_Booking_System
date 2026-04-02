import { isDatabaseConnected } from '../config/database.js';
import { dbAuthStore } from '../store/dbAuthStore.js';
import { demoAuthStore } from '../store/demoAuthStore.js';

// Decide which auth store to use (DB or in-memory demo)
function activeAuthStore() {
  return isDatabaseConnected() ? dbAuthStore : demoAuthStore;
}

// LOGIN USER
export async function login(req, res) {
  // Pass request body to auth store login method
  const result = await activeAuthStore().login(req.body);

  // If login fails (wrong credentials, etc.)
  if (result.error) {
    return res.status(401).json(result);
  }

  // If login successful
  return res.json(result);
}

// Check if current user is admin
function requireAdmin(req, res) {
  if (req.auth?.role !== 'admin') {
    res.status(403).json({ error: 'Admin access required.' });
    return false;
  }
  return true;
}

// SIGNUP PATIENT
export async function signupPatient(req, res) {
  const result = await activeAuthStore().signupPatient(req.body);

  // If validation or signup error
  if (result.error) {
    return res.status(400).json(result);
  }

  // Success response
  return res.status(201).json(result);
}

// CREATE ADMIN (Protected route)
export async function createAdmin(req, res) {
  if (!requireAdmin(req, res)) return;

  const result = await activeAuthStore().createAdmin(req.body);

  if (result.error) {
    return res.status(400).json(result);
  }

  return res.status(201).json(result);
}

// CREATE DOCTOR (Protected route)
export async function createDoctor(req, res) {
  if (!requireAdmin(req, res)) return;

  const result = await activeAuthStore().createDoctor(req.body);

  if (result.error) {
    return res.status(400).json(result);
  }

  return res.status(201).json(result);
}

// GET CURRENT LOGGED-IN USER
export async function me(req, res) {
  // req.auth comes from auth middleware (decoded JWT)
  const user = await activeAuthStore().me(req.auth);

  if (!user) {
    return res.status(404).json({ error: 'User not found.' });
  }

  return res.json({ user });
}

// CHANGE PASSWORD
export async function changePassword(req, res) {
  const result = await activeAuthStore().changePassword(
    req.auth.sub, // user ID from token
    req.body.currentPassword,
    req.body.newPassword
  );

  if (result.error) {
    return res.status(400).json(result);
  }

  return res.json(result);
}