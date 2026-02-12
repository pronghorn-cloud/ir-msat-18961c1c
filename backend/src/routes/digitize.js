import express from 'express';
import multer from 'multer';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { listBatches, getBatchDetail, lookupAppeal, createBatch } from '../controllers/digitizeController.js';
import { authenticate, authorize } from '../middleware/auth.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
  limits: { fileSize: 50 * 1024 * 1024 }
});

const router = express.Router();

router.use(authenticate, authorize('staff', 'admin'));

// GET /api/digitize/batches - List all batches
router.get('/batches', listBatches);

// GET /api/digitize/lookup-appeal - Lookup appeal by file number
router.get('/lookup-appeal', lookupAppeal);

// GET /api/digitize/batches/:batchId - Get batch detail
router.get('/batches/:batchId', getBatchDetail);

// POST /api/digitize/batches - Create batch with file uploads
router.post('/batches', upload.array('files', 50), createBatch);

export default router;
