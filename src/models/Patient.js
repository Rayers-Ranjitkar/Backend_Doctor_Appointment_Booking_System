import mongoose from 'mongoose';

// Patient Schema → defines structure of patient documents
const patientSchema = new mongoose.Schema(
  {
    // Unique patient ID (custom, not Mongo _id)
    id: { type: String, required: true, unique: true },

    // Basic info
    name: { type: String, required: true },
    age: Number,
    gender: String,

    // Contact details
    email: { type: String, required: true },
    phone: String,
    address: String,

    // Medical info
    bloodGroup: String,
    allergies: [String],  // e.g. ["Peanuts", "Dust"]
    conditions: [String], // e.g. ["Diabetes", "Asthma"]

    // Metadata
    joinedDate: String, // format: YYYY-MM-DD
    appointments: Number, // total appointments count
  },
  {
    // Automatically adds createdAt and updatedAt
    timestamps: true,
  }
);

// Export model (prevents overwrite during development reloads)
export const Patient =
  mongoose.models.Patient || mongoose.model('Patient', patientSchema);