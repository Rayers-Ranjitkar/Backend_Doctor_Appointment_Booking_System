import { readAccessToken } from '../services/authservice.js';

// Middleware to protect routes (requires valid JWT token)
export function requireAuth(req, res, next) {
  // Get Authorization header (e.g., "Bearer <token>")
  const header = req.headers.authorization || '';

  // Extract token from "Bearer <token>"
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';

  // If no token is provided
  if (!token) {
    return res.status(401).json({ error: 'Authentication required.' });
  }

  try {
    // Verify and decode token → store in req.auth
    req.auth = readAccessToken(token);

    // Continue to next middleware/controller
    return next();
  } catch {
    // If token is invalid or expired
    return res.status(401).json({ error: 'Invalid or expired session.' });
  }
}