import { User } from '../models/User.js';
import { Doctor } from '../models/Doctor.js';
import { Patient } from '../models/Patient.js';

import { demoUsers } from '../data/demoAuthData.js';

import {
  createAccessToken,
  hashPassword,
  sanitizeUser,
  verifyPassword,
} from '../services/authService.js';

/**
 * Seeds demo users into MongoDB database.
 * Runs only if no users currently exist.
 */
async function seedDemoUsers() {

  // Count existing users
  const count = await User.countDocuments();

  // Prevent duplicate seeding
  if (count > 0) return;

  /**
   * Convert demo users into database-ready format.
   * Passwords are hashed before saving.
   */
  const users = await Promise.all(
    demoUsers.map(async (user) => ({
      id: user.id,
      role: user.role,
      name: user.name,
      username: user.username,
      email: user.email,
      phone: user.phone,
      profileId: user.profileId,

      // Store hashed password instead of plain text
      passwordHash: await hashPassword(user.password),
    })),
  );

  // Insert all users
  await User.insertMany(users, {
    ordered: false,
  });
}

/**
 * Initializes authentication seed data.
 */
export async function initializeAuthSeed() {
  await seedDemoUsers();
}

export const dbAuthStore = {

  /**
   * Authenticates user login.
   */
  async login({
    identifier,
    password,
    role,
  }) {

    // Normalize identifier
    const normalized = identifier
      .trim()
      .toLowerCase();

    /**
     * Find user by:
     * - email
     * - username
     * and matching role
     */
    const user = await User.findOne({
      role,
      $or: [
        { email: normalized },
        { username: normalized },
      ],
    });

    // User not found
    if (!user) {
      return {
        error: 'Account not found for that role.',
      };
    }

    // Verify password
    const valid = await verifyPassword(
      password,
      user.passwordHash,
    );

    if (!valid) {
      return {
        error: 'Invalid credentials.',
      };
    }

    return {

      // Generate JWT access token
      token: createAccessToken(user),

      // Remove sensitive fields
      user: sanitizeUser(user),
    };
  },

  /**
   * Registers a new patient account.
   */
  async signupPatient(payload) {

    // Normalize email and username
    const email = payload.email
      .trim()
      .toLowerCase();

    const username = payload.username
      .trim()
      .toLowerCase();

    /**
     * Check whether email or username already exists.
     */
    const existing = await User.findOne({
      $or: [
        { email },
        { username },
      ],
    }).lean();

    if (existing) {
      return {
        error: 'Email or username is already in use.',
      };
    }

    // Generate unique IDs
    const patientId = `p${Date.now()}`;
    const userId = `u${Date.now()}`;

    /**
     * Create patient profile
     */
    await Patient.create({
      id: patientId,

      name: payload.name,

      age: Number(payload.age || 0),

      gender:
        payload.gender || 'Not specified',

      email,

      phone: payload.phone || '',

      bloodGroup:
        payload.bloodGroup || '',

      address:
        payload.address || '',

      allergies: [],
      conditions: [],

      joinedDate:
        new Date()
          .toISOString()
          .slice(0, 10),

      appointments: 0,
    });

    /**
     * Create user login account
     */
    const user = await User.create({
      id: userId,

      role: 'patient',

      name: payload.name,

      username,
      email,

      phone: payload.phone || '',

      profileId: patientId,

      // Store hashed password
      passwordHash: await hashPassword(
        payload.password,
      ),
    });

    return {
      token: createAccessToken(user),
      user: sanitizeUser(user),
    };
  },

  /**
   * Returns currently authenticated user.
   */
  async me(auth) {

    // Find user by token subject ID
    const user = await User.findOne({
      id: auth.sub,
    }).lean();

    if (!user) return null;

    return sanitizeUser(user);
  },

  /**
   * Creates new admin account.
   */
  async createAdmin(payload) {

    // Normalize values
    const email = payload.email
      .trim()
      .toLowerCase();

    const username = payload.username
      .trim()
      .toLowerCase();

    // Check duplicate email or username
    const existing = await User.findOne({
      $or: [
        { email },
        { username },
      ],
    }).lean();

    if (existing) {
      return {
        error: 'Email or username is already in use.',
      };
    }

    // Create admin user
    const user = await User.create({
      id: `u${Date.now()}`,

      role: 'admin',

      name: payload.name,

      username,
      email,

      phone: payload.phone || '',

      profileId: null,

      // Hash password before save
      passwordHash: await hashPassword(
        payload.password,
      ),
    });

    return {
      user: sanitizeUser(user),
    };
  },

  /**
   * Creates doctor account and doctor profile.
   */
  async createDoctor(payload) {

    // Normalize input
    const email = payload.email
      .trim()
      .toLowerCase();

    const username = payload.username
      .trim()
      .toLowerCase();

    // Prevent duplicate users
    const existing = await User.findOne({
      $or: [
        { email },
        { username },
      ],
    }).lean();

    if (existing) {
      return {
        error: 'Email or username is already in use.',
      };
    }

    // Generate doctor ID
    const doctorId = `d${Date.now()}`;

    /**
     * Create doctor profile
     */
    await Doctor.create({
      id: doctorId,

      name: payload.name,

      specialty: payload.specialty,

      specialtyId:
        payload.specialtyId || '',

      hospital: 'Norvic Hospital',

      experience:
        Number(payload.experience || 0),

      rating: 0,
      reviews: 0,

      image:
        payload.image ||
        'https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=400',

      price:
        Number(payload.price || 0),

      about:
        payload.about ||
        'New doctor profile.',

      /**
       * Convert education text into array.
       * Split using newline.
       */
      education: payload.education
        ? payload.education
            .split('\n')
            .map((item) => item.trim())
            .filter(Boolean)
        : [],

      availableDays:
        payload.availableDays || [],

      timeSlots:
        payload.timeSlots || [],

      status: 'active',

      patients: 0,

      licenseNumber:
        payload.licenseNumber ||
        `NMC-${Date.now()}`,

      verificationStatus: 'pending',
    });

    /**
     * Create doctor login account
     */
    const user = await User.create({
      id: `u${Date.now() + 1}`,

      role: 'doctor',

      name: payload.name,

      username,
      email,

      phone: payload.phone || '',

      profileId: doctorId,

      // Save hashed password
      passwordHash: await hashPassword(
        payload.password,
      ),
    });

    return {
      user: sanitizeUser(user),
    };
  },

  /**
   * Changes user password.
   */
  async changePassword(
    userId,
    currentPassword,
    newPassword,
  ) {

    // Find user
    const user = await User.findOne({
      id: userId,
    });

    if (!user) {
      return {
        error: 'User not found.',
      };
    }

    // Verify current password
    const valid = await verifyPassword(
      currentPassword,
      user.passwordHash,
    );

    if (!valid) {
      return {
        error: 'Current password is incorrect.',
      };
    }

    // Hash and save new password
    user.passwordHash =
      await hashPassword(newPassword);

    await user.save();

    return { ok: true };
  },
};