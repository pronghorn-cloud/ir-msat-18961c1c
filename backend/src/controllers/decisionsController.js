import pool from '../config/database.js';

// GET /api/public/decisions?search=&settlement=&issue_type=&year=&limit=&offset=
export async function searchPublicDecisions(req, res, next) {
  try {
    const {
      search,
      settlement,
      issue_type,
      year,
      limit = 20,
      offset = 0
    } = req.query;

    const conditions = ['o.is_public = true'];
    const params = [];
    let paramIdx = 1;

    // Full-text search
    let rankSelect = '';
    if (search && search.trim().length > 0) {
      const searchTerm = search.trim();
      conditions.push(`o.search_vector @@ plainto_tsquery('english', $${paramIdx})`);
      rankSelect = `, ts_rank(o.search_vector, plainto_tsquery('english', $${paramIdx})) as relevance`;
      params.push(searchTerm);
      paramIdx++;
    }

    // Settlement filter (via appeal join)
    if (settlement && settlement.trim().length > 0) {
      conditions.push(`s.name = $${paramIdx}`);
      params.push(settlement.trim());
      paramIdx++;
    }

    // Issue type filter (via appeal join)
    if (issue_type && issue_type.trim().length > 0) {
      conditions.push(`a.issue_type = $${paramIdx}`);
      params.push(issue_type.trim());
      paramIdx++;
    }

    // Year filter
    if (year && !isNaN(parseInt(year, 10))) {
      conditions.push(`EXTRACT(YEAR FROM o.issue_date) = $${paramIdx}`);
      params.push(parseInt(year, 10));
      paramIdx++;
    }

    const whereClause = 'WHERE ' + conditions.join(' AND ');

    const orderClause = search && search.trim().length > 0
      ? 'ORDER BY relevance DESC, o.issue_date DESC'
      : 'ORDER BY o.issue_date DESC, o.order_number DESC';

    // Count query
    const countQuery = `
      SELECT COUNT(*) as total
      FROM msat.orders o
      LEFT JOIN msat.appeals a ON o.appeal_id = a.id
      LEFT JOIN msat.settlements s ON s.sort_order = CAST(SPLIT_PART(a.file_number, '-', 1) AS INTEGER)
      ${whereClause}
    `;
    const countResult = await pool.query(countQuery, params);
    const total = parseInt(countResult.rows[0].total, 10);

    // Data query
    const limitVal = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100);
    const offsetVal = Math.max(parseInt(offset, 10) || 0, 0);

    const dataQuery = `
      SELECT o.id, o.order_number, o.issue_date, o.keyword, o.document_url,
             o.app_for_leave, o.leave_granted,
             a.file_number as appeal_file_number,
             a.issue_type,
             s.name as settlement_name
             ${rankSelect}
      FROM msat.orders o
      LEFT JOIN msat.appeals a ON o.appeal_id = a.id
      LEFT JOIN msat.settlements s ON s.sort_order = CAST(SPLIT_PART(a.file_number, '-', 1) AS INTEGER)
      ${whereClause}
      ${orderClause}
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

// GET /api/public/decisions/years - Available years for filter dropdown
export async function listDecisionYears(req, res, next) {
  try {
    const result = await pool.query(`
      SELECT DISTINCT EXTRACT(YEAR FROM issue_date)::int as year
      FROM msat.orders
      WHERE issue_date IS NOT NULL AND is_public = true
      ORDER BY year DESC
    `);
    res.json({
      success: true,
      data: result.rows.map(r => r.year)
    });
  } catch (err) {
    next(err);
  }
}

// GET /api/public/decisions/settlements - Settlements with published decisions
export async function listDecisionSettlements(req, res, next) {
  try {
    const result = await pool.query(`
      SELECT DISTINCT s.name
      FROM msat.orders o
      INNER JOIN msat.appeals a ON o.appeal_id = a.id
      INNER JOIN msat.settlements s ON s.sort_order = CAST(SPLIT_PART(a.file_number, '-', 1) AS INTEGER)
      WHERE o.is_public = true
      ORDER BY s.name
    `);
    res.json({
      success: true,
      data: result.rows.map(r => r.name)
    });
  } catch (err) {
    next(err);
  }
}

// GET /api/public/decisions/issue-types - Issue types with published decisions
export async function listDecisionIssueTypes(req, res, next) {
  try {
    const result = await pool.query(`
      SELECT DISTINCT a.issue_type
      FROM msat.orders o
      INNER JOIN msat.appeals a ON o.appeal_id = a.id
      WHERE o.is_public = true AND a.issue_type IS NOT NULL
      ORDER BY a.issue_type
    `);
    res.json({
      success: true,
      data: result.rows.map(r => r.issue_type)
    });
  } catch (err) {
    next(err);
  }
}
