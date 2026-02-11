import bcrypt from 'bcryptjs';
import pool from '../config/database.js';
import { APIError } from '../middleware/errorHandler.js';

// GET /api/admin/users - List all users
export async function listUsers(req, res, next) {
  try {
    const result = await pool.query(
      `SELECT id, email, first_name, last_name, role, is_active, last_login, created_at, updated_at
       FROM msat.users
       ORDER BY created_at DESC`
    );

    res.json({ success: true, users: result.rows });
  } catch (err) {
    next(err);
  }
}

// POST /api/admin/users - Create a new user
export async function createUser(req, res, next) {
  try {
    const { email, first_name, last_name, role, password } = req.body;

    if (!email || !first_name || !last_name || !role || !password) {
      throw new APIError('All fields are required: email, first_name, last_name, role, password', 400);
    }

    const validRoles = ['admin', 'staff', 'board_member', 'user'];
    if (!validRoles.includes(role)) {
      throw new APIError(`Invalid role. Must be one of: ${validRoles.join(', ')}`, 400);
    }

    if (password.length < 6) {
      throw new APIError('Password must be at least 6 characters', 400);
    }

    // Check if email already exists
    const existing = await pool.query(
      'SELECT id FROM msat.users WHERE email = $1',
      [email.toLowerCase().trim()]
    );

    if (existing.rows.length > 0) {
      throw new APIError('A user with this email already exists', 409);
    }

    // Hash password
    const salt = await bcrypt.genSalt(12);
    const passwordHash = await bcrypt.hash(password, salt);

    // Create user
    const result = await pool.query(
      `INSERT INTO msat.users (email, password_hash, first_name, last_name, role, is_active, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, true, NOW(), NOW())
       RETURNING id, email, first_name, last_name, role, is_active, created_at`,
      [email.toLowerCase().trim(), passwordHash, first_name.trim(), last_name.trim(), role]
    );

    // Log audit event
    await pool.query(
      `INSERT INTO msat.audit_log (user_id, action, entity_type, entity_id, details, ip_address)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [req.user.id, 'user_create', 'user', result.rows[0].id, JSON.stringify({ email: email.toLowerCase().trim(), role }), req.ip]
    );

    res.status(201).json({ success: true, message: 'User created successfully', user: result.rows[0] });
  } catch (err) {
    next(err);
  }
}

// PUT /api/admin/users/:id - Update a user
export async function updateUser(req, res, next) {
  try {
    const { id } = req.params;
    const { first_name, last_name, role } = req.body;

    if (!first_name || !last_name || !role) {
      throw new APIError('first_name, last_name, and role are required', 400);
    }

    const validRoles = ['admin', 'staff', 'board_member', 'user'];
    if (!validRoles.includes(role)) {
      throw new APIError(`Invalid role. Must be one of: ${validRoles.join(', ')}`, 400);
    }

    // Prevent admin from changing their own role
    if (id === req.user.id && role !== req.user.role) {
      throw new APIError('You cannot change your own role', 400);
    }

    const result = await pool.query(
      `UPDATE msat.users SET first_name = $1, last_name = $2, role = $3, updated_at = NOW()
       WHERE id = $4
       RETURNING id, email, first_name, last_name, role, is_active, last_login, created_at`,
      [first_name.trim(), last_name.trim(), role, id]
    );

    if (result.rows.length === 0) {
      throw new APIError('User not found', 404);
    }

    // Log audit event
    await pool.query(
      `INSERT INTO msat.audit_log (user_id, action, entity_type, entity_id, details, ip_address)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [req.user.id, 'user_update', 'user', id, JSON.stringify({ first_name, last_name, role }), req.ip]
    );

    res.json({ success: true, message: 'User updated successfully', user: result.rows[0] });
  } catch (err) {
    next(err);
  }
}

// PUT /api/admin/users/:id/block - Block a user
export async function blockUser(req, res, next) {
  try {
    const { id } = req.params;

    // Prevent admin from blocking themselves
    if (id === req.user.id) {
      throw new APIError('You cannot block your own account', 400);
    }

    const result = await pool.query(
      `UPDATE msat.users SET is_active = false, updated_at = NOW()
       WHERE id = $1
       RETURNING id, email, first_name, last_name, role, is_active`,
      [id]
    );

    if (result.rows.length === 0) {
      throw new APIError('User not found', 404);
    }

    // Log audit event
    await pool.query(
      `INSERT INTO msat.audit_log (user_id, action, entity_type, entity_id, details, ip_address)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [req.user.id, 'user_block', 'user', id, JSON.stringify({ email: result.rows[0].email }), req.ip]
    );

    res.json({ success: true, message: 'User blocked successfully', user: result.rows[0] });
  } catch (err) {
    next(err);
  }
}

// PUT /api/admin/users/:id/unblock - Unblock a user
export async function unblockUser(req, res, next) {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `UPDATE msat.users SET is_active = true, updated_at = NOW()
       WHERE id = $1
       RETURNING id, email, first_name, last_name, role, is_active`,
      [id]
    );

    if (result.rows.length === 0) {
      throw new APIError('User not found', 404);
    }

    // Log audit event
    await pool.query(
      `INSERT INTO msat.audit_log (user_id, action, entity_type, entity_id, details, ip_address)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [req.user.id, 'user_unblock', 'user', id, JSON.stringify({ email: result.rows[0].email }), req.ip]
    );

    res.json({ success: true, message: 'User unblocked successfully', user: result.rows[0] });
  } catch (err) {
    next(err);
  }
}
