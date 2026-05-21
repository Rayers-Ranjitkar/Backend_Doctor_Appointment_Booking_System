import cors from 'cors';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer } from 'http';
import fs from 'fs';
import multer from 'multer';
import authRoutes from './routes/authRoutes.js';
import clinicRoutes from './routes/clinicRoutes.js';
import { env } from './config/env.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, '../../uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `doctor-${Date.now()}${ext}`);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) return cb(new Error('Only image files are allowed.'));
    cb(null, true);
  },
});

export const app = express();

app.use(cors({ origin: env.clientUrl }));
app.use(express.json());

// Serve uploaded images statically
app.use('/uploads', express.static(uploadsDir));

// Image upload endpoint (multer handles multipart/form-data)
app.post('/api/upload/image', upload.single('image'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No image file received.' });
  const imageUrl = `/uploads/${req.file.filename}`;
  res.json({ url: imageUrl });
});

app.use('/api/auth', authRoutes);
app.use('/api', clinicRoutes);

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', mode: env.mongoUri ? 'mongo' : 'demo-memory' });
});

app.get('/', (_req, res) => {
  res.json({ service: 'medibook-backend', realtime: 'socket.io-enabled' });
});

app.get('/test-khalti', async (_req, res) => {
  try {
    const response = await fetch('https://dev.khalti.com/api/v2/epayment/initiate/', {
      method: 'POST',
      headers: {
        Authorization: `Key ${env.khaltiSecretKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        return_url: 'http://localhost:5173/patient/khalti/callback',
        website_url: 'http://localhost:5173',
        amount: 1000,
        purchase_order_id: 'test123',
        purchase_order_name: 'Test',
      }),
      signal: AbortSignal.timeout(15000),
    });
    const data = await response.json();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message, name: err.name });
  }
});

app.get('/test-khalti-lookup', async (_req, res) => {
  const pidx = _req.query.pidx;
  try {
    const response = await fetch('https://dev.khalti.com/api/v2/epayment/lookup/', {
      method: 'POST',
      headers: {
        Authorization: `Key ${env.khaltiSecretKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ pidx }),
      signal: AbortSignal.timeout(15000),
    });
    const data = await response.json();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message, name: err.name });
  }
});