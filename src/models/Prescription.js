import mongoose from 'mongoose';

const prescriptionSchema = new mongoose.Schema(
  {
    // Stable external identifier for prescription tracking
    id: { type: String, required: true, unique: true },

    appointmentId: String,

    patientId: String,
    patientName: String,

    doctorId: String,
    doctorName: String,

    title: String,

    fileName: String,
    fileUrl: String,

    notes: String,

    // Snapshot of hospital/doctor context at time of prescription creation
    hospitalName: String,
    hospitalAddress: String,
    hospitalPhone: String,
    hospitalTiming: String,
    registrationNumber: String,

    // Patient clinical snapshot at time of visit
    patientAge: Number,
    patientGender: String,
    patientPhone: String,
    patientAddress: String,

    weightKg: String,
    heightCm: String,
    bmi: String,
    bloodPressure: String,

    chiefComplaints: [String],
    clinicalFindings: [String],

    diagnosis: String,

    // Structured medication list
    medicines: [
      new mongoose.Schema(
        {
          id: String,
          name: String,
          dosage: String,
          duration: String,
          instructions: String,
        },
        { _id: false },
      ),
    ],

    advice: [String],

    followUpDate: String,

    documentHtml: String,

    createdAt: String,
    updatedAt: String,
  },
  { timestamps: true, versionKey: false },
);

export const Prescription =
  mongoose.models.Prescription || mongoose.model('Prescription', prescriptionSchema);