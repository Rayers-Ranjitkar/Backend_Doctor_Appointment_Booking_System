import { readAccessToken } from '../services/authService.js';

// Express middleware to enforce authentication via Bearer JWT token
export function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';

  if (!token) {
    return res.status(401).json({ error: 'Authentication required.' });
  }

  try {
    req.auth = readAccessToken(token);
    return next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired session.' });
  }
}
