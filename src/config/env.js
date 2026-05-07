import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
dotenv.config();

export const env = {
  port: Number(process.env.PORT || 4000),
  mongoUri: process.env.MONGODB_URI || '',
  khaltiSecretKey: process.env.KHALTI_SECRET_KEY || 'demo_khalti_secret',
  clientUrl: process.env.CLIENT_URL || 'http://localhost:5173',
  smtpHost: process.env.SMTP_HOST || '',
  smtpPort: Number(process.env.SMTP_PORT || 587),
  smtpUser: process.env.SMTP_USER || '',
  smtpPass: process.env.SMTP_PASS || '',
  smtpFrom: process.env.SMTP_FROM || 'noreply@medibook.local',
  reminderPollMs: Number(process.env.REMINDER_POLL_MS || 60000),
  jwtSecret: process.env.JWT_SECRET || 'norvic_demo_jwt_secret_change_me',
  // Back-compat (no longer used by MediBook AI assistant)
  geminiApiKey: process.env.GEMINI_API_KEY || '',
  // ── Groq AI ─────────────────────────────────────────────────────────────
  // Used by MediBook AI assistant via POST /api/assistant
  groqApiKey: process.env.GROQ_API_KEY || '',
  groqModel: process.env.GROQ_MODEL || 'llama-3.1-8b-instant',
};