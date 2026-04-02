import http from 'http';
import { connectDatabase } from './config/database.js';
import { env } from './config/env.js';
import { app } from './app.js';
import { initializeAuthSeed } from './store/dbAuthStore.js';

const connected = await connectDatabase();
if (connected) {
  await initializeAuthSeed();
}

const server = http.createServer(app);

server.listen(env.port, () => {
  console.log(`Backend running on http://localhost:${env.port}`);
});