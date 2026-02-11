import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import pool from '../config/database.js';
import { APIError } from '../middleware/errorHandler.js';

function generateTokens(user) {
  const payload = {
    id: user.id,
    email: user.email,
    role: user.role,
    first_name: user.first_name,
    last_name: user.last_name
  };

  const token = jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '8h'
  });

  const refreshToken = jwt.sign(
    { id: user.id },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d' }
  );

  return { token, refreshToken };
}

export async function login(req, res, next) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      throw new APIError('Email and password are required', 400);
    }

    // Find user
    const result = await pool.query(
      'SELECT * FROM msat.users WHERE email = $1 AND is_active = true',
      [email.toLowerCase().trim()]
    );

    if (result.rows.length === 0) {
      throw new APIError('Invalid email or password', 401);
    }

    const user = result.rows[0];

    // Verify password
    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
      throw new APIError('Invalid email or password', 401);
    }

    // Generate tokens
    const { token, refreshToken } = generateTokens(user);

    // Update last login
    await pool.query(
      'UPDATE msat.users SET last_login = NOW() WHERE id = $1',
      [user.id]
    );

    // Log audit event
    await pool.query(
      `INSERT INTO msat.audit_log (user_id, action, entity_type, details, ip_address)
       VALUES ($1, $2, $3, $4, $5)`,
      [user.id, 'login', 'user', JSON.stringify({ email: user.email, role: user.role }), req.ip]
    );

    res.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name,
        role: user.role
      },
      token,
      refreshToken
    });
  } catch (err) {
    next(err);
  }
}

export async function getMe(req, res, next) {
  try {
    const result = await pool.query(
      'SELECT id, email, first_name, last_name, role, last_login, created_at FROM msat.users WHERE id = $1',
      [req.user.id]
    );

    if (result.rows.length === 0) {
      throw new APIError('User not found', 404);
    }

    res.json({ success: true, user: result.rows[0] });
  } catch (err) {
    next(err);
  }
}

export async function refreshToken(req, res, next) {
  try {
    const { refreshToken: token } = req.body;

    if (!token) {
      throw new APIError('Refresh token is required', 400);
    }

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
      throw new APIError('Invalid refresh token', 401);
    }

    // Get fresh user data
    const result = await pool.query(
      'SELECT * FROM msat.users WHERE id = $1 AND is_active = true',
      [decoded.id]
    );

    if (result.rows.length === 0) {
      throw new APIError('User not found or inactive', 401);
    }

    const user = result.rows[0];
    const tokens = generateTokens(user);

    res.json({
      success: true,
      token: tokens.token,
      refreshToken: tokens.refreshToken
    });
  } catch (err) {
    next(err);
  }
}

export async function updateProfile(req, res, next) {
  try {
    const { first_name, last_name } = req.body;

    if (!first_name || !last_name) {
      throw new APIError('First name and last name are required', 400);
    }

    if (first_name.length > 100 || last_name.length > 100) {
      throw new APIError('Name fields must be 100 characters or less', 400);
    }

    // Update user profile
    const result = await pool.query(
      `UPDATE msat.users SET first_name = $1, last_name = $2, updated_at = NOW()
       WHERE id = $3 AND is_active = true
       RETURNING id, email, first_name, last_name, role, last_login, created_at`,
      [first_name.trim(), last_name.trim(), req.user.id]
    );

    if (result.rows.length === 0) {
      throw new APIError('User not found', 404);
    }

    // Log audit event
    await pool.query(
      `INSERT INTO msat.audit_log (user_id, action, entity_type, details, ip_address)
       VALUES ($1, $2, $3, $4, $5)`,
      [req.user.id, 'profile_update', 'user', JSON.stringify({ first_name, last_name }), req.ip]
    );

    res.json({ success: true, message: 'Profile updated successfully', user: result.rows[0] });
  } catch (err) {
    next(err);
  }
}

export async function changePassword(req, res, next) {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      throw new APIError('Current password and new password are required', 400);
    }

    if (newPassword.length < 6) {
      throw new APIError('New password must be at least 6 characters', 400);
    }

    // Get user with password hash
    const result = await pool.query(
      'SELECT * FROM msat.users WHERE id = $1 AND is_active = true',
      [req.user.id]
    );

    if (result.rows.length === 0) {
      throw new APIError('User not found', 404);
    }

    const user = result.rows[0];

    // Verify current password
    const validPassword = await bcrypt.compare(currentPassword, user.password_hash);
    if (!validPassword) {
      throw new APIError('Current password is incorrect', 400);
    }

    // Hash new password and update
    const salt = await bcrypt.genSalt(12);
    const newHash = await bcrypt.hash(newPassword, salt);

    await pool.query(
      'UPDATE msat.users SET password_hash = $1, updated_at = NOW() WHERE id = $2',
      [newHash, req.user.id]
    );

    // Log audit event
    await pool.query(
      `INSERT INTO msat.audit_log (user_id, action, entity_type, details, ip_address)
       VALUES ($1, $2, $3, $4, $5)`,
      [req.user.id, 'password_change', 'user', JSON.stringify({ email: req.user.email }), req.ip]
    );

    res.json({ success: true, message: 'Password changed successfully' });
  } catch (err) {
    next(err);
  }
}

export async function logout(req, res, next) {
  try {
    // Log audit event
    if (req.user) {
      await pool.query(
        `INSERT INTO msat.audit_log (user_id, action, entity_type, details, ip_address)
         VALUES ($1, $2, $3, $4, $5)`,
        [req.user.id, 'logout', 'user', JSON.stringify({ email: req.user.email }), req.ip]
      );
    }

    res.json({ success: true, message: 'Logged out successfully' });
  } catch (err) {
    next(err);
  }
}
