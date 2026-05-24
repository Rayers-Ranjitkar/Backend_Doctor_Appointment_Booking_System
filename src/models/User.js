// Mongoose schema definition for the User model
import mongoose from 'mongoose';

const userSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true },
    role: { type: String, enum: ['patient', 'doctor', 'admin'], required: true },
    name: { type: String, required: true },
    username: { type: String, required: true, unique: true },
    email: { type: String, required: true, unique: true },
    phone: String,
    passwordHash: { type: String, required: true },
    profileId: String,
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true, versionKey: false },
);

export const User = mongoose.models.User || mongoose.model('User', userSchema);
