import mongoose from 'mongoose';

const assistantChatThreadSchema = new mongoose.Schema(
  {
    // Stable external thread ID used across the app
    id: { type: String, required: true, unique: true },

    // User ownership (from JWT auth subject)
    userId: { type: String, required: true, index: true },

    userRole: {
      type: String,
      enum: ['patient', 'doctor', 'admin'],
      required: true,
    },

    userProfileId: { type: String, default: null },

    title: { type: String, default: 'New chat' },
  },
  { timestamps: true, versionKey: false },
);

export const AssistantChatThread =
  mongoose.models.AssistantChatThread ||
  mongoose.model('AssistantChatThread', assistantChatThreadSchema);