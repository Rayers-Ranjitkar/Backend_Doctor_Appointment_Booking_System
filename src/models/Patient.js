// Mongoose schema definition for the Patient model
import mongoose from 'mongoose';

const patientSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    age: Number,
    gender: String,
    email: { type: String, required: true },
    phone: String,
    bloodGroup: String,
    address: String,
    allergies: [String],
    conditions: [String],
    joinedDate: String,
    appointments: Number,
  },
  { timestamps: true },
);

export const Patient = mongoose.models.Patient || mongoose.model('Patient', patientSchema);
