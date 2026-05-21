import mongoose from 'mongoose';

const assistantChatMessageSchema = new mongoose.Schema(
  {
    threadId: { type: String, required: true, index: true },
    userId: { type: String, required: true, index: true },

    role: { type: String, enum: ['user', 'assistant'], required: true },
    text: { type: String, required: true },

    // Only present for assistant messages (used for UI rendering)
    assistant: {
      summary: { type: String },
      suggestions: { type: [String], default: [] },
      recommendedDoctorId: { type: String, default: null },
      action: {
        type: String,
        enum: ['answer_question', 'recommend_doctor'],
        default: 'answer_question',
      },
    },
  },
  { timestamps: true, versionKey: false },
);

export const AssistantChatMessage =
  mongoose.models.AssistantChatMessage ||
  mongoose.model('AssistantChatMessage', assistantChatMessageSchema);