// Mongoose schema definition for the Payment model
import mongoose from 'mongoose';

const paymentSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true },
    appointmentId: String,
    doctorId: String,
    patientId: String,
    amount: Number,
    provider: String,
    reference: String,
    status: String,
    paidAt: String,
  },
  { timestamps: true, versionKey: false },
);

export const Payment = mongoose.models.Payment || mongoose.model('Payment', paymentSchema);
