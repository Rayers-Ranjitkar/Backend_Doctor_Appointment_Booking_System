// Express application setup and configuration
import cors from 'cors';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer } from 'http';
import multer from 'multer';
import { v2 as cloudinary } from 'cloudinary';
import { Readable } from 'stream';
import authRoutes from './routes/authRoutes.js';
import clinicRoutes from './routes/clinicRoutes.js';
import { env } from './config/env.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Multer using memory storage (no local disk saving)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) return cb(new Error('Only image files are allowed.'));
    cb(null, true);
  },
});

// Initialize express application
export const app = express();

// Configure CORS and JSON body parsing middleware
app.use(cors({ origin: env.clientUrl }));
app.use(express.json());

// Image upload endpoint — uploads to Cloudinary
app.post('/api/upload/image', upload.single('image'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No image file received.' });

  const stream = cloudinary.uploader.upload_stream(
    { folder: 'medibook/doctors' },
    (error, result) => {
      if (error) return res.status(500).json({ error: 'Upload failed.' });
      res.json({ url: result.secure_url });
    }
  );

  Readable.from(req.file.buffer).pipe(stream);
});

// Register authentication and clinic routes
app.use('/api/auth', authRoutes);
app.use('/api', clinicRoutes);

// Health check endpoint
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', mode: env.mongoUri ? 'mongo' : 'demo-memory' });
});

// Root endpoint
app.get('/', (_req, res) => {
  res.json({ service: 'medibook-backend', realtime: 'socket.io-enabled' });
});

