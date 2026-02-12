import express from 'express';
import { searchDocuments, listCategories, listAppealsWithDocs, listSettlementsWithDocs } from '../controllers/documentSearchController.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = express.Router();

router.use(authenticate, authorize('staff', 'admin'));

// GET /api/documents/categories - List distinct categories
router.get('/categories', listCategories);

// GET /api/documents/appeals - List appeals that have documents
router.get('/appeals', listAppealsWithDocs);

// GET /api/documents/settlements - List settlements that have documents
router.get('/settlements', listSettlementsWithDocs);

// GET /api/documents?search=&category=&appeal_id=&settlement=&date_from=&date_to=&limit=&offset=
router.get('/', searchDocuments);

export default router;
