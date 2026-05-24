import { AssistantChatThread } from '../models/AssistantChatThread.js';
import { AssistantChatMessage } from '../models/AssistantChatMessage.js';

function newThreadId() {
  return `ch${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
}

export const dbAssistantChatStore = {
    // Creates a new assistant chat thread in MongoDB
  async createChat(auth) {
    const id = newThreadId();
    const thread = await AssistantChatThread.create({
      id,
      userId: auth.sub,
      userRole: auth.role,
      userProfileId: auth.profileId || null,
      title: 'New chat',
    });

    return { id: thread.id, title: thread.title };
  },

    // Lists all assistant chat threads for the user from MongoDB
  async listChats(auth) {
    const threads = await AssistantChatThread.find({ userId: auth.sub })
      .sort({ updatedAt: -1 })
      .lean();

    return {
      threads: threads.map((t) => ({ id: t.id, title: t.title, updatedAt: t.updatedAt })),
    };
  },

    // Fetches messages for a specific assistant chat thread from MongoDB
  async getChatMessages(threadId, auth) {
    const thread = await AssistantChatThread.findOne({ id: threadId, userId: auth.sub }).lean();
    if (!thread) return { error: 'Chat not found.' };

    const msgs = await AssistantChatMessage.find({ threadId, userId: auth.sub })
      .sort({ createdAt: 1 })
      .lean();

    return {
      messages: msgs.map((m) => ({
        role: m.role,
        text: m.text,
        assistant: m.assistant || null,
      })),
    };
  },

    // Gets recent messages context for AI prompt builder from MongoDB
  async getConversationContext(threadId, auth, limit = 12) {
    const thread = await AssistantChatThread.findOne({ id: threadId, userId: auth.sub }).lean();
    if (!thread) return { error: 'Chat not found.' };

    const msgs = await AssistantChatMessage.find({ threadId, userId: auth.sub })
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    return {
      messages: msgs.reverse().map((m) => ({
        role: m.role,
        content: m.role === 'assistant' && m.assistant?.rawSummary
          ? m.assistant.rawSummary
          : (m.assistant?.summary || m.text),
      })),
    };
  },

    // Saves a user prompt message to the thread in MongoDB
  async storeUserMessage(threadId, auth, prompt) {
    const thread = await AssistantChatThread.findOne({ id: threadId, userId: auth.sub });
    if (!thread) return { error: 'Chat not found.' };

    const existingCount = await AssistantChatMessage.countDocuments({ threadId, userId: auth.sub });
    const title = existingCount === 0 ? (prompt.trim().slice(0, 60) || 'New chat') : thread.title;

    if (existingCount === 0) {
      thread.title = title;
    }
    thread.updatedAt = new Date();
    await thread.save();

    await AssistantChatMessage.create({
      threadId,
      userId: auth.sub,
      role: 'user',
      text: prompt,
    });

    return { ok: true };
  },

    // Saves the assistant reply to the thread in MongoDB
  async storeAssistantMessage(threadId, auth, assistantReply) {
    const thread = await AssistantChatThread.findOne({ id: threadId, userId: auth.sub }).lean();
    if (!thread) return { error: 'Chat not found.' };

    await AssistantChatMessage.create({
      threadId,
      userId: auth.sub,
      role: 'assistant',
      text: assistantReply?.summary || '',
      assistant: assistantReply || null,
    });

    await AssistantChatThread.updateOne(
      { id: threadId, userId: auth.sub },
      { $set: { updatedAt: new Date() } },
    );

    return { ok: true };
  },

    // Deletes an assistant chat thread and its messages from MongoDB
  async deleteChat(threadId, auth) {
    const thread = await AssistantChatThread.findOneAndDelete({ id: threadId, userId: auth.sub }).lean();
    if (!thread) return { error: 'Chat not found.' };

    await AssistantChatMessage.deleteMany({ threadId, userId: auth.sub });
    return { ok: true };
  },
};

