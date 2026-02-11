import pool from '../config/database.js';
import { APIError } from '../middleware/errorHandler.js';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const UPLOADS_DIR = path.join(__dirname, '../../uploads');

const ALLOWED_TYPES = {
  '.pdf': 'application/pdf',
  '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.xls': 'application/vnd.ms-excel',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.document',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.tif': 'image/tiff',
  '.tiff': 'image/tiff'
};

// GET /api/digitize/batches - List all digitization batches
export async function listBatches(req, res, next) {
  try {
    const result = await pool.query(
      `SELECT db.*, u.first_name || ' ' || u.last_name as created_by_name
       FROM msat.digitization_batches db
       LEFT JOIN msat.users u ON db.created_by = u.id
       ORDER BY db.created_at DESC`
    );

    res.json({
      success: true,
      data: result.rows,
      total: result.rows.length
    });
  } catch (err) {
    next(err);
  }
}

// GET /api/digitize/batches/:batchId - Get batch detail with documents
export async function getBatchDetail(req, res, next) {
  try {
    const { batchId } = req.params;

    const batchResult = await pool.query(
      `SELECT db.*, u.first_name || ' ' || u.last_name as created_by_name
       FROM msat.digitization_batches db
       LEFT JOIN msat.users u ON db.created_by = u.id
       WHERE db.id = $1`,
      [batchId]
    );

    if (batchResult.rows.length === 0) {
      throw new APIError('Batch not found', 404);
    }

    const docsResult = await pool.query(
      `SELECT d.id, d.file_name, d.original_name, d.file_type, d.mime_type,
              d.file_size, d.category, d.description, d.document_date, d.is_historical,
              d.appeal_id, d.created_at,
              a.file_number as appeal_file_number
       FROM msat.documents d
       LEFT JOIN msat.appeals a ON d.appeal_id = a.id
       WHERE d.batch_id = $1
       ORDER BY d.created_at`,
      [batchId]
    );

    res.json({
      success: true,
      batch: batchResult.rows[0],
      documents: docsResult.rows
    });
  } catch (err) {
    next(err);
  }
}

// GET /api/digitize/lookup-appeal?file_number=xxx - Lookup appeal by file number
export async function lookupAppeal(req, res, next) {
  try {
    const { file_number } = req.query;
    if (!file_number || file_number.trim().length === 0) {
      throw new APIError('file_number query parameter is required', 400);
    }

    const result = await pool.query(
      `SELECT a.id, a.file_number, s.name as settlement_name, a.issue_type, a.status
       FROM msat.appeals a
       LEFT JOIN msat.settlements s ON s.sort_order = CAST(SPLIT_PART(a.file_number, '-', 1) AS INTEGER)
       WHERE a.file_number ILIKE $1
       LIMIT 5`,
      [`%${file_number.trim()}%`]
    );

    res.json({
      success: true,
      data: result.rows
    });
  } catch (err) {
    next(err);
  }
}

// POST /api/digitize/batches - Create batch and upload files
export async function createBatch(req, res, next) {
  const client = await pool.connect();
  try {
    if (!req.files || req.files.length === 0) {
      throw new APIError('At least one file is required', 400);
    }

    const batchName = req.body.batch_name?.trim() ||
      `Batch — ${new Date().toLocaleDateString('en-CA')}`;

    // Parse metadata array from form data
    // metadata is sent as JSON string: [{ appeal_file_number, document_date, category }, ...]
    let metadata = [];
    if (req.body.metadata) {
      try {
        metadata = JSON.parse(req.body.metadata);
      } catch {
        // If metadata parsing fails, use empty array
      }
    }

    await client.query('BEGIN');

    // Create the batch
    const batchResult = await client.query(
      `INSERT INTO msat.digitization_batches (name, status, total_files, processed_files, created_by)
       VALUES ($1, 'In Progress', $2, 0, $3)
       RETURNING *`,
      [batchName, req.files.length, req.user.id]
    );
    const batch = batchResult.rows[0];

    const uploadedDocs = [];
    let processedCount = 0;

    for (let i = 0; i < req.files.length; i++) {
      const file = req.files[i];
      const meta = metadata[i] || {};
      const ext = path.extname(file.originalname).toLowerCase();

      // Validate file type
      if (!ALLOWED_TYPES[ext]) {
        // Clean up this file but continue with others
        fs.unlinkSync(file.path);
        uploadedDocs.push({
          file_name: file.originalname,
          status: 'rejected',
          reason: `Unsupported file type: ${ext}`
        });
        continue;
      }

      // Resolve appeal_id from file_number if provided
      let appealId = null;
      let appealWarning = null;
      if (meta.appeal_file_number?.trim()) {
        const appealResult = await client.query(
          `SELECT id FROM msat.appeals WHERE file_number = $1`,
          [meta.appeal_file_number.trim()]
        );
        if (appealResult.rows.length > 0) {
          appealId = appealResult.rows[0].id;
        } else {
          appealWarning = `Appeal "${meta.appeal_file_number}" not found — document uploaded unlinked`;
        }
      }

      const fileType = ext.replace('.', '');
      const mimeType = ALLOWED_TYPES[ext] || file.mimetype;
      const storageName = file.filename;
      const category = meta.category?.trim() || 'Historical';
      const documentDate = meta.document_date || null;

      const docResult = await client.query(
        `INSERT INTO msat.documents (
          appeal_id, file_name, original_name, file_type, mime_type,
          file_size, storage_url, category, description, uploaded_by,
          batch_id, document_date, is_historical, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, TRUE, NOW())
        RETURNING id`,
        [
          appealId, storageName, file.originalname, fileType, mimeType,
          file.size, `/uploads/${storageName}`, category,
          meta.description?.trim() || null,
          req.user.id, batch.id, documentDate
        ]
      );

      processedCount++;
      uploadedDocs.push({
        id: docResult.rows[0].id,
        file_name: file.originalname,
        status: 'uploaded',
        appeal_id: appealId,
        warning: appealWarning
      });
    }

    // Update batch with final counts
    const finalStatus = processedCount === req.files.length ? 'Completed' : 'Completed with errors';
    await client.query(
      `UPDATE msat.digitization_batches
       SET processed_files = $1, status = $2, completed_at = NOW()
       WHERE id = $3`,
      [processedCount, finalStatus, batch.id]
    );

    // Audit log
    await client.query(
      `INSERT INTO msat.audit_log (user_id, action, entity_type, entity_id, details, ip_address)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [req.user.id, 'digitization_batch_upload', 'digitization_batch', batch.id,
       JSON.stringify({ name: batchName, total_files: req.files.length, processed: processedCount }), req.ip]
    );

    await client.query('COMMIT');

    res.status(201).json({
      success: true,
      message: `Batch uploaded successfully — ${processedCount} of ${req.files.length} files processed`,
      batch: { ...batch, status: finalStatus, processed_files: processedCount },
      documents: uploadedDocs
    });
  } catch (err) {
    await client.query('ROLLBACK');
    // Clean up uploaded files on error
    if (req.files) {
      for (const file of req.files) {
        if (fs.existsSync(file.path)) {
          fs.unlinkSync(file.path);
        }
      }
    }
    next(err);
  } finally {
    client.release();
  }
}
