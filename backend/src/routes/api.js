import express from 'express';
import { getServices, getServiceById } from '../controllers/servicesController.js';
import authRoutes from './auth.js';
import adminRoutes from './admin.js';
import lookupsRoutes from './lookups.js';
import clientsRoutes from './clients.js';
import appealsRoutes from './appeals.js';
import organizationsRoutes from './organizations.js';
import digitizeRoutes from './digitize.js';
import documentsRoutes from './documents.js';
import publicRoutes from './public.js';
import submissionsRoutes from './submissions.js';
import myCasesRoutes from './my-cases.js';
import contentRoutes from './content.js';
import lapRoutes from './lap.js';
import analyticsRoutes from './analytics.js';

const router = express.Router();

// Auth routes
router.use('/auth', authRoutes);

// Admin routes
router.use('/admin', adminRoutes);

// Lookups routes
router.use('/lookups', lookupsRoutes);

// Clients routes
router.use('/clients', clientsRoutes);

// Organizations routes
router.use('/organizations', organizationsRoutes);

// Appeals routes
router.use('/appeals', appealsRoutes);

// Digitize routes
router.use('/digitize', digitizeRoutes);

// Documents search routes
router.use('/documents', documentsRoutes);

// Public routes (no auth required)
router.use('/public', publicRoutes);

// Submissions routes (staff, auth required)
router.use('/submissions', submissionsRoutes);

// My Cases routes (external user, auth required)
router.use('/my-cases', myCasesRoutes);

// Content management routes (staff/admin, auth required)
router.use('/content', contentRoutes);

// LAP routes (staff/admin, auth required)
router.use('/lap', lapRoutes);

// Analytics routes (staff/admin, auth required)
router.use('/analytics', analyticsRoutes);

// Services endpoints
router.get('/services', getServices);
router.get('/services/:id', getServiceById);

// Health check for API
router.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    message: 'MSAT API is running',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  });
});

export default router;
