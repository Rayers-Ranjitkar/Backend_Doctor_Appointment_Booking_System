import mongoose from 'mongoose';

const paymentSchema = new mongoose.Schema(
  {
    // Stable external identifier for payment tracking
    id: { type: String, required: true, unique: true },

    appointmentId: String,
    doctorId: String,
    patientId: String,

    amount: Number,

    provider: String,

    // External gateway reference (e.g., Khalti transaction ID)
    reference: String,

    // Payment lifecycle state (e.g., initiated, paid, failed)
    status: String,

    paidAt: String,
  },
  { timestamps: true, versionKey: false },
);

export const Payment =
  mongoose.models.Payment || mongoose.model('Payment', paymentSchema);