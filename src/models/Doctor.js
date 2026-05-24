// Mongoose schema definition for the Doctor model
import mongoose from 'mongoose';

const doctorSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    specialty: String,
    specialtyId: String,
    hospital: String,
    experience: Number,
    rating: Number,
    reviews: Number,
    image: String,
    price: Number,
    about: String,
    education: [String],
    availableDays: [String],
    timeSlots: [String],
    status: { type: String, enum: ['active', 'inactive'], default: 'active' },
    patients: Number,
    licenseNumber: String,
    verificationStatus: { type: String, enum: ['pending', 'verified', 'rejected'], default: 'pending' },
  },
  { timestamps: true },
);

export const Doctor = mongoose.models.Doctor || mongoose.model('Doctor', doctorSchema);
