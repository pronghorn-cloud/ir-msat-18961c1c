import express from 'express';
import multer from 'multer';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { listAppeals, createAppeal, getAppealById, updateAppealStatus, updateAppealStage, addParty, removeParty, assignPanel, scheduleMediation, updateMediationOutcome, scheduleHearing, updateHearingOutcome, recordOrder } from '../controllers/appealsController.js';
import { uploadDocument, downloadDocument, deleteDocument, compileHearingPackage, getHearingPackage } from '../controllers/documentsController.js';
import { authenticate } from '../middleware/auth.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Multer storage configuration
const storage = multer.diskStorage({
  destination: path.join(__dirname, '../../uploads'),
  filename: (req, file, cb) => {
    const uniqueId = crypto.randomUUID();
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${uniqueId}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB max (further validated in controller per type)
});

const router = express.Router();

router.use(authenticate);

// GET /api/appeals - List appeals with pagination
router.get('/', listAppeals);

// POST /api/appeals - Create new appeal
router.post('/', createAppeal);

// GET /api/appeals/:id - Get appeal by ID
router.get('/:id', getAppealById);

// PATCH /api/appeals/:id/status - Update appeal status
router.patch('/:id/status', updateAppealStatus);

// PATCH /api/appeals/:id/stage - Update appeal stage
router.patch('/:id/stage', updateAppealStage);

// POST /api/appeals/:id/parties - Add party to appeal
router.post('/:id/parties', addParty);

// DELETE /api/appeals/:id/parties/:partyId - Remove party from appeal
router.delete('/:id/parties/:partyId', removeParty);

// POST /api/appeals/:id/panel - Assign panel to appeal
router.post('/:id/panel', assignPanel);

// POST /api/appeals/:id/mediation - Schedule mediation
router.post('/:id/mediation', scheduleMediation);

// PATCH /api/appeals/:id/mediation/:mediationId - Update mediation outcome
router.patch('/:id/mediation/:mediationId', updateMediationOutcome);

// POST /api/appeals/:id/hearing - Schedule hearing
router.post('/:id/hearing', scheduleHearing);

// PATCH /api/appeals/:id/hearing/:hearingId - Update hearing outcome
router.patch('/:id/hearing/:hearingId', updateHearingOutcome);

// POST /api/appeals/:id/orders - Record order/decision
router.post('/:id/orders', recordOrder);

// Document routes
// POST /api/appeals/:id/documents - Upload document to appeal
router.post('/:id/documents', upload.single('file'), uploadDocument);

// GET /api/appeals/:id/documents/:docId/download - Download document
router.get('/:id/documents/:docId/download', downloadDocument);

// DELETE /api/appeals/:id/documents/:docId - Delete document
router.delete('/:id/documents/:docId', deleteDocument);

// Hearing package routes
// POST /api/appeals/:id/hearing-packages - Compile hearing package
router.post('/:id/hearing-packages', compileHearingPackage);

// GET /api/appeals/:id/hearing-packages/:pkgId - Get hearing package details
router.get('/:id/hearing-packages/:pkgId', getHearingPackage);

export default router;
