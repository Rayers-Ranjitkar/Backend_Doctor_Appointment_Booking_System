import http from 'http';
import { Server } from 'socket.io';
import { connectDatabase } from './config/database.js';
import { env } from './config/env.js';
import { app } from './app.js';
import { initializeAuthSeed } from './store/dbAuthStore.js';
import { initializeDatabaseSeed } from './store/dbClinicStore.js';
import { startReminderScheduler } from './services/reminderService.js';
import { startCleanupScheduler } from './services/cleanupService.js';
import { attachRealtime } from './services/realtimeService.js';
import dns from "dns"

dns.setServers(["1.1.1.1", "8.8.8.8"]);

// Try connecting to the database
const connected = await connectDatabase();

// If DB connection is successful, seed initial data
if (connected) {
  await initializeDatabaseSeed(); // Seed clinic-related data
  await initializeAuthSeed();     // Seed auth/users data
}

// Start background scheduler (e.g., for reminders/notifications)
startReminderScheduler(env.reminderPollMs);
startCleanupScheduler();

// Create HTTP server using Express app
const server = http.createServer(app);

// Initialize Socket.IO server with CORS config
const io = new Server(server, {
  cors: {
    origin: env.clientUrl, // Allow frontend URL to connect
    methods: ['GET', 'POST'],
  },
});

// Listen for new socket connections
io.on('connection', (socket) => {
  // Notify client that real-time connection is established
  socket.emit('realtime:connected', {
    connected: true,
    at: new Date().toISOString(), // Send current timestamp
  });
});

// Attach additional real-time event logic (custom handlers)
attachRealtime(io);

// Start the server
server.listen(env.port, () => {
  console.log(`Backend running on http://localhost:${env.port}`);
});