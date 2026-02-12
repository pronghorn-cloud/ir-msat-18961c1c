import express from 'express';
import { getSettlements, getIssueTypes, getAppealStatuses, getAppealStages, getStaffList, getBoardMembers } from '../controllers/lookupsController.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = express.Router();

// Lookups needed by staff, admin, and board members (for appeal views)
router.use(authenticate, authorize('staff', 'admin', 'board_member'));

router.get('/settlements', getSettlements);
router.get('/issue-types', getIssueTypes);
router.get('/appeal-statuses', getAppealStatuses);
router.get('/appeal-stages', getAppealStages);
router.get('/staff', getStaffList);
router.get('/board-members', getBoardMembers);

export default router;
