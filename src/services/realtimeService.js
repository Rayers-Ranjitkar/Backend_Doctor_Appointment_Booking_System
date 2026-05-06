let ioInstance = null;

export function attachRealtime(io) {
  ioInstance = io;
}

export function emitRealtime(event, payload) {
  if (!ioInstance) return;
  ioInstance.emit(event, payload);
}
