import pool from '../config/database.js';

// Helper: get the authenticated user's client_id from the database
async function getUserClientId(userId) {
  const result = await pool.query(
    'SELECT client_id FROM msat.users WHERE id = $1',
    [userId]
  );
  return result.rows[0]?.client_id || null;
}

// GET /api/my-cases?status=
export async function listMyCases(req, res, next) {
  try {
    const clientId = await getUserClientId(req.user.id);

    if (!clientId) {
      return res.json({
        success: true,
        data: [],
        total: 0,
        message: 'No client profile linked to this account'
      });
    }

    const { status } = req.query;
    const conditions = ['ap.client_id = $1'];
    const params = [clientId];
    let paramIdx = 2;

    if (status && status.trim().length > 0) {
      conditions.push(`a.status = $${paramIdx}`);
      params.push(status.trim());
      paramIdx++;
    }

    const whereClause = 'WHERE ' + conditions.join(' AND ');

    // Count
    const countResult = await pool.query(`
      SELECT COUNT(DISTINCT a.id) as total
      FROM msat.appeal_parties ap
      JOIN msat.appeals a ON a.id = ap.appeal_id
      ${whereClause}
    `, params);
    const total = parseInt(countResult.rows[0].total, 10);

    // Data: cases with party role, status, next hearing
    const dataResult = await pool.query(`
      SELECT DISTINCT ON (a.id)
        a.id,
        a.file_number,
        a.status,
        a.issue_type,
        a.contact_date,
        a.hearing_date,
        a.mediation_date,
        a.closed_date,
        ap.party_type,
        s.name as settlement_name,
        (
          SELECT json_build_object(
            'hearing_date', hs.hearing_date,
            'hearing_time', hs.hearing_time,
            'location', hs.location,
            'hearing_type', hs.hearing_type
          )
          FROM msat.hearing_schedule hs
          WHERE hs.appeal_id = a.id AND hs.hearing_date >= CURRENT_DATE
          ORDER BY hs.hearing_date ASC
          LIMIT 1
        ) as next_hearing,
        (
          SELECT COUNT(*)::int
          FROM msat.documents d
          WHERE d.appeal_id = a.id
        ) as document_count
      FROM msat.appeal_parties ap
      JOIN msat.appeals a ON a.id = ap.appeal_id
      LEFT JOIN msat.settlements st ON st.sort_order = CAST(SPLIT_PART(a.file_number, '-', 1) AS INTEGER)
      LEFT JOIN msat.settlements s ON s.sort_order = CAST(SPLIT_PART(a.file_number, '-', 1) AS INTEGER)
      ${whereClause}
      ORDER BY a.id, a.contact_date DESC
    `, params);

    res.json({
      success: true,
      data: dataResult.rows,
      total
    });
  } catch (err) {
    next(err);
  }
}

// GET /api/my-cases/:id
export async function getMyCaseDetail(req, res, next) {
  try {
    const clientId = await getUserClientId(req.user.id);
    const appealId = req.params.id;

    if (!clientId) {
      return res.status(403).json({ success: false, message: 'No client profile linked' });
    }

    // Verify the user is a party to this appeal
    const accessCheck = await pool.query(
      'SELECT 1 FROM msat.appeal_parties WHERE appeal_id = $1 AND client_id = $2',
      [appealId, clientId]
    );
    if (accessCheck.rows.length === 0) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    // Appeal details
    const appealResult = await pool.query(`
      SELECT a.id, a.file_number, a.status, a.issue_type, a.description,
             a.contact_date, a.hearing_date, a.mediation_date, a.closed_date,
             a.stage, a.notes, a.background,
             s.name as settlement_name
      FROM msat.appeals a
      LEFT JOIN msat.settlements s ON s.sort_order = CAST(SPLIT_PART(a.file_number, '-', 1) AS INTEGER)
      WHERE a.id = $1
    `, [appealId]);

    if (appealResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Appeal not found' });
    }

    const appeal = appealResult.rows[0];

    // All parties on this appeal (names and roles only, no private info)
    const partiesResult = await pool.query(`
      SELECT
        COALESCE(c.first_name || ' ' || c.last_name, o.name, 'Unknown') as name,
        ap.party_type
      FROM msat.appeal_parties ap
      LEFT JOIN msat.clients c ON c.id = ap.client_id
      LEFT JOIN msat.organizations o ON o.id = ap.organization_id
      WHERE ap.appeal_id = $1
      ORDER BY ap.party_type
    `, [appealId]);

    // Hearings for this appeal
    const hearingsResult = await pool.query(`
      SELECT id, hearing_date, hearing_time, location, hearing_type, outcome
      FROM msat.hearing_schedule
      WHERE appeal_id = $1
      ORDER BY hearing_date DESC
    `, [appealId]);

    // Documents for this appeal
    const documentsResult = await pool.query(`
      SELECT id, file_name, category, document_date, file_size, created_at
      FROM msat.documents
      WHERE appeal_id = $1
      ORDER BY created_at DESC
    `, [appealId]);

    // Orders for this appeal
    const ordersResult = await pool.query(`
      SELECT id, order_number, issue_date, keyword, document_url
      FROM msat.orders
      WHERE appeal_id = $1 AND is_public = true
      ORDER BY issue_date DESC
    `, [appealId]);

    res.json({
      success: true,
      data: {
        ...appeal,
        parties: partiesResult.rows,
        hearings: hearingsResult.rows,
        documents: documentsResult.rows,
        orders: ordersResult.rows
      }
    });
  } catch (err) {
    next(err);
  }
}

// GET /api/my-cases/statuses — distinct statuses for the user's cases (for filter dropdown)
export async function listMyCaseStatuses(req, res, next) {
  try {
    const clientId = await getUserClientId(req.user.id);

    if (!clientId) {
      return res.json({ success: true, data: [] });
    }

    const result = await pool.query(`
      SELECT DISTINCT a.status
      FROM msat.appeal_parties ap
      JOIN msat.appeals a ON a.id = ap.appeal_id
      WHERE ap.client_id = $1 AND a.status IS NOT NULL
      ORDER BY a.status
    `, [clientId]);

    res.json({
      success: true,
      data: result.rows.map(r => r.status)
    });
  } catch (err) {
    next(err);
  }
}
