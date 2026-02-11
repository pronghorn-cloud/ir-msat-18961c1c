import pool from '../config/database.js';
import { APIError } from '../middleware/errorHandler.js';

// GET /api/clients/search?q=name_or_member_id
export async function searchClients(req, res, next) {
  try {
    const { q } = req.query;

    if (!q || q.trim().length < 2) {
      return res.json({ success: true, data: [] });
    }

    const searchTerm = `%${q.trim()}%`;

    const result = await pool.query(
      `SELECT id, member_id, first_name, last_name, email, phone_home, phone_cell, city, settlement
       FROM msat.clients
       WHERE first_name ILIKE $1 OR last_name ILIKE $1
          OR CONCAT(first_name, ' ', last_name) ILIKE $1
          OR member_id ILIKE $1
       ORDER BY last_name, first_name
       LIMIT 20`,
      [searchTerm]
    );

    res.json({ success: true, data: result.rows });
  } catch (err) {
    next(err);
  }
}

// GET /api/clients?search=&limit=&offset=
export async function listClients(req, res, next) {
  try {
    const { search, limit = 25, offset = 0 } = req.query;
    const params = [];
    let whereClause = '';

    if (search && search.trim().length >= 2) {
      const searchTerm = `%${search.trim()}%`;
      params.push(searchTerm);
      whereClause = `WHERE first_name ILIKE $1 OR last_name ILIKE $1
         OR CONCAT(first_name, ' ', last_name) ILIKE $1
         OR member_id ILIKE $1
         OR email ILIKE $1`;
    }

    const countResult = await pool.query(
      `SELECT COUNT(*) as total FROM msat.clients ${whereClause}`,
      params
    );

    const dataParams = [...params, parseInt(limit), parseInt(offset)];
    const result = await pool.query(
      `SELECT id, member_id, first_name, last_name, email, phone_home, phone_cell, city, settlement, org_name, created_at
       FROM msat.clients
       ${whereClause}
       ORDER BY last_name, first_name
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

// GET /api/clients/:id
export async function getClientById(req, res, next) {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `SELECT * FROM msat.clients WHERE id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      throw new APIError('Client not found', 404);
    }

    res.json({ success: true, client: result.rows[0] });
  } catch (err) {
    next(err);
  }
}

// POST /api/clients
export async function createClient(req, res, next) {
  try {
    const {
      first_name, last_name, member_id, title, middle_name,
      address_1, address_2, city, province, postal_code,
      date_of_birth, phone_home, phone_work, phone_cell, fax,
      email, settlement, org_name, job_title, department, notes
    } = req.body;

    if (!first_name?.trim() || !last_name?.trim()) {
      throw new APIError('First name and last name are required', 400);
    }

    const result = await pool.query(
      `INSERT INTO msat.clients (
        first_name, last_name, member_id, title, middle_name,
        address_1, address_2, city, province, postal_code,
        date_of_birth, phone_home, phone_work, phone_cell, fax,
        email, settlement, org_name, job_title, department, notes,
        created_at, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5,
        $6, $7, $8, $9, $10,
        $11, $12, $13, $14, $15,
        $16, $17, $18, $19, $20, $21,
        NOW(), NOW()
      ) RETURNING *`,
      [
        first_name.trim(), last_name.trim(), member_id?.trim() || null,
        title?.trim() || null, middle_name?.trim() || null,
        address_1?.trim() || null, address_2?.trim() || null,
        city?.trim() || null, province?.trim() || 'AB', postal_code?.trim() || null,
        date_of_birth || null, phone_home?.trim() || null,
        phone_work?.trim() || null, phone_cell?.trim() || null, fax?.trim() || null,
        email?.trim() || null, settlement?.trim() || null,
        org_name?.trim() || null, job_title?.trim() || null,
        department?.trim() || null, notes?.trim() || null
      ]
    );

    // Audit log
    await pool.query(
      `INSERT INTO msat.audit_log (user_id, action, entity_type, entity_id, details, ip_address)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [req.user.id, 'client_create', 'client', result.rows[0].id,
       JSON.stringify({ first_name: first_name.trim(), last_name: last_name.trim(), member_id: member_id?.trim() || null }),
       req.ip]
    );

    res.status(201).json({
      success: true,
      message: `Client ${first_name.trim()} ${last_name.trim()} created successfully`,
      client: result.rows[0]
    });
  } catch (err) {
    next(err);
  }
}

// PATCH /api/clients/:id
export async function updateClient(req, res, next) {
  try {
    const { id } = req.params;

    const existing = await pool.query('SELECT id FROM msat.clients WHERE id = $1', [id]);
    if (existing.rows.length === 0) {
      throw new APIError('Client not found', 404);
    }

    const allowedFields = [
      'first_name', 'last_name', 'member_id', 'title', 'middle_name',
      'address_1', 'address_2', 'city', 'province', 'postal_code',
      'date_of_birth', 'phone_home', 'phone_work', 'phone_cell', 'fax',
      'email', 'settlement', 'org_name', 'job_title', 'department', 'notes'
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
      `UPDATE msat.clients SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      values
    );

    // Audit log
    const changedFields = {};
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) changedFields[field] = req.body[field];
    }
    await pool.query(
      `INSERT INTO msat.audit_log (user_id, action, entity_type, entity_id, details, ip_address)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [req.user.id, 'client_update', 'client', id,
       JSON.stringify(changedFields), req.ip]
    );

    res.json({
      success: true,
      message: `Client ${result.rows[0].first_name} ${result.rows[0].last_name} updated successfully`,
      client: result.rows[0]
    });
  } catch (err) {
    next(err);
  }
}
