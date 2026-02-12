import express from 'express';
import { searchClients, listClients, getClientById, createClient, updateClient } from '../controllers/clientsController.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = express.Router();

router.use(authenticate, authorize('staff', 'admin'));

// GET /api/clients/search?q=name_or_member_id
router.get('/search', searchClients);

// GET /api/clients?search=&limit=&offset=
router.get('/', listClients);

// GET /api/clients/:id
router.get('/:id', getClientById);

// POST /api/clients
router.post('/', createClient);

// PATCH /api/clients/:id
router.patch('/:id', updateClient);

export default router;
