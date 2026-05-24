let ioInstance = null;

// Stores a reference to the global Socket.IO server instance
export function attachRealtime(io) {
  ioInstance = io;
}

// Emits a real-time WebSocket event to all connected clients
export function emitRealtime(event, payload) {
  if (!ioInstance) return;
  ioInstance.emit(event, payload);
}
