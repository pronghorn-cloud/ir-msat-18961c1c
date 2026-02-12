import express from 'express';
import { authenticate, authorize } from '../middleware/auth.js';
import { listMyCases, getMyCaseDetail, listMyCaseStatuses } from '../controllers/myCasesController.js';

const router = express.Router();

// My Cases — external users only
router.use(authenticate, authorize('user'));

router.get('/statuses', listMyCaseStatuses);
router.get('/:id', getMyCaseDetail);
router.get('/', listMyCases);

export default router;
