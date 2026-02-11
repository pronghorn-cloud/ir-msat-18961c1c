import jwt from 'jsonwebtoken';
import { APIError } from './errorHandler.js';

export const authenticate = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new APIError('Authentication required', 401);
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      throw new APIError('Token expired', 401);
    }
    throw new APIError('Invalid token', 401);
  }
};

export const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      throw new APIError('Authentication required', 401);
    }
    if (!roles.includes(req.user.role)) {
      throw new APIError('Insufficient permissions', 403);
    }
    next();
  };
};
