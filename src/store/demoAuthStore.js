import { demoUsers } from '../data/demoAuthData.js';

import { clinicStore } from './clinicStore.js';

import {
  createAccessToken,
  hashPassword,
  sanitizeUser,
  verifyPassword,
} from '../services/authService.js';

/**
 * In-memory authentication state.
 * Used only for demo mode without database.
 */
const state = {

  // Prevents reseeding users multiple times
  initialized: false,

  // Stores demo users in memory
  users: [],
};

/**
 * Loads demo users into memory
 * and hashes passwords once.
 */
async function ensureInitialized() {

  // Skip initialization if already done
  if (state.initialized) return;

  /**
   * Hash all demo user passwords
   * before storing them in memory.
   */
  state.users = await Promise.all(

    demoUsers.map(async (user) => ({

      ...user,

      passwordHash:
        await hashPassword(user.password),

    })),
  );

  // Mark initialization complete
  state.initialized = true;
}

export const demoAuthStore = {

  /**
   * Handles user login.
   */
  async login({
    identifier,
    password,
    role,
  }) {

    await ensureInitialized();

    // Normalize email/username input
    const normalized =
      identifier.trim().toLowerCase();

    /**
     * Find matching user
     * based on role and identifier.
     */
    const user =
      state.users.find((item) => (

        item.role === role &&

        (
          item.email.toLowerCase() === normalized ||

          item.username.toLowerCase() === normalized
        )
      ));

    // User not found
    if (!user) {

      return {
        error:
          'Account not found for that role.',
      };
    }

    /**
     * Verify entered password.
     */
    const valid =
      await verifyPassword(
        password,
        user.passwordHash,
      );

    // Invalid password
    if (!valid) {

      return {
        error:
          'Invalid credentials.',
      };
    }

    /**
     * Return JWT token
     * and sanitized user object.
     */
    return {

      token:
        createAccessToken(user),

      user:
        sanitizeUser(user),
    };
  },

  /**
   * Registers a new patient account.
   */
  async signupPatient(payload) {

    await ensureInitialized();

    // Normalize email and username
    const email =
      payload.email.trim().toLowerCase();

    const username =
      payload.username.trim().toLowerCase();

    /**
     * Check duplicate email/username.
     */
    if (

      state.users.some((user) => (

        user.email.toLowerCase() === email ||

        user.username.toLowerCase() === username
      ))
    ) {

      return {
        error:
          'Email or username is already in use.',
      };
    }

    // Generate IDs
    const patientId =
      `p${Date.now()}`;

    const userId =
      `u${Date.now()}`;

    /**
     * Hash new password.
     */
    const passwordHash =
      await hashPassword(payload.password);

    /**
     * Create patient profile
     * inside clinic store.
     */
    clinicStore.registerPatientProfile({

      id: patientId,

      name: payload.name,

      age:
        Number(payload.age || 0),

      gender:
        payload.gender || 'Not specified',

      email,

      phone:
        payload.phone || '',

      bloodGroup:
        payload.bloodGroup || '',

      joinedDate:
        new Date()
          .toISOString()
          .slice(0, 10),

      address:
        payload.address || '',

      appointments: 0,

      allergies: [],

      conditions: [],
    });

    /**
     * Create auth user object.
     */
    const user = {

      id: userId,

      role: 'patient',

      name: payload.name,

      username,

      email,

      phone:
        payload.phone || '',

      profileId: patientId,

      passwordHash,
    };

    // Store user in memory
    state.users.unshift(user);

    /**
     * Return token and user.
     */
    return {

      token:
        createAccessToken(user),

      user:
        sanitizeUser(user),
    };
  },

  /**
   * Returns current authenticated user.
   */
  async me(auth) {

    await ensureInitialized();

    // Find user by token subject
    const user =
      state.users.find(
        (item) =>
          item.id === auth.sub,
      );

    if (!user) return null;

    return sanitizeUser(user);
  },

  /**
   * Creates a new admin account.
   */
  async createAdmin(payload) {

    await ensureInitialized();

    // Normalize values
    const email =
      payload.email.trim().toLowerCase();

    const username =
      payload.username.trim().toLowerCase();

    /**
     * Prevent duplicate accounts.
     */
    if (

      state.users.some((user) => (

        user.email.toLowerCase() === email ||

        user.username.toLowerCase() === username
      ))
    ) {

      return {
        error:
          'Email or username is already in use.',
      };
    }

    /**
     * Create admin user.
     */
    const user = {

      id:
        `u${Date.now()}`,

      role: 'admin',

      name:
        payload.name,

      username,

      email,

      phone:
        payload.phone || '',

      profileId: null,

      passwordHash:
        await hashPassword(payload.password),
    };

    // Save admin in memory
    state.users.unshift(user);

    return {
      user:
        sanitizeUser(user),
    };
  },

  /**
   * Creates doctor account
   * and doctor clinic profile.
   */
  async createDoctor(payload) {

    await ensureInitialized();

    // Normalize email and username
    const email =
      payload.email.trim().toLowerCase();

    const username =
      payload.username.trim().toLowerCase();

    /**
     * Check duplicates.
     */
    if (

      state.users.some((user) => (

        user.email.toLowerCase() === email ||

        user.username.toLowerCase() === username
      ))
    ) {

      return {
        error:
          'Email or username is already in use.',
      };
    }

    // Generate doctor ID
    const doctorId =
      `d${Date.now()}`;

    /**
     * Create auth user.
     */
    const user = {

      id:
        `u${Date.now() + 1}`,

      role: 'doctor',

      name:
        payload.name,

      username,

      email,

      phone:
        payload.phone || '',

      profileId:
        doctorId,

      passwordHash:
        await hashPassword(payload.password),
    };

    /**
     * Register doctor profile
     * in clinic store.
     */
    clinicStore.registerDoctorProfile({

      id: doctorId,

      name:
        payload.name,

      specialty:
        payload.specialty,

      specialtyId:
        payload.specialtyId || '',

      hospital:
        'Norvic Hospital',

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
        payload.about || 'New doctor profile.',

      /**
       * Convert multiline education
       * into array format.
       */
      education:

        payload.education

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

      verificationStatus:
        'pending',
    });

    // Save user
    state.users.unshift(user);

    return {
      user:
        sanitizeUser(user),
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

    await ensureInitialized();

    // Find user
    const user =
      state.users.find(
        (item) =>
          item.id === userId,
      );

    if (!user) {

      return {
        error:
          'User not found.',
      };
    }

    /**
     * Verify current password.
     */
    const valid =
      await verifyPassword(
        currentPassword,
        user.passwordHash,
      );

    if (!valid) {

      return {
        error:
          'Current password is incorrect.',
      };
    }

    /**
     * Save new hashed password.
     */
    user.passwordHash =
      await hashPassword(newPassword);

    return {
      ok: true,
    };
  },
};