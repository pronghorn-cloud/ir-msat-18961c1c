import pool from '../config/database.js';

// GET /api/documents?search=&category=&appeal_id=&settlement=&date_from=&date_to=&limit=&offset=
export async function searchDocuments(req, res, next) {
  try {
    const {
      search,
      category,
      appeal_id,
      settlement,
      date_from,
      date_to,
      limit = 20,
      offset = 0
    } = req.query;

    const conditions = [];
    const params = [];
    let paramIdx = 1;

    // Full-text search using tsvector
    let rankSelect = '';
    if (search && search.trim().length > 0) {
      const searchTerm = search.trim();
      // Use plainto_tsquery for user-friendly input (no need for special syntax)
      conditions.push(`d.search_vector @@ plainto_tsquery('english', $${paramIdx})`);
      rankSelect = `, ts_rank(d.search_vector, plainto_tsquery('english', $${paramIdx})) as relevance`;
      params.push(searchTerm);
      paramIdx++;
    }

    // Category filter
    if (category && category.trim().length > 0) {
      conditions.push(`d.category = $${paramIdx}`);
      params.push(category.trim());
      paramIdx++;
    }

    // Appeal filter
    if (appeal_id && appeal_id.trim().length > 0) {
      conditions.push(`d.appeal_id = $${paramIdx}::uuid`);
      params.push(appeal_id.trim());
      paramIdx++;
    }

    // Settlement filter (needs join — applied after join via settlement name)
    if (settlement && settlement.trim().length > 0) {
      conditions.push(`s.name = $${paramIdx}`);
      params.push(settlement.trim());
      paramIdx++;
    }

    // Date range filter (on created_at)
    if (date_from) {
      conditions.push(`d.created_at >= $${paramIdx}::date`);
      params.push(date_from);
      paramIdx++;
    }
    if (date_to) {
      conditions.push(`d.created_at < ($${paramIdx}::date + INTERVAL '1 day')`);
      params.push(date_to);
      paramIdx++;
    }

    const whereClause = conditions.length > 0
      ? 'WHERE ' + conditions.join(' AND ')
      : '';

    const orderClause = search && search.trim().length > 0
      ? 'ORDER BY relevance DESC, d.created_at DESC'
      : 'ORDER BY d.created_at DESC';

    // Count query (needs joins for settlement/appeal filters)
    const countQuery = `
      SELECT COUNT(*) as total
      FROM msat.documents d
      LEFT JOIN msat.appeals a ON d.appeal_id = a.id
      LEFT JOIN msat.settlements s ON s.sort_order = CAST(SPLIT_PART(a.file_number, '-', 1) AS INTEGER)
      ${whereClause}
    `;
    const countResult = await pool.query(countQuery, params);
    const total = parseInt(countResult.rows[0].total, 10);

    // Data query with appeal + settlement join
    const limitVal = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100);
    const offsetVal = Math.max(parseInt(offset, 10) || 0, 0);

    const dataQuery = `
      SELECT d.id, d.file_name, d.original_name, d.file_type, d.mime_type,
             d.file_size, d.category, d.description, d.document_date,
             d.is_historical, d.created_at, d.appeal_id,
             a.file_number as appeal_file_number,
             a.issue_type as appeal_issue_type,
             a.status as appeal_status,
             s.name as settlement_name
             ${rankSelect}
      FROM msat.documents d
      LEFT JOIN msat.appeals a ON d.appeal_id = a.id
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

// GET /api/documents/appeals - List appeals that have documents (for filter dropdown)
export async function listAppealsWithDocs(req, res, next) {
  try {
    const result = await pool.query(
      `SELECT DISTINCT a.id, a.file_number
       FROM msat.appeals a
       INNER JOIN msat.documents d ON d.appeal_id = a.id
       ORDER BY a.file_number`
    );
    res.json({
      success: true,
      data: result.rows
    });
  } catch (err) {
    next(err);
  }
}

// GET /api/documents/settlements - List settlements that have documents (for filter dropdown)
export async function listSettlementsWithDocs(req, res, next) {
  try {
    const result = await pool.query(
      `SELECT DISTINCT s.name
       FROM msat.settlements s
       INNER JOIN msat.appeals a ON s.sort_order = CAST(SPLIT_PART(a.file_number, '-', 1) AS INTEGER)
       INNER JOIN msat.documents d ON d.appeal_id = a.id
       ORDER BY s.name`
    );
    res.json({
      success: true,
      data: result.rows.map(r => r.name)
    });
  } catch (err) {
    next(err);
  }
}

// GET /api/documents/categories - List distinct categories for filter dropdown
export async function listCategories(req, res, next) {
  try {
    const result = await pool.query(
      `SELECT DISTINCT category FROM msat.documents
       WHERE category IS NOT NULL
       ORDER BY category`
    );
    res.json({
      success: true,
      data: result.rows.map(r => r.category)
    });
  } catch (err) {
    next(err);
  }
}
