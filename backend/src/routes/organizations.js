import express from 'express';
import { searchOrganizations, listOrganizations, getOrganizationById, createOrganization, updateOrganization } from '../controllers/organizationsController.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = express.Router();

router.use(authenticate, authorize('staff', 'admin'));

// GET /api/organizations/search?q=name
router.get('/search', searchOrganizations);

// GET /api/organizations?search=&type=&limit=&offset=
router.get('/', listOrganizations);

// GET /api/organizations/:id
router.get('/:id', getOrganizationById);

// POST /api/organizations
router.post('/', createOrganization);

// PATCH /api/organizations/:id
router.patch('/:id', updateOrganization);

export default router;
