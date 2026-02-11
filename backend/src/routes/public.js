import express from 'express';
import multer from 'multer';
import crypto from 'crypto';
import path from 'path';
import { fileURLToPath } from 'url';
import { getPublicSettlements, getPublicIssueTypes, createSubmission } from '../controllers/submissionsController.js';
import { searchPublicDecisions, listDecisionYears, listDecisionSettlements, listDecisionIssueTypes } from '../controllers/decisionsController.js';
import { listPublicHearings, listHearingLocations, listHearingMonths } from '../controllers/hearingsController.js';
import { getPageContent } from '../controllers/contentController.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

// Multer config for public uploads
const storage = multer.diskStorage({
  destination: path.join(__dirname, '../../uploads'),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `sub-${crypto.randomUUID()}${ext}`);
  }
});
const upload = multer({ storage, limits: { fileSize: 50 * 1024 * 1024 } });

// Public lookups (no auth)
router.get('/settlements', getPublicSettlements);
router.get('/issue-types', getPublicIssueTypes);

// Public submission (no auth, with optional file uploads)
router.post('/submissions', upload.array('files', 10), createSubmission);

// Published decisions (no auth)
router.get('/decisions/years', listDecisionYears);
router.get('/decisions/settlements', listDecisionSettlements);
router.get('/decisions/issue-types', listDecisionIssueTypes);
router.get('/decisions', searchPublicDecisions);

// Public hearing schedule (no auth)
router.get('/hearings/locations', listHearingLocations);
router.get('/hearings/months', listHearingMonths);
router.get('/hearings', listPublicHearings);

// Public content (no auth)
router.get('/content/:pageSlug', getPageContent);

export default router;
