import pool from '../config/database.js';
import { APIError } from '../middleware/errorHandler.js';

// GET /api/organizations/search?q=name
export async function searchOrganizations(req, res, next) {
  try {
    const { q } = req.query;

    if (!q || q.trim().length < 2) {
      return res.json({ success: true, data: [] });
    }

    const searchTerm = `%${q.trim()}%`;

    const result = await pool.query(
      `SELECT id, name, type, city, province, phone, email
       FROM msat.organizations
       WHERE name ILIKE $1
       ORDER BY name
       LIMIT 20`,
      [searchTerm]
    );

    res.json({ success: true, data: result.rows });
  } catch (err) {
    next(err);
  }
}

// GET /api/organizations?search=&type=&limit=&offset=
export async function listOrganizations(req, res, next) {
  try {
    const { search, type, limit = 50, offset = 0 } = req.query;
    const params = [];
    const conditions = [];

    if (search && search.trim().length >= 2) {
      params.push(`%${search.trim()}%`);
      conditions.push(`name ILIKE $${params.length}`);
    }

    if (type) {
      params.push(type);
      conditions.push(`type = $${params.length}`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countResult = await pool.query(
      `SELECT COUNT(*) as total FROM msat.organizations ${whereClause}`,
      params
    );

    const dataParams = [...params, parseInt(limit), parseInt(offset)];
    const result = await pool.query(
      `SELECT id, name, type, city, province, phone, email, created_at
       FROM msat.organizations
       ${whereClause}
       ORDER BY name
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      dataParams
    );

    res.json({
      success: true,
      data: result.rows,
      total: parseInt(countResult.rows[0].total),
      limit: parseInt(limit),
      offset: parseInt(offset)
    });
  } catch (err) {
    next(err);
  }
}

// GET /api/organizations/:id
export async function getOrganizationById(req, res, next) {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `SELECT * FROM msat.organizations WHERE id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      throw new APIError('Organization not found', 404);
    }

    res.json({ success: true, organization: result.rows[0] });
  } catch (err) {
    next(err);
  }
}

// POST /api/organizations
export async function createOrganization(req, res, next) {
  try {
    const {
      name, type, address_1, address_2, city, province,
      postal_code, phone, fax, toll_free, email
    } = req.body;

    if (!name?.trim()) {
      throw new APIError('Organization name is required', 400);
    }

    const result = await pool.query(
      `INSERT INTO msat.organizations (
        name, type, address_1, address_2, city, province,
        postal_code, phone, fax, toll_free, email,
        created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), NOW())
      RETURNING *`,
      [
        name.trim(), type?.trim() || 'Other',
        address_1?.trim() || null, address_2?.trim() || null,
        city?.trim() || null, province?.trim() || 'AB',
        postal_code?.trim() || null, phone?.trim() || null,
        fax?.trim() || null, toll_free?.trim() || null,
        email?.trim() || null
      ]
    );

    await pool.query(
      `INSERT INTO msat.audit_log (user_id, action, entity_type, entity_id, details, ip_address)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [req.user.id, 'organization_create', 'organization', result.rows[0].id,
       JSON.stringify({ name: name.trim(), type: type?.trim() || 'Other' }), req.ip]
    );

    res.status(201).json({
      success: true,
      message: `Organization "${name.trim()}" created successfully`,
      organization: result.rows[0]
    });
  } catch (err) {
    next(err);
  }
}

// PATCH /api/organizations/:id
export async function updateOrganization(req, res, next) {
  try {
    const { id } = req.params;

    const existing = await pool.query('SELECT id FROM msat.organizations WHERE id = $1', [id]);
    if (existing.rows.length === 0) {
      throw new APIError('Organization not found', 404);
    }

    const allowedFields = [
      'name', 'type', 'address_1', 'address_2', 'city', 'province',
      'postal_code', 'phone', 'fax', 'toll_free', 'email'
    ];

    const updates = [];
    const values = [];
    let paramIndex = 1;

    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        updates.push(`${field} = $${paramIndex}`);
        const val = req.body[field];
        values.push(typeof val === 'string' ? (val.trim() || null) : val);
        paramIndex++;
      }
    }

    if (updates.length === 0) {
      throw new APIError('No fields to update', 400);
    }

    updates.push(`updated_at = NOW()`);
    values.push(id);

    const result = await pool.query(
      `UPDATE msat.organizations SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      values
    );

    const changedFields = {};
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) changedFields[field] = req.body[field];
    }
    await pool.query(
      `INSERT INTO msat.audit_log (user_id, action, entity_type, entity_id, details, ip_address)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [req.user.id, 'organization_update', 'organization', id,
       JSON.stringify(changedFields), req.ip]
    );

    res.json({
      success: true,
      message: `Organization "${result.rows[0].name}" updated successfully`,
      organization: result.rows[0]
    });
  } catch (err) {
    next(err);
  }
}
