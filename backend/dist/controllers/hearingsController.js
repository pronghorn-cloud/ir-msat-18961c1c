import pool from '../config/database.js';

// GET /api/public/hearings?month=&location=&type=&show_past=&limit=&offset=
export async function listPublicHearings(req, res, next) {
  try {
    const { month, location, type, show_past, limit = 20, offset = 0 } = req.query;

    const conditions = ['hs.is_public = true'];
    const params = [];
    let paramIdx = 1;

    // By default only show upcoming hearings, unless show_past=true
    if (show_past !== 'true') {
      conditions.push('hs.hearing_date >= CURRENT_DATE');
    }

    // Month filter (YYYY-MM format)
    if (month && /^\d{4}-\d{2}$/.test(month)) {
      conditions.push(`TO_CHAR(hs.hearing_date, 'YYYY-MM') = $${paramIdx}`);
      params.push(month);
      paramIdx++;
    }

    // Location filter
    if (location && location.trim().length > 0) {
      conditions.push(`hs.location = $${paramIdx}`);
      params.push(location.trim());
      paramIdx++;
    }

    // Hearing type filter
    if (type && type.trim().length > 0) {
      conditions.push(`hs.hearing_type = $${paramIdx}`);
      params.push(type.trim());
      paramIdx++;
    }

    const whereClause = 'WHERE ' + conditions.join(' AND ');

    // Count
    const countQuery = `
      SELECT COUNT(*) as total
      FROM msat.hearing_schedule hs
      ${whereClause}
    `;
    const countResult = await pool.query(countQuery, params);
    const total = parseInt(countResult.rows[0].total, 10);

    // Data
    const limitVal = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100);
    const offsetVal = Math.max(parseInt(offset, 10) || 0, 0);

    const dataQuery = `
      SELECT hs.id, hs.hearing_date, hs.hearing_time, hs.location,
             hs.hearing_type, hs.notes, hs.outcome,
             a.file_number,
             s.name as settlement_name
      FROM msat.hearing_schedule hs
      LEFT JOIN msat.appeals a ON hs.appeal_id = a.id
      LEFT JOIN msat.settlements s ON s.sort_order = CAST(SPLIT_PART(a.file_number, '-', 1) AS INTEGER)
      ${whereClause}
      ORDER BY hs.hearing_date ASC, hs.hearing_time ASC
      LIMIT $${paramIdx} OFFSET $${paramIdx + 1}
    `;
    params.push(limitVal, offsetVal);

    const dataResult = await pool.query(dataQuery, params);

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

// GET /api/public/hearings/locations - Distinct locations for filter
export async function listHearingLocations(req, res, next) {
  try {
    const result = await pool.query(`
      SELECT DISTINCT location
      FROM msat.hearing_schedule
      WHERE is_public = true AND location IS NOT NULL
      ORDER BY location
    `);
    res.json({
      success: true,
      data: result.rows.map(r => r.location)
    });
  } catch (err) {
    next(err);
  }
}

// GET /api/public/hearings/months - Distinct months that have hearings
export async function listHearingMonths(req, res, next) {
  try {
    const result = await pool.query(`
      SELECT DISTINCT TO_CHAR(hearing_date, 'YYYY-MM') as month,
             TO_CHAR(hearing_date, 'Month YYYY') as label
      FROM msat.hearing_schedule
      WHERE is_public = true AND hearing_date IS NOT NULL
      ORDER BY month DESC
    `);
    res.json({
      success: true,
      data: result.rows.map(r => ({ value: r.month, label: r.label.trim() }))
    });
  } catch (err) {
    next(err);
  }
}
