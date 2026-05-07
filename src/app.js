import cors from 'cors';
import express from 'express';
import authRoutes from './routes/authRoutes.js';
import clinicRoutes from './routes/clinicRoutes.js';
import { env } from './config/env.js';

export const app = express();

app.use(cors({ origin: env.clientUrl }));
app.use(express.json());
app.use('/api/auth', authRoutes);
app.use('/api', clinicRoutes);

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', mode: env.mongoUri ? 'mongo' : 'demo-memory' });
});

app.get('/', (_req, res) => {
  res.json({ service: 'medibook-backend', realtime: 'socket.io-enabled' });
});
