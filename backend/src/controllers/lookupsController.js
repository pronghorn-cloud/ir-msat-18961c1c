import pool from '../config/database.js';

export async function getSettlements(req, res, next) {
  try {
    const result = await pool.query(
      'SELECT id, code, name, sort_order FROM msat.settlements ORDER BY sort_order'
    );
    res.json({ success: true, data: result.rows });
  } catch (err) {
    next(err);
  }
}

export async function getIssueTypes(req, res, next) {
  try {
    const result = await pool.query(
      'SELECT code, name, sort_order FROM msat.issue_types ORDER BY sort_order'
    );
    res.json({ success: true, data: result.rows });
  } catch (err) {
    next(err);
  }
}

export async function getAppealStatuses(req, res, next) {
  try {
    const result = await pool.query(
      'SELECT code, name, sort_order FROM msat.appeal_statuses ORDER BY sort_order, name'
    );
    res.json({ success: true, data: result.rows });
  } catch (err) {
    next(err);
  }
}

export async function getAppealStages(req, res, next) {
  try {
    const result = await pool.query(
      'SELECT code, name, sort_order FROM msat.appeal_stages ORDER BY sort_order, name'
    );
    res.json({ success: true, data: result.rows });
  } catch (err) {
    next(err);
  }
}

export async function getStaffList(req, res, next) {
  try {
    const result = await pool.query(
      `SELECT id, first_name, last_name, email, role
       FROM msat.users
       WHERE is_active = true AND role IN ('admin', 'staff')
       ORDER BY last_name, first_name`
    );
    res.json({ success: true, data: result.rows });
  } catch (err) {
    next(err);
  }
}

export async function getBoardMembers(req, res, next) {
  try {
    // Get system board members
    const usersResult = await pool.query(
      `SELECT id, first_name, last_name, email
       FROM msat.users
       WHERE is_active = true AND role = 'board_member'
       ORDER BY last_name, first_name`
    );

    // Also get distinct names from existing panel compositions (legacy data)
    const legacyResult = await pool.query(
      `SELECT DISTINCT name FROM (
         SELECT panel_chair AS name FROM msat.panel_compositions WHERE panel_chair IS NOT NULL
         UNION SELECT panel_member_2 FROM msat.panel_compositions WHERE panel_member_2 IS NOT NULL
         UNION SELECT panel_member_3 FROM msat.panel_compositions WHERE panel_member_3 IS NOT NULL
         UNION SELECT mediator FROM msat.panel_compositions WHERE mediator IS NOT NULL
       ) AS names
       ORDER BY name`
    );

    res.json({
      success: true,
      data: {
        users: usersResult.rows,
        known_names: legacyResult.rows.map(r => r.name)
      }
    });
  } catch (err) {
    next(err);
  }
}
