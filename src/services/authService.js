import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

const TOKEN_EXPIRES_IN = '7d';

// Hash user password
export async function hashPassword(password) {
  return bcrypt.hash(password, 10);
}

// Verify password
export async function verifyPassword(password, passwordHash) {
  return bcrypt.compare(password, passwordHash);
}

// Create JWT token
export function createAccessToken(user) {
  return jwt.sign(
    {
      sub: user.id,
      role: user.role,
      profileId: user.profileId || null,
      email: user.email,
      username: user.username,
      name: user.name,
    },
    env.jwtSecret,
    {
      expiresIn: TOKEN_EXPIRES_IN,
    }
  );
}

// Decode/verify JWT token
export function readAccessToken(token) {
  return jwt.verify(token, env.jwtSecret);
}

// Remove sensitive data before sending user
export function sanitizeUser(user) {
  return {
    id: user.id,
    role: user.role,
    name: user.name,
    username: user.username,
    email: user.email,
    phone: user.phone || '',
    profileId: user.profileId || null,
  };
}