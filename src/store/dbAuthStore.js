import { User } from '../models/User.js';
import { Doctor } from '../models/Doctor.js';
import { Patient } from '../models/Patient.js';
import { demoUsers } from '../data/demoAuthData.js';
import {
  createAccessToken,
  hashPassword,
  sanitizeUser,
  verifyPassword,
} from '../services/authservice.js';

// Seed demo users into database if empty
async function seedDemoUsers() {
  const count = await User.countDocuments();

  // If users already exist, skip seeding
  if (count > 0) return;

  // Prepare users with hashed passwords
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
    }))
  );

  // Insert users into database
  await User.insertMany(users, { ordered: false });
}

// Initialize auth seed (called at startup)
export async function initializeAuthSeed() {
  await seedDemoUsers();
}

// Main Auth Store (Database version)
export const dbAuthStore = {
  
  // 🔐 Login user
  async login({ identifier, password, role }) {
    const normalized = identifier.trim().toLowerCase();

    // Find user by email or username and role
    const user = await User.findOne({
      role,
      $or: [{ email: normalized }, { username: normalized }],
    });

    if (!user) return { error: 'Account not found for that role.' };

    // Verify password
    const valid = await verifyPassword(password, user.passwordHash);
    if (!valid) return { error: 'Invalid credentials.' };

    // Return token + user info
    return {
      token: createAccessToken(user),
      user: sanitizeUser(user),
    };
  },

  // 🧑‍⚕️ Patient signup
  async signupPatient(payload) {
    const email = payload.email.trim().toLowerCase();
    const username = payload.username.trim().toLowerCase();

    // Check if user already exists
    const existing = await User.findOne({
      $or: [{ email }, { username }],
    }).lean();

    if (existing) {
      return { error: 'Email or username is already in use.' };
    }

    const patientId = `p${Date.now()}`;
    const userId = `u${Date.now()}`;

    // Create patient profile
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

    // Create user account
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

  // 👤 Get current user info
  async me(auth) {
    const user = await User.findOne({ id: auth.sub }).lean();
    if (!user) return null;

    return sanitizeUser(user);
  },

  // 🛡️ Create admin (admin only)
  async createAdmin(payload) {
    const email = payload.email.trim().toLowerCase();
    const username = payload.username.trim().toLowerCase();

    const existing = await User.findOne({
      $or: [{ email }, { username }],
    }).lean();

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

  // 🧑‍⚕️ Create doctor (admin only)
  async createDoctor(payload) {
    const email = payload.email.trim().toLowerCase();
    const username = payload.username.trim().toLowerCase();

    const existing = await User.findOne({
      $or: [{ email }, { username }],
    }).lean();

    if (existing) {
      return { error: 'Email or username is already in use.' };
    }

    const doctorId = `d${Date.now()}`;

    // Create doctor profile
    await Doctor.create({
      id: doctorId,
      name: payload.name,
      specialty: payload.specialty,
      specialtyId: payload.specialtyId || '',
      hospital: 'Norvic Hospital',
      experience: Number(payload.experience || 0),
      rating: 0,
      reviews: 0,
      image:
        payload.image ||
        'https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=400',
      price: Number(payload.price || 0),
      about: payload.about || 'New doctor profile.',
      education: payload.education
        ? payload.education
            .split('\n')
            .map((item) => item.trim())
            .filter(Boolean)
        : [],
      availableDays: payload.availableDays || [],
      timeSlots: payload.timeSlots || [],
      status: 'active',
      patients: 0,
      licenseNumber: payload.licenseNumber || `NMC-${Date.now()}`,
      verificationStatus: 'pending',
    });

    // Create user account for doctor
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

  // 🔑 Change password
  async changePassword(userId, currentPassword, newPassword) {
    const user = await User.findOne({ id: userId });
    if (!user) return { error: 'User not found.' };

    // Verify current password
    const valid = await verifyPassword(
      currentPassword,
      user.passwordHash
    );
    if (!valid) {
      return { error: 'Current password is incorrect.' };
    }

    // Update password
    user.passwordHash = await hashPassword(newPassword);
    await user.save();

    return { ok: true };
  },
};