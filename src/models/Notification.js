// Mongoose schema definition for the Notification model
import mongoose from 'mongoose';

const notificationSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true },
    message: { type: String, required: true },
    type: { type: String, enum: ['confirmation', 'reminder', 'cancellation', 'info', 'queue', 'payment'], default: 'info' },
    time: String,
    read: { type: Boolean, default: false },
    recipientRole: { type: String, enum: ['patient', 'doctor', 'admin'], required: true },
    recipientProfileId: { type: String, default: null },
  },
  { timestamps: true },
);

export const Notification = mongoose.models.Notification || mongoose.model('Notification', notificationSchema);
