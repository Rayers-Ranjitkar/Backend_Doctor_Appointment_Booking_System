import mongoose from 'mongoose';

const specialtySchema = new mongoose.Schema(
  {
    // Stable external identifier for specialty tracking
    id: { type: String, required: true, unique: true },

    name: { type: String, required: true },

    icon: String,
    color: String,

    doctorCount: Number,
  },
  { timestamps: true },
);

export const Specialty =
  mongoose.models.Specialty || mongoose.model('Specialty', specialtySchema);