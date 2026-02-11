import express from 'express';
import { listUsers, createUser, updateUser, blockUser, unblockUser } from '../controllers/adminController.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = express.Router();

// All admin routes require authentication + admin role
router.use(authenticate, authorize('admin'));

// GET /api/admin/users - List all users
router.get('/users', listUsers);

// POST /api/admin/users - Create a new user
router.post('/users', createUser);

// PUT /api/admin/users/:id - Update a user
router.put('/users/:id', updateUser);

// PUT /api/admin/users/:id/block - Block a user
router.put('/users/:id/block', blockUser);

// PUT /api/admin/users/:id/unblock - Unblock a user
router.put('/users/:id/unblock', unblockUser);

export default router;
