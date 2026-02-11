import express from 'express';
import { listSubmissions, getSubmissionById, reviewSubmission } from '../controllers/submissionsController.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

router.use(authenticate);

// GET /api/submissions?status=&limit=&offset=
router.get('/', listSubmissions);

// GET /api/submissions/:id
router.get('/:id', getSubmissionById);

// PATCH /api/submissions/:id/review
router.patch('/:id/review', reviewSubmission);

export default router;
