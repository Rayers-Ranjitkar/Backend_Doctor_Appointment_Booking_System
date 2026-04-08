import mongoose from 'mongoose';

const appointmentSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true },
    patientId: String,
    patientName: String,
    patientAge: Number,
    doctorId: String,
    doctorName: String,
    specialty: String,
    hospital: String,
    date: String,
    time: String,
    reason: String,
    notes: String,
    doctorImage: String,
    status: { type: String, enum: ['pending', 'confirmed', 'completed', 'cancelled'], default: 'pending' },
    paymentStatus: { type: String, enum: ['awaiting_payment', 'paid', 'failed'], default: 'awaiting_payment' },
    queueNumber: Number,
    estimatedWaitMinutes: Number,
    reminderStatus: {
      sent24h: { type: Boolean, default: false },
      sent1h: { type: Boolean, default: false },
      lastSentAt: String,
      lastSentMode: { type: String, enum: ['smtp', 'console-fallback'] },
    },
  },
  { timestamps: true },
);

export const Appointment = mongoose.models.Appointment || mongoose.model('Appointment', appointmentSchema);
