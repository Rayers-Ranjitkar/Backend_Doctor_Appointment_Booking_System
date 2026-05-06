import mongoose from 'mongoose';

const assistantChatThreadSchema = new mongoose.Schema(
  {
    // Stable string id (consistent with the rest of the codebase).
    id: { type: String, required: true, unique: true },

    // Auth subject id (from JWT `sub` in `authService.js`).
    userId: { type: String, required: true, index: true },
    userRole: { type: String, enum: ['patient', 'doctor', 'admin'], required: true },
    userProfileId: { type: String, default: null },

    title: { type: String, default: 'New chat' },
  },
  { timestamps: true, versionKey: false },
);

export const AssistantChatThread = mongoose.models.AssistantChatThread
  || mongoose.model('AssistantChatThread', assistantChatThreadSchema);

