import mongoose from 'mongoose';

// Doctor Schema → defines structure of doctor documents
const doctorSchema = new mongoose.Schema(
  {
    // Unique doctor ID (custom, not Mongo _id)
    id: { type: String, required: true, unique: true },

    // Basic info
    name: { type: String, required: true },
    specialty: String,
    specialtyId: String,
    hospital: String,

    // Professional details
    experience: Number, // in years
    rating: Number,     // average rating
    reviews: Number,    // total reviews count

    // Profile info
    image: String,
    price: Number, // consultation fee
    about: String,

    // Education details (array of strings)
    education: [String],

    // Availability
    availableDays: [String], // e.g. ["Mon", "Tue"]
    timeSlots: [String],     // e.g. ["10:00 AM", "2:00 PM"]

    // Status of doctor profile
    status: {
      type: String,
      enum: ['active', 'inactive'],
      default: 'active',
    },

    // Patient-related data
    patients: Number, // total patients handled

    // Verification & license
    licenseNumber: String,
    verificationStatus: {
      type: String,
      enum: ['pending', 'verified', 'rejected'],
      default: 'pending',
    },
  },
  {
    // Automatically adds createdAt and updatedAt
    timestamps: true,
  }
);

// Export model (prevents overwrite in dev with hot reload)
export const Doctor =
  mongoose.models.Doctor || mongoose.model('Doctor', doctorSchema);