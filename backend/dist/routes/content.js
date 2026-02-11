import express from 'express';
import { authenticate, authorize } from '../middleware/auth.js';
import { listAllContent, getContentById, createContent, updateContent, deleteContent } from '../controllers/contentController.js';

const router = express.Router();

// All content management routes require staff or admin auth
router.use(authenticate, authorize('staff', 'admin'));

router.get('/', listAllContent);
router.get('/:id', getContentById);
router.post('/', createContent);
router.put('/:id', updateContent);
router.delete('/:id', deleteContent);

export default router;
