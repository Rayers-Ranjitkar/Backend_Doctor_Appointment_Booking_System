export function createNotification(message, type = 'info', recipientRole = 'admin', recipientProfileId = null) {
  return {
    id: `n${Date.now()}`,
    message,
    type,
    time: 'just now',
    read: false,
    recipientRole,
    recipientProfileId,
  };
}
