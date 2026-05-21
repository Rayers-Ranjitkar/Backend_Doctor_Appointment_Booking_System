import mongoose from 'mongoose';

const notificationSchema = new mongoose.Schema(
  {
    // Stable external identifier for notification tracking
    id: { type: String, required: true, unique: true },

    message: { type: String, required: true },

    // Categorizes notification purpose (UI grouping + logic filtering)
    type: {
      type: String,
      enum: ['confirmation', 'reminder', 'cancellation', 'info', 'queue', 'payment'],
      default: 'info',
    },

    time: String,

    // Read/unread state for UI badge and filtering
    read: { type: Boolean, default: false },

    // Target audience role for routing notifications
    recipientRole: {
      type: String,
      enum: ['patient', 'doctor', 'admin'],
      required: true,
    },

    // Optional: specific user/profile targeting within a role
    recipientProfileId: { type: String, default: null },
  },
  { timestamps: true },
);

export const Notification =
  mongoose.models.Notification || mongoose.model('Notification', notificationSchema);