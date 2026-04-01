import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Get current file path (since __dirname is not available in ES modules)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from root .env file
// (goes up 3 folders to find .env)
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

// Load default .env (fallback if above path not found)
dotenv.config();

// Export environment configuration object
export const env = {
  // Backend server port (default: 4000)
  port: Number(process.env.PORT || 4000),

  // MongoDB connection URI
  mongoUri: process.env.MONGODB_URI || '',

  // Secret key used for JWT token generation
  jwtSecret:
    process.env.JWT_SECRET || 'norvic_demo_jwt_secret_change_me',
};