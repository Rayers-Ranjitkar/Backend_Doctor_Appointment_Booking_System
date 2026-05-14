// In-memory assistant chat storage (used when MongoDB is not connected).
//
// Note: This is only for demo/unavailable DB mode; persistence is guaranteed in
// `dbAssistantChatStore.js`.

const threads = []; // { id, userId, userRole, userProfileId, title, createdAt, updatedAt }
const messages = []; // { threadId, userId, role, text, assistant?, createdAt }

function nowIso() {
  return new Date().toISOString();
}

function newThreadId() {
  return `ch${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
}

function getUserThreads(userId) {
  return threads
    .filter((t) => t.userId === userId)
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
}

function getThreadByIdForUser(threadId, userId) {
  return threads.find((t) => t.id === threadId && t.userId === userId) || null;
}

function getMessagesForThread(threadId, userId) {
  return messages
    .filter((m) => m.threadId === threadId && m.userId === userId)
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
}

export const assistantChatStore = {
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

    return { id, title: 'New chat' };
  },

  listChats(auth) {
    return {
      threads: getUserThreads(auth.sub).map((t) => ({
        id: t.id,
        title: t.title,
        updatedAt: t.updatedAt,
      })),
    };
  },

  getChatMessages(threadId, auth) {
    const thread = getThreadByIdForUser(threadId, auth.sub);
    if (!thread) return { error: 'Chat not found.' };

    return {
      messages: getMessagesForThread(threadId, auth.sub).map((m) => ({
        role: m.role,
        text: m.text,
        assistant: m.assistant || null,
      })),
    };
  },

  getConversationContext(threadId, auth, limit = 12) {
    const thread = getThreadByIdForUser(threadId, auth.sub);
    if (!thread) return { error: 'Chat not found.' };

    const recentMessages = getMessagesForThread(threadId, auth.sub)
      .slice(-limit)
      .map((m) => ({
        role: m.role,
        content: m.role === 'assistant' && m.assistant?.summary ? m.assistant.summary : m.text,
      }));

    return { messages: recentMessages };
  },

  storeUserMessage(threadId, auth, prompt) {
    const thread = getThreadByIdForUser(threadId, auth.sub);
    if (!thread) return { error: 'Chat not found.' };

    const threadMessagesCount = messages.filter((m) => m.threadId === threadId && m.userId === auth.sub).length;
    const createdAt = nowIso();

    if (threadMessagesCount === 0) {
      const title = prompt.trim().slice(0, 60);
      thread.title = title || 'New chat';
      thread.updatedAt = createdAt;
    } else {
      thread.updatedAt = createdAt;
    }

    messages.push({
      threadId,
      userId: auth.sub,
      role: 'user',
      text: prompt,
      createdAt,
    });

    return { ok: true };
  },

  storeAssistantMessage(threadId, auth, assistantReply) {
    const thread = getThreadByIdForUser(threadId, auth.sub);
    if (!thread) return { error: 'Chat not found.' };

    const createdAt = nowIso();
    thread.updatedAt = createdAt;

    messages.push({
      threadId,
      userId: auth.sub,
      role: 'assistant',
      text: assistantReply?.summary || '',
      createdAt,
      assistant: assistantReply || null,
    });

    return { ok: true };
  },

  deleteChat(threadId, auth) {
    const threadIndex = threads.findIndex((t) => t.id === threadId && t.userId === auth.sub);
    if (threadIndex === -1) return { error: 'Chat not found.' };

    threads.splice(threadIndex, 1);

    for (let i = messages.length - 1; i >= 0; i -= 1) {
      if (messages[i].threadId === threadId && messages[i].userId === auth.sub) {
        messages.splice(i, 1);
      }
    }

    return { ok: true };
  },
};

