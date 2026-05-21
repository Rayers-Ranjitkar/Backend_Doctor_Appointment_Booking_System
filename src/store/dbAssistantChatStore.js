import { AssistantChatThread } from '../models/AssistantChatThread.js';
import { AssistantChatMessage } from '../models/AssistantChatMessage.js';

/**
 * Generates a unique chat thread ID.
 * Example:
 * ch1747812300000_123456
 */
function newThreadId() {
  return `ch${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
}

export const dbAssistantChatStore = {

  /**
   * Creates a new chat thread for the authenticated user.
   */
  async createChat(auth) {

    // Generate unique thread ID
    const id = newThreadId();

    // Create thread in MongoDB
    const thread = await AssistantChatThread.create({
      id,
      userId: auth.sub,
      userRole: auth.role,

      // Optional linked profile ID
      userProfileId: auth.profileId || null,

      title: 'New chat',
    });

    return {
      id: thread.id,
      title: thread.title,
    };
  },

  /**
   * Returns all chat threads for authenticated user.
   * Latest updated threads appear first.
   */
  async listChats(auth) {

    // Fetch user threads sorted by latest update
    const threads = await AssistantChatThread.find({
      userId: auth.sub,
    })
      .sort({ updatedAt: -1 })
      .lean();

    return {
      threads: threads.map((t) => ({
        id: t.id,
        title: t.title,
        updatedAt: t.updatedAt,
      })),
    };
  },

  /**
   * Returns all messages inside a specific chat thread.
   */
  async getChatMessages(threadId, auth) {

    // Check if thread exists for user
    const thread = await AssistantChatThread.findOne({
      id: threadId,
      userId: auth.sub,
    }).lean();

    if (!thread) {
      return { error: 'Chat not found.' };
    }

    // Fetch messages sorted oldest → newest
    const msgs = await AssistantChatMessage.find({
      threadId,
      userId: auth.sub,
    })
      .sort({ createdAt: 1 })
      .lean();

    return {
      messages: msgs.map((m) => ({
        role: m.role,
        text: m.text,

        // Assistant metadata if available
        assistant: m.assistant || null,
      })),
    };
  },

  /**
   * Returns recent conversation history.
   * Used for AI context memory.
   */
  async getConversationContext(
    threadId,
    auth,
    limit = 12,
  ) {

    // Verify thread ownership
    const thread = await AssistantChatThread.findOne({
      id: threadId,
      userId: auth.sub,
    }).lean();

    if (!thread) {
      return { error: 'Chat not found.' };
    }

    // Fetch latest messages
    const msgs = await AssistantChatMessage.find({
      threadId,
      userId: auth.sub,
    })
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    return {
      messages: msgs.reverse().map((m) => ({

        // Role can be:
        // user | assistant
        role: m.role,

        /**
         * Content priority:
         * 1. assistant.rawSummary
         * 2. assistant.summary
         * 3. normal text
         */
        content:
          m.role === 'assistant' &&
          m.assistant?.rawSummary
            ? m.assistant.rawSummary
            : (
                m.assistant?.summary ||
                m.text
              ),
      })),
    };
  },

  /**
   * Stores a user message in database.
   */
  async storeUserMessage(
    threadId,
    auth,
    prompt,
  ) {

    // Find thread
    const thread = await AssistantChatThread.findOne({
      id: threadId,
      userId: auth.sub,
    });

    if (!thread) {
      return { error: 'Chat not found.' };
    }

    /**
     * Count existing messages.
     * Used to determine whether this is first message.
     */
    const existingCount =
      await AssistantChatMessage.countDocuments({
        threadId,
        userId: auth.sub,
      });

    /**
     * Generate title from first prompt.
     * Max length = 60 characters
     */
    const title =
      existingCount === 0
        ? (
            prompt.trim().slice(0, 60) ||
            'New chat'
          )
        : thread.title;

    // Update thread title only for first message
    if (existingCount === 0) {
      thread.title = title;
    }

    // Update last modified time
    thread.updatedAt = new Date();

    // Save thread changes
    await thread.save();

    // Save user message
    await AssistantChatMessage.create({
      threadId,
      userId: auth.sub,
      role: 'user',
      text: prompt,
    });

    return { ok: true };
  },

  /**
   * Stores assistant response in database.
   */
  async storeAssistantMessage(
    threadId,
    auth,
    assistantReply,
  ) {

    // Verify thread exists
    const thread = await AssistantChatThread.findOne({
      id: threadId,
      userId: auth.sub,
    }).lean();

    if (!thread) {
      return { error: 'Chat not found.' };
    }

    // Save assistant message
    await AssistantChatMessage.create({
      threadId,
      userId: auth.sub,
      role: 'assistant',

      // Save summary as text
      text: assistantReply?.summary || '',

      // Save complete assistant response
      assistant: assistantReply || null,
    });

    // Update thread modified timestamp
    await AssistantChatThread.updateOne(
      {
        id: threadId,
        userId: auth.sub,
      },
      {
        $set: {
          updatedAt: new Date(),
        },
      },
    );

    return { ok: true };
  },

  /**
   * Deletes a chat thread and all related messages.
   */
  async deleteChat(threadId, auth) {

    // Delete thread if owned by user
    const thread =
      await AssistantChatThread.findOneAndDelete({
        id: threadId,
        userId: auth.sub,
      }).lean();

    if (!thread) {
      return { error: 'Chat not found.' };
    }

    // Delete all messages inside thread
    await AssistantChatMessage.deleteMany({
      threadId,
      userId: auth.sub,
    });

    return { ok: true };
  },
};