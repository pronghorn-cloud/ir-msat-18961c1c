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
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png'
};

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

// ── Public endpoints (no auth) ──────────────────────────────────────

// GET /api/public/settlements - List settlements for dropdown
export async function getPublicSettlements(req, res, next) {
  try {
    const result = await pool.query(
      `SELECT name FROM msat.settlements ORDER BY sort_order`
    );
    res.json({ success: true, data: result.rows.map(r => r.name) });
  } catch (err) {
    next(err);
  }
}

// GET /api/public/issue-types - List issue types for dropdown
export async function getPublicIssueTypes(req, res, next) {
  try {
    const result = await pool.query(
      `SELECT name FROM msat.issue_types ORDER BY sort_order`
    );
    res.json({ success: true, data: result.rows.map(r => r.name) });
  } catch (err) {
    next(err);
  }
}

// POST /api/public/submissions - Submit appeal (public, no auth)
export async function createSubmission(req, res, next) {
  const client = await pool.connect();
  try {
    const {
      full_name, member_id, settlement, phone, email, address,
      issue_type, decision_date, decision_maker, description,
      declaration_truthful, declaration_deadlines
    } = req.body;

    // Validation
    if (!full_name?.trim()) throw new APIError('Full name is required', 400);
    if (!settlement?.trim()) throw new APIError('Settlement is required', 400);
    if (!issue_type?.trim()) throw new APIError('Issue type is required', 400);
    if (!description?.trim()) throw new APIError('Description is required', 400);
    if (!declaration_truthful) throw new APIError('You must declare the information is true and accurate', 400);
    if (!declaration_deadlines) throw new APIError('You must acknowledge the appeal filing deadlines', 400);

    await client.query('BEGIN');

    // Generate reference number
    const seqResult = await client.query(`SELECT nextval('msat.submission_ref_seq') as seq`);
    const seq = seqResult.rows[0].seq;
    const reference_number = `SUB-${String(seq).padStart(4, '0')}`;

    // Insert submission
    const result = await client.query(
      `INSERT INTO msat.appeal_submissions (
        reference_number, full_name, member_id, settlement, phone, email, address,
        issue_type, decision_date, decision_maker, description,
        declaration_truthful, declaration_deadlines,
        status, ip_address, user_agent
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, 'Pending', $14, $15)
      RETURNING id, reference_number, created_at`,
      [
        reference_number,
        full_name.trim(), member_id?.trim() || null, settlement.trim(),
        phone?.trim() || null, email?.trim() || null, address?.trim() || null,
        issue_type.trim(), decision_date || null, decision_maker?.trim() || null,
        description.trim(),
        declaration_truthful, declaration_deadlines,
        req.ip, req.get('User-Agent')
      ]
    );

    const submission = result.rows[0];

    // Handle file uploads if present
    const uploadedDocs = [];
    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        const ext = path.extname(file.originalname).toLowerCase();

        if (!ALLOWED_TYPES[ext]) {
          fs.unlinkSync(file.path);
          continue;
        }
        if (file.size > MAX_FILE_SIZE) {
          fs.unlinkSync(file.path);
          continue;
        }

        const fileType = ext.replace('.', '');
        const mimeType = ALLOWED_TYPES[ext] || file.mimetype;

        await client.query(
          `INSERT INTO msat.submission_documents
           (submission_id, file_name, original_name, file_type, mime_type, file_size, storage_url)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [submission.id, file.filename, file.originalname, fileType, mimeType, file.size, `/uploads/${file.filename}`]
        );
        uploadedDocs.push({ original_name: file.originalname, size: file.size });
      }
    }

    await client.query('COMMIT');

    res.status(201).json({
      success: true,
      message: `Your appeal has been submitted successfully. Reference number: ${reference_number}`,
      reference_number,
      submission_id: submission.id,
      documents_uploaded: uploadedDocs.length
    });
  } catch (err) {
    await client.query('ROLLBACK');
    if (req.files) {
      for (const file of req.files) {
        if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
      }
    }
    next(err);
  } finally {
    client.release();
  }
}

// ── Staff endpoints (auth required) ─────────────────────────────────

// GET /api/submissions - List all submissions (staff)
export async function listSubmissions(req, res, next) {
  try {
    const { status, limit = 20, offset = 0 } = req.query;

    const conditions = [];
    const params = [];
    let paramIdx = 1;

    if (status && status.trim().length > 0) {
      conditions.push(`s.status = $${paramIdx}`);
      params.push(status.trim());
      paramIdx++;
    }

    const whereClause = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';
    const limitVal = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100);
    const offsetVal = Math.max(parseInt(offset, 10) || 0, 0);

    const countResult = await pool.query(
      `SELECT COUNT(*) as total FROM msat.appeal_submissions s ${whereClause}`,
      params
    );
    const total = parseInt(countResult.rows[0].total, 10);

    const dataResult = await pool.query(
      `SELECT s.*,
              u.first_name || ' ' || u.last_name as reviewed_by_name,
              (SELECT COUNT(*) FROM msat.submission_documents sd WHERE sd.submission_id = s.id) as document_count
       FROM msat.appeal_submissions s
       LEFT JOIN msat.users u ON s.reviewed_by = u.id
       ${whereClause}
       ORDER BY s.created_at DESC
       LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`,
      [...params, limitVal, offsetVal]
    );

    res.json({
      success: true,
      data: dataResult.rows,
      total,
      limit: limitVal,
      offset: offsetVal
    });
  } catch (err) {
    next(err);
  }
}

// GET /api/submissions/:id - Get submission detail (staff)
export async function getSubmissionById(req, res, next) {
  try {
    const { id } = req.params;

    const subResult = await pool.query(
      `SELECT s.*,
              u.first_name || ' ' || u.last_name as reviewed_by_name
       FROM msat.appeal_submissions s
       LEFT JOIN msat.users u ON s.reviewed_by = u.id
       WHERE s.id = $1`,
      [id]
    );

    if (subResult.rows.length === 0) {
      throw new APIError('Submission not found', 404);
    }

    const docsResult = await pool.query(
      `SELECT id, original_name, file_type, mime_type, file_size, created_at
       FROM msat.submission_documents
       WHERE submission_id = $1
       ORDER BY created_at`,
      [id]
    );

    res.json({
      success: true,
      submission: subResult.rows[0],
      documents: docsResult.rows
    });
  } catch (err) {
    next(err);
  }
}

// PATCH /api/submissions/:id/review - Update submission status (staff)
export async function reviewSubmission(req, res, next) {
  try {
    const { id } = req.params;
    const { status, staff_notes } = req.body;

    const validStatuses = ['Pending', 'Reviewed', 'Converted', 'Rejected'];
    if (status && !validStatuses.includes(status)) {
      throw new APIError(`Invalid status. Must be one of: ${validStatuses.join(', ')}`, 400);
    }

    const result = await pool.query(
      `UPDATE msat.appeal_submissions
       SET status = COALESCE($1, status),
           staff_notes = COALESCE($2, staff_notes),
           reviewed_by = $3,
           reviewed_at = NOW(),
           updated_at = NOW()
       WHERE id = $4
       RETURNING *`,
      [status || null, staff_notes || null, req.user.id, id]
    );

    if (result.rows.length === 0) {
      throw new APIError('Submission not found', 404);
    }

    res.json({
      success: true,
      message: `Submission updated to ${result.rows[0].status}`,
      submission: result.rows[0]
    });
  } catch (err) {
    next(err);
  }
}
