// In-memory assistant chat storage.
// This storage is used only when MongoDB is unavailable.
//
// Note:
// - Data stored here will be lost when the server restarts.
// - Permanent storage is handled in `dbAssistantChatStore.js`.

const threads = []; 
// Stores chat thread information.
// Example:
// {
//   id,
//   userId,
//   userRole,
//   userProfileId,
//   title,
//   createdAt,
//   updatedAt
// }

const messages = []; 
// Stores chat messages.
// Example:
// {
//   threadId,
//   userId,
//   role,
//   text,
//   assistant,
//   createdAt
// }

/**
 * Returns the current timestamp in ISO format.
 * Example: 2026-05-21T10:30:00.000Z
 */
function nowIso() {
  return new Date().toISOString();
}

/**
 * Generates a unique chat thread ID.
 * Example: ch1747812300000_123456
 */
function newThreadId() {
  return `ch${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
}

/**
 * Returns all chat threads for a specific user.
 * Threads are sorted by latest updated time.
 */
function getUserThreads(userId) {
  return threads
    .filter((t) => t.userId === userId)
    .sort(
      (a, b) =>
        new Date(b.updatedAt).getTime() -
        new Date(a.updatedAt).getTime()
    );
}

/**
 * Finds a single thread by thread ID and user ID.
 * Returns null if the thread does not exist.
 */
function getThreadByIdForUser(threadId, userId) {
  return (
    threads.find(
      (t) => t.id === threadId && t.userId === userId
    ) || null
  );
}

/**
 * Returns all messages for a thread belonging to a user.
 * Messages are sorted from oldest to newest.
 */
function getMessagesForThread(threadId, userId) {
  return messages
    .filter(
      (m) =>
        m.threadId === threadId &&
        m.userId === userId
    )
    .sort(
      (a, b) =>
        new Date(a.createdAt).getTime() -
        new Date(b.createdAt).getTime()
    );
}

export const assistantChatStore = {
  /**
   * Creates a new chat thread.
   */
  createChat(auth) {
    const id = newThreadId();
    const createdAt = nowIso();

    threads.push({
      id,
      userId: auth.sub,
      userRole: auth.role,
      userProfileId: auth.profileId || null,
      title: 'New chat',
      createdAt,
      updatedAt: createdAt,
    });

    return {
      id,
      title: 'New chat',
    };
  },

  /**
   * Returns a list of all chats for the authenticated user.
   */
  listChats(auth) {
    return {
      threads: getUserThreads(auth.sub).map((t) => ({
        id: t.id,
        title: t.title,
        updatedAt: t.updatedAt,
      })),
    };
  },

  /**
   * Returns all messages from a specific chat thread.
   */
  getChatMessages(threadId, auth) {
    const thread = getThreadByIdForUser(threadId, auth.sub);

    // Return error if thread does not exist
    if (!thread) {
      return { error: 'Chat not found.' };
    }

    return {
      messages: getMessagesForThread(threadId, auth.sub).map((m) => ({
        role: m.role,
        text: m.text,
        assistant: m.assistant || null,
      })),
    };
  },

  /**
   * Returns recent conversation messages for AI context.
   * Default limit is 12 messages.
   */
  getConversationContext(threadId, auth, limit = 12) {
    const thread = getThreadByIdForUser(threadId, auth.sub);

    // Return error if thread does not exist
    if (!thread) {
      return { error: 'Chat not found.' };
    }

    // Get the most recent messages
    const recentMessages = getMessagesForThread(threadId, auth.sub)
      .slice(-limit)
      .map((m) => ({
        role: m.role,

        // Use assistant summary if available
        content:
          m.role === 'assistant' && m.assistant?.summary
            ? m.assistant.summary
            : m.text,
      }));

    return {
      messages: recentMessages,
    };
  },

  /**
   * Stores a user's message in a thread.
   */
  storeUserMessage(threadId, auth, prompt) {
    const thread = getThreadByIdForUser(threadId, auth.sub);

    // Return error if thread does not exist
    if (!thread) {
      return { error: 'Chat not found.' };
    }

    // Count total messages in the thread
    const threadMessagesCount = messages.filter(
      (m) =>
        m.threadId === threadId &&
        m.userId === auth.sub
    ).length;

    const createdAt = nowIso();

    // Set thread title from the first user message
    if (threadMessagesCount === 0) {
      const title = prompt.trim().slice(0, 60);

      thread.title = title || 'New chat';
      thread.updatedAt = createdAt;
    } else {
      // Update thread timestamp
      thread.updatedAt = createdAt;
    }

    // Store user message
    messages.push({
      threadId,
      userId: auth.sub,
      role: 'user',
      text: prompt,
      createdAt,
    });

    return { ok: true };
  },

  /**
   * Stores assistant response in a thread.
   */
  storeAssistantMessage(threadId, auth, assistantReply) {
    const thread = getThreadByIdForUser(threadId, auth.sub);

    // Return error if thread does not exist
    if (!thread) {
      return { error: 'Chat not found.' };
    }

    const createdAt = nowIso();

    // Update thread last modified time
    thread.updatedAt = createdAt;

    // Store assistant message
    messages.push({
      threadId,
      userId: auth.sub,
      role: 'assistant',

      // Store summary text if available
      text: assistantReply?.summary || '',

      createdAt,

      // Store full assistant response object
      assistant: assistantReply || null,
    });

    return { ok: true };
  },

  /**
   * Deletes a chat thread and all related messages.
   */
  deleteChat(threadId, auth) {
    // Find thread index
    const threadIndex = threads.findIndex(
      (t) =>
        t.id === threadId &&
        t.userId === auth.sub
    );

    // Return error if thread does not exist
    if (threadIndex === -1) {
      return { error: 'Chat not found.' };
    }

    // Remove thread
    threads.splice(threadIndex, 1);

    // Remove all messages related to the thread
    for (let i = messages.length - 1; i >= 0; i -= 1) {
      if (
        messages[i].threadId === threadId &&
        messages[i].userId === auth.sub
      ) {
        messages.splice(i, 1);
      }
    }

    return { ok: true };
  },
};