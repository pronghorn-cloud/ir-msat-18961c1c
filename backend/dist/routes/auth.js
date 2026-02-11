import express from 'express';
import { login, getMe, updateProfile, refreshToken, changePassword, logout } from '../controllers/authController.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

// POST /api/auth/login - Sign in with email/password
router.post('/login', login);

// POST /api/auth/refresh - Refresh JWT token
router.post('/refresh', refreshToken);

// POST /api/auth/logout - Sign out (requires auth)
router.post('/logout', authenticate, logout);

// PUT /api/auth/profile - Update profile (requires auth)
router.put('/profile', authenticate, updateProfile);

// PUT /api/auth/change-password - Change password (requires auth)
router.put('/change-password', authenticate, changePassword);

// GET /api/auth/me - Get current user profile (requires auth)
router.get('/me', authenticate, getMe);

export default router;
