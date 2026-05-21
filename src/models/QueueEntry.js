import mongoose from 'mongoose';

const queueEntrySchema = new mongoose.Schema(
  {
    // Stable external identifier for queue tracking
    id: { type: String, required: true, unique: true, index: true },

    appointmentId: String,

    // Date of appointment (YYYY-MM-DD), used for daily queue grouping
    appointmentDate: { type: String, index: true },

    doctorId: String,
    patientId: String,
    patientName: String,

    // Position of patient in doctor’s queue
    position: Number,

    estimatedWaitMinutes: Number,
    actualWaitMinutes: Number,

    // Current state in consultation flow
    status: {
      type: String,
      enum: ['waiting', 'in_consultation', 'completed'],
      default: 'waiting',
    },
  },
  { timestamps: true },
);

export const QueueEntry =
  mongoose.models.QueueEntry || mongoose.model('QueueEntry', queueEntrySchema);