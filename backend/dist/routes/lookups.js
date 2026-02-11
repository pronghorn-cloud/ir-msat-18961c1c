import express from 'express';
import { getSettlements, getIssueTypes, getAppealStatuses, getAppealStages, getStaffList, getBoardMembers } from '../controllers/lookupsController.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

// All lookup routes require authentication
router.use(authenticate);

router.get('/settlements', getSettlements);
router.get('/issue-types', getIssueTypes);
router.get('/appeal-statuses', getAppealStatuses);
router.get('/appeal-stages', getAppealStages);
router.get('/staff', getStaffList);
router.get('/board-members', getBoardMembers);

export default router;
