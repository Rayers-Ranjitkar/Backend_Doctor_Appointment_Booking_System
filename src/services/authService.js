import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

const TOKEN_EXPIRES_IN = '7d';

// Hashes a plain-text password using bcrypt
export async function hashPassword(password) {
  return bcrypt.hash(password, 10);
}

// Compares a plain-text password against a hashed password
export async function verifyPassword(password, passwordHash) {
  return bcrypt.compare(password, passwordHash);
}

// Generates a JWT access token for a user
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
    { expiresIn: TOKEN_EXPIRES_IN },
  );
}

// Decodes and validates a JWT access token
export function readAccessToken(token) {
  return jwt.verify(token, env.jwtSecret);
}

// Returns a sanitized user object removing sensitive fields
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
