import mongoose from 'mongoose';

const userSchema = new mongoose.Schema(
  {
    // Stable external identifier for authentication and referencing
    id: { type: String, required: true, unique: true },

    role: {
      type: String,
      enum: ['patient', 'doctor', 'admin'],
      required: true,
    },

    name: { type: String, required: true },

    username: { type: String, required: true, unique: true },

    email: { type: String, required: true, unique: true },

    phone: String,

    // Hashed password stored for authentication
    passwordHash: { type: String, required: true },

    // Links user account to domain-specific profile (doctor/patient)
    profileId: String,

    isActive: { type: Boolean, default: true },
  },
  { timestamps: true, versionKey: false },
);

export const User =
  mongoose.models.User || mongoose.model('User', userSchema);