import express from 'express';
import { authenticate } from '../middleware/auth.js';
import { listMyCases, getMyCaseDetail, listMyCaseStatuses } from '../controllers/myCasesController.js';

const router = express.Router();

// All routes require authentication
router.use(authenticate);

router.get('/statuses', listMyCaseStatuses);
router.get('/:id', getMyCaseDetail);
router.get('/', listMyCases);

export default router;
