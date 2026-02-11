import express from 'express';
import { authenticate, authorize } from '../middleware/auth.js';
import {
  getSummary,
  getAppealsByYear,
  getAppealsByIssue,
  getAppealsBySettlement,
  listSettlements,
  listFiscalYears,
  getAnnualReport
} from '../controllers/analyticsController.js';

const router = express.Router();

// All analytics routes require staff or admin auth
router.use(authenticate, authorize('staff', 'admin'));

router.get('/summary', getSummary);
router.get('/appeals-by-year', getAppealsByYear);
router.get('/appeals-by-issue', getAppealsByIssue);
router.get('/appeals-by-settlement', getAppealsBySettlement);
router.get('/settlements', listSettlements);
router.get('/fiscal-years', listFiscalYears);
router.get('/annual-report', getAnnualReport);

export default router;
