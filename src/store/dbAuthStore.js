import { User } from '../models/User.js';
import { Doctor } from '../models/Doctor.js';
import { Patient } from '../models/Patient.js';
import { demoUsers } from '../data/demoAuthData.js';
import { createAccessToken, hashPassword, sanitizeUser, verifyPassword } from '../services/authService.js';

async function seedDemoUsers() {
  const count = await User.countDocuments();
  if (count > 0) return;

  const users = await Promise.all(
    demoUsers.map(async (user) => ({
      id: user.id,
      role: user.role,
      name: user.name,
      username: user.username,
      email: user.email,
      phone: user.phone,
      profileId: user.profileId,
      passwordHash: await hashPassword(user.password),
    })),
  );

  await User.insertMany(users, { ordered: false });
}

export async function initializeAuthSeed() {
  await seedDemoUsers();
}

export const dbAuthStore = {
  async login({ identifier, password, role }) {
    const normalized = identifier.trim().toLowerCase();
    const user = await User.findOne({
      role,
      $or: [
        { email: normalized },
        { username: normalized },
      ],
    });

    if (!user) return { error: 'Account not found for that role.' };

    const valid = await verifyPassword(password, user.passwordHash);
    if (!valid) return { error: 'Invalid credentials.' };

    return {
      token: createAccessToken(user),
      user: sanitizeUser(user),
    };
  },

  async signupPatient(payload) {
    const email = payload.email.trim().toLowerCase();
    const username = payload.username.trim().toLowerCase();

    const existing = await User.findOne({
      $or: [{ email }, { username }],
    }).lean();
    if (existing) {
      return { error: 'Email or username is already in use.' };
    }

    const patientId = `p${Date.now()}`;
    const userId = `u${Date.now()}`;

    await Patient.create({
      id: patientId,
      name: payload.name,
      age: Number(payload.age || 0),
      gender: payload.gender || 'Not specified',
      email,
      phone: payload.phone || '',
      bloodGroup: payload.bloodGroup || '',
      address: payload.address || '',
      allergies: [],
      conditions: [],
      joinedDate: new Date().toISOString().slice(0, 10),
      appointments: 0,
    });

    const user = await User.create({
      id: userId,
      role: 'patient',
      name: payload.name,
      username,
      email,
      phone: payload.phone || '',
      profileId: patientId,
      passwordHash: await hashPassword(payload.password),
    });

    return {
      token: createAccessToken(user),
      user: sanitizeUser(user),
    };
  },

  async me(auth) {
    const user = await User.findOne({ id: auth.sub }).lean();
    if (!user) return null;
    return sanitizeUser(user);
  },

  async createAdmin(payload) {
    const email = payload.email.trim().toLowerCase();
    const username = payload.username.trim().toLowerCase();
    const existing = await User.findOne({ $or: [{ email }, { username }] }).lean();
    if (existing) {
      return { error: 'Email or username is already in use.' };
    }

    const user = await User.create({
      id: `u${Date.now()}`,
      role: 'admin',
      name: payload.name,
      username,
      email,
      phone: payload.phone || '',
      profileId: null,
      passwordHash: await hashPassword(payload.password),
    });

    return { user: sanitizeUser(user) };
  },

  async createDoctor(payload) {
    const email = payload.email.trim().toLowerCase();
    const username = payload.username.trim().toLowerCase();
    const existing = await User.findOne({ $or: [{ email }, { username }] }).lean();
    if (existing) {
      return { error: 'Email or username is already in use.' };
    }

    const doctorId = `d${Date.now()}`;
    await Doctor.create({
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

    const user = await User.create({
      id: `u${Date.now() + 1}`,
      role: 'doctor',
      name: payload.name,
      username,
      email,
      phone: payload.phone || '',
      profileId: doctorId,
      passwordHash: await hashPassword(payload.password),
    });

    return { user: sanitizeUser(user) };
  },

  async changePassword(userId, currentPassword, newPassword) {
    const user = await User.findOne({ id: userId });
    if (!user) return { error: 'User not found.' };

    const valid = await verifyPassword(currentPassword, user.passwordHash);
    if (!valid) return { error: 'Current password is incorrect.' };

    user.passwordHash = await hashPassword(newPassword);
    await user.save();
    return { ok: true };
  },
};
