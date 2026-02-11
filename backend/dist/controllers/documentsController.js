import pool from '../config/database.js';
import { APIError } from '../middleware/errorHandler.js';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const UPLOADS_DIR = path.join(__dirname, '../../uploads');

// Allowed file types and their MIME types
const ALLOWED_TYPES = {
  '.pdf': 'application/pdf',
  '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.xls': 'application/vnd.ms-excel',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.document',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png'
};

// Max file sizes by type (in bytes)
const MAX_SIZES = {
  '.pdf': 50 * 1024 * 1024,    // 50MB
  '.doc': 50 * 1024 * 1024,
  '.docx': 50 * 1024 * 1024,
  '.xls': 25 * 1024 * 1024,    // 25MB
  '.xlsx': 25 * 1024 * 1024,
  '.jpg': 10 * 1024 * 1024,    // 10MB
  '.jpeg': 10 * 1024 * 1024,
  '.png': 10 * 1024 * 1024
};

// POST /api/appeals/:id/documents - Upload document
export async function uploadDocument(req, res, next) {
  try {
    const { id: appealId } = req.params;

    // Verify appeal exists
    const appealCheck = await pool.query('SELECT id FROM msat.appeals WHERE id = $1', [appealId]);
    if (appealCheck.rows.length === 0) {
      // Clean up uploaded file if appeal doesn't exist
      if (req.file) fs.unlinkSync(req.file.path);
      throw new APIError('Appeal not found', 404);
    }

    if (!req.file) {
      throw new APIError('No file provided', 400);
    }

    const originalName = req.file.originalname;
    const ext = path.extname(originalName).toLowerCase();

    // Validate file type
    if (!ALLOWED_TYPES[ext]) {
      fs.unlinkSync(req.file.path);
      throw new APIError(
        `File type "${ext}" is not allowed. Accepted types: PDF, Word, Excel, JPG, PNG`,
        400
      );
    }

    // Validate file size
    const maxSize = MAX_SIZES[ext];
    if (req.file.size > maxSize) {
      fs.unlinkSync(req.file.path);
      const maxMB = (maxSize / (1024 * 1024)).toFixed(0);
      throw new APIError(`File too large. Maximum size for ${ext} files is ${maxMB}MB`, 400);
    }

    const { category, description } = req.body;
    const fileType = ext.replace('.', '');
    const mimeType = ALLOWED_TYPES[ext] || req.file.mimetype;
    const storageName = req.file.filename;

    const result = await pool.query(
      `INSERT INTO msat.documents (
        appeal_id, file_name, original_name, file_type, mime_type,
        file_size, storage_url, category, description, uploaded_by, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
      RETURNING *`,
      [
        appealId, storageName, originalName, fileType, mimeType,
        req.file.size, `/uploads/${storageName}`,
        category?.trim() || null, description?.trim() || null,
        req.user.id
      ]
    );

    await pool.query(
      `INSERT INTO msat.audit_log (user_id, action, entity_type, entity_id, details, ip_address)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [req.user.id, 'document_upload', 'document', result.rows[0].id,
       JSON.stringify({ appeal_id: appealId, file_name: originalName, category: category || null }), req.ip]
    );

    res.status(201).json({
      success: true,
      message: `Document "${originalName}" uploaded successfully`,
      document: result.rows[0]
    });
  } catch (err) {
    next(err);
  }
}

// GET /api/appeals/:id/documents/:docId/download - Download document
export async function downloadDocument(req, res, next) {
  try {
    const { id: appealId, docId } = req.params;

    const result = await pool.query(
      `SELECT * FROM msat.documents WHERE id = $1 AND appeal_id = $2`,
      [docId, appealId]
    );

    if (result.rows.length === 0) {
      throw new APIError('Document not found', 404);
    }

    const doc = result.rows[0];
    const filePath = path.join(UPLOADS_DIR, doc.file_name);

    if (!fs.existsSync(filePath)) {
      throw new APIError('Document file not found on server', 404);
    }

    const downloadName = doc.original_name || doc.file_name;
    const contentType = doc.mime_type || 'application/octet-stream';

    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(downloadName)}"`);
    res.setHeader('Content-Length', doc.file_size);

    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);
  } catch (err) {
    next(err);
  }
}

// DELETE /api/appeals/:id/documents/:docId - Delete document
export async function deleteDocument(req, res, next) {
  try {
    const { id: appealId, docId } = req.params;

    const result = await pool.query(
      `SELECT * FROM msat.documents WHERE id = $1 AND appeal_id = $2`,
      [docId, appealId]
    );

    if (result.rows.length === 0) {
      throw new APIError('Document not found', 404);
    }

    const doc = result.rows[0];

    // Delete from database
    await pool.query('DELETE FROM msat.documents WHERE id = $1', [docId]);

    // Delete file from disk
    const filePath = path.join(UPLOADS_DIR, doc.file_name);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    await pool.query(
      `INSERT INTO msat.audit_log (user_id, action, entity_type, entity_id, details, ip_address)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [req.user.id, 'document_delete', 'document', docId,
       JSON.stringify({ appeal_id: appealId, file_name: doc.original_name || doc.file_name }), req.ip]
    );

    res.json({
      success: true,
      message: `Document "${doc.original_name || doc.file_name}" deleted successfully`
    });
  } catch (err) {
    next(err);
  }
}

// POST /api/appeals/:id/hearing-packages - Compile hearing package
export async function compileHearingPackage(req, res, next) {
  try {
    const { id: appealId } = req.params;
    const { name, document_ids, hearing_id } = req.body;

    // Verify appeal exists
    const appealCheck = await pool.query('SELECT id FROM msat.appeals WHERE id = $1', [appealId]);
    if (appealCheck.rows.length === 0) {
      throw new APIError('Appeal not found', 404);
    }

    if (!document_ids || !Array.isArray(document_ids) || document_ids.length === 0) {
      throw new APIError('At least one document must be selected', 400);
    }

    // Verify all documents belong to this appeal
    const docsCheck = await pool.query(
      `SELECT id FROM msat.documents WHERE appeal_id = $1 AND id = ANY($2)`,
      [appealId, document_ids]
    );
    if (docsCheck.rows.length !== document_ids.length) {
      throw new APIError('One or more documents not found for this appeal', 400);
    }

    const packageName = name?.trim() || `Hearing Package — ${new Date().toLocaleDateString('en-CA')}`;

    // Create the hearing package
    const packageResult = await pool.query(
      `INSERT INTO msat.hearing_packages (appeal_id, hearing_id, name, status, compiled_by, compiled_date)
       VALUES ($1, $2, $3, 'Compiled', $4, NOW())
       RETURNING *`,
      [appealId, hearing_id || null, packageName, req.user.id]
    );
    const pkg = packageResult.rows[0];

    // Link documents to the package
    for (let i = 0; i < document_ids.length; i++) {
      await pool.query(
        `INSERT INTO msat.hearing_package_documents (package_id, document_id, sort_order)
         VALUES ($1, $2, $3)`,
        [pkg.id, document_ids[i], i + 1]
      );
    }

    await pool.query(
      `INSERT INTO msat.audit_log (user_id, action, entity_type, entity_id, details, ip_address)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [req.user.id, 'hearing_package_compile', 'hearing_package', pkg.id,
       JSON.stringify({ appeal_id: appealId, name: packageName, document_count: document_ids.length }), req.ip]
    );

    res.status(201).json({
      success: true,
      message: `Hearing package "${packageName}" compiled successfully with ${document_ids.length} document(s)`,
      hearing_package: pkg
    });
  } catch (err) {
    next(err);
  }
}

// GET /api/appeals/:id/hearing-packages/:pkgId - Get hearing package with documents
export async function getHearingPackage(req, res, next) {
  try {
    const { id: appealId, pkgId } = req.params;

    const pkgResult = await pool.query(
      `SELECT hp.*, u.first_name || ' ' || u.last_name as compiled_by_name
       FROM msat.hearing_packages hp
       LEFT JOIN msat.users u ON hp.compiled_by = u.id
       WHERE hp.id = $1 AND hp.appeal_id = $2`,
      [pkgId, appealId]
    );

    if (pkgResult.rows.length === 0) {
      throw new APIError('Hearing package not found', 404);
    }

    const docsResult = await pool.query(
      `SELECT d.id, d.file_name, d.original_name, d.file_type, d.file_size, d.category, d.created_at,
              hpd.sort_order
       FROM msat.hearing_package_documents hpd
       JOIN msat.documents d ON d.id = hpd.document_id
       WHERE hpd.package_id = $1
       ORDER BY hpd.sort_order`,
      [pkgId]
    );

    res.json({
      success: true,
      hearing_package: pkgResult.rows[0],
      documents: docsResult.rows
    });
  } catch (err) {
    next(err);
  }
}
