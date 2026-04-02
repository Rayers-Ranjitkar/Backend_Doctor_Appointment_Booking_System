
import cors from 'cors';
import express from 'express';
import authRoutes from './routes/authRoutes.js';
import { env } from './config/env.js';

export const app = express();

app.use(cors());
app.use(express.json());
app.use('/api/auth', authRoutes);

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', mode: env.mongoUri ? 'mongo' : 'demo-memory' });
});

app.get('/', (_req, res) => {
  res.json({ service: 'medibook-backend'});
});
