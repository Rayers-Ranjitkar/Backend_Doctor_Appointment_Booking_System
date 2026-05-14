import mongoose from 'mongoose';

const queueEntrySchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true, index: true },
    appointmentId: String,
    doctorId: String,
    patientId: String,
    patientName: String,
    position: Number,
    estimatedWaitMinutes: Number,
    actualWaitMinutes: Number,
    status: { type: String, enum: ['waiting', 'in_consultation', 'completed'], default: 'waiting' },
  },
  { timestamps: true },
);

export const QueueEntry = mongoose.models.QueueEntry || mongoose.model('QueueEntry', queueEntrySchema);
