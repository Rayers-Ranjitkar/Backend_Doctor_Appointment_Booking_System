import { demoUsers } from '../data/demoAuthData.js';
import { clinicStore } from './clinicStore.js';
import { createAccessToken, hashPassword, sanitizeUser, verifyPassword } from '../services/authService.js';

const state = {
  initialized: false,
  users: [],
};

async function ensureInitialized() {
  if (state.initialized) return;

  state.users = await Promise.all(
    demoUsers.map(async (user) => ({
      ...user,
      passwordHash: await hashPassword(user.password),
    })),
  );
  state.initialized = true;
}

export const demoAuthStore = {
  async login({ identifier, password, role }) {
    await ensureInitialized();

    const normalized = identifier.trim().toLowerCase();
    const user = state.users.find((item) => (
      item.role === role &&
      (item.email.toLowerCase() === normalized || item.username.toLowerCase() === normalized)
    ));

    if (!user) {
      return { error: 'Account not found for that role.' };
    }

    const valid = await verifyPassword(password, user.passwordHash);
    if (!valid) {
      return { error: 'Invalid credentials.' };
    }

    return {
      token: createAccessToken(user),
      user: sanitizeUser(user),
    };
  },

  async signupPatient(payload) {
    await ensureInitialized();

    const email = payload.email.trim().toLowerCase();
    const username = payload.username.trim().toLowerCase();
    if (state.users.some((user) => user.email.toLowerCase() === email || user.username.toLowerCase() === username)) {
      return { error: 'Email or username is already in use.' };
    }

    const patientId = `p${Date.now()}`;
    const userId = `u${Date.now()}`;
    const passwordHash = await hashPassword(payload.password);

    clinicStore.registerPatientProfile({
      id: patientId,
      name: payload.name,
      age: Number(payload.age || 0),
      gender: payload.gender || 'Not specified',
      email,
      phone: payload.phone || '',
      bloodGroup: payload.bloodGroup || '',
      joinedDate: new Date().toISOString().slice(0, 10),
      address: payload.address || '',
      appointments: 0,
      allergies: [],
      conditions: [],
    });

    const user = {
      id: userId,
      role: 'patient',
      name: payload.name,
      username,
      email,
      phone: payload.phone || '',
      profileId: patientId,
      passwordHash,
    };
    state.users.unshift(user);

    return {
      token: createAccessToken(user),
      user: sanitizeUser(user),
    };
  },

  async me(auth) {
    await ensureInitialized();
    const user = state.users.find((item) => item.id === auth.sub);
    if (!user) return null;
    return sanitizeUser(user);
  },

  async createAdmin(payload) {
    await ensureInitialized();
    const email = payload.email.trim().toLowerCase();
    const username = payload.username.trim().toLowerCase();
    if (state.users.some((user) => user.email.toLowerCase() === email || user.username.toLowerCase() === username)) {
      return { error: 'Email or username is already in use.' };
    }

    const user = {
      id: `u${Date.now()}`,
      role: 'admin',
      name: payload.name,
      username,
      email,
      phone: payload.phone || '',
      profileId: null,
      passwordHash: await hashPassword(payload.password),
    };

    state.users.unshift(user);
    return { user: sanitizeUser(user) };
  },

  async createDoctor(payload) {
    await ensureInitialized();
    const email = payload.email.trim().toLowerCase();
    const username = payload.username.trim().toLowerCase();
    if (state.users.some((user) => user.email.toLowerCase() === email || user.username.toLowerCase() === username)) {
      return { error: 'Email or username is already in use.' };
    }

    const doctorId = `d${Date.now()}`;
    const user = {
      id: `u${Date.now() + 1}`,
      role: 'doctor',
      name: payload.name,
      username,
      email,
      phone: payload.phone || '',
      profileId: doctorId,
      passwordHash: await hashPassword(payload.password),
    };

    clinicStore.registerDoctorProfile({
      id: doctorId,
      name: payload.name,
      specialty: payload.specialty,
      specialtyId: payload.specialtyId || '',
      hospital: 'Norvic Hospital',
      experience: Number(payload.experience || 0),
      rating: 0,
      reviews: 0,
      image: payload.image || 'https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=400',
      price: Number(payload.price || 0),
      about: payload.about || 'New doctor profile.',
      education: payload.education ? payload.education.split('\n').map((item) => item.trim()).filter(Boolean) : [],
      availableDays: payload.availableDays || [],
      timeSlots: payload.timeSlots || [],
      status: 'active',
      patients: 0,
      licenseNumber: payload.licenseNumber || `NMC-${Date.now()}`,
      verificationStatus: 'pending',
    });

    state.users.unshift(user);
    return { user: sanitizeUser(user) };
  },

  async changePassword(userId, currentPassword, newPassword) {
    await ensureInitialized();
    const user = state.users.find((item) => item.id === userId);
    if (!user) return { error: 'User not found.' };

    const valid = await verifyPassword(currentPassword, user.passwordHash);
    if (!valid) return { error: 'Current password is incorrect.' };

    user.passwordHash = await hashPassword(newPassword);
    return { ok: true };
  },
};
