import pool from '../config/database.js';

// ==============================
// PUBLIC endpoints (no auth)
// ==============================

// GET /api/public/content/:pageSlug — published content for a page
export async function getPageContent(req, res, next) {
  try {
    const { pageSlug } = req.params;
    const result = await pool.query(`
      SELECT id, page_slug, section_key, title, body, sort_order, updated_at
      FROM msat.site_content
      WHERE page_slug = $1 AND is_published = true
      ORDER BY sort_order ASC
    `, [pageSlug]);

    res.json({
      success: true,
      data: result.rows
    });
  } catch (err) {
    next(err);
  }
}

// ==============================
// ADMIN endpoints (staff/admin auth required)
// ==============================

// GET /api/content — all content blocks (including drafts)
export async function listAllContent(req, res, next) {
  try {
    const result = await pool.query(`
      SELECT id, page_slug, section_key, title,
             is_published, sort_order, updated_by, updated_at, created_at
      FROM msat.site_content
      ORDER BY page_slug, sort_order
    `);
    res.json({
      success: true,
      data: result.rows
    });
  } catch (err) {
    next(err);
  }
}

// GET /api/content/:id — single content block with full body
export async function getContentById(req, res, next) {
  try {
    const result = await pool.query(
      'SELECT * FROM msat.site_content WHERE id = $1',
      [req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Content not found' });
    }
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    next(err);
  }
}

// POST /api/content — create new content block
export async function createContent(req, res, next) {
  try {
    const { page_slug, section_key, title, body, is_published = true, sort_order = 0 } = req.body;

    if (!page_slug || !section_key) {
      return res.status(400).json({ success: false, message: 'page_slug and section_key are required' });
    }

    const result = await pool.query(`
      INSERT INTO msat.site_content (page_slug, section_key, title, body, is_published, sort_order, updated_by)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `, [page_slug, section_key, title || '', body || '', is_published, sort_order, req.user.email]);

    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ success: false, message: 'Content block with this page_slug and section_key already exists' });
    }
    next(err);
  }
}

// PUT /api/content/:id — update content block
export async function updateContent(req, res, next) {
  try {
    const { title, body, is_published, sort_order } = req.body;
    const { id } = req.params;

    const existing = await pool.query('SELECT id FROM msat.site_content WHERE id = $1', [id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Content not found' });
    }

    const result = await pool.query(`
      UPDATE msat.site_content
      SET title = COALESCE($1, title),
          body = COALESCE($2, body),
          is_published = COALESCE($3, is_published),
          sort_order = COALESCE($4, sort_order),
          updated_by = $5
      WHERE id = $6
      RETURNING *
    `, [title, body, is_published, sort_order, req.user.email, id]);

    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    next(err);
  }
}

// DELETE /api/content/:id — delete content block
export async function deleteContent(req, res, next) {
  try {
    const result = await pool.query(
      'DELETE FROM msat.site_content WHERE id = $1 RETURNING id',
      [req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Content not found' });
    }
    res.json({ success: true, message: 'Content deleted' });
  } catch (err) {
    next(err);
  }
}
