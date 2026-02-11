import pool from '../config/database.js';

// ==============================
// LAP Applications
// ==============================

// GET /api/lap/applications — list with filters + pagination
export async function listApplications(req, res, next) {
  try {
    const { status, search, page = 1, limit = 25 } = req.query;
    const offset = (Math.max(1, Number(page)) - 1) * Number(limit);

    let conditions = [];
    let params = [];
    let idx = 1;

    if (status) {
      conditions.push(`la.status = $${idx++}`);
      params.push(status);
    }
    if (search) {
      conditions.push(`(la.applicant ILIKE $${idx} OR la.application_number ILIKE $${idx} OR la.file_number ILIKE $${idx})`);
      params.push(`%${search}%`);
      idx++;
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const countResult = await pool.query(
      `SELECT COUNT(*) FROM msat.lap_applications la ${where}`,
      params
    );
    const total = parseInt(countResult.rows[0].count);

    const dataResult = await pool.query(`
      SELECT la.id, la.application_number, la.file_number, la.applicant,
             la.status, la.staff, la.contact_date, la.amendment, la.staff_notes,
             la.created_at, la.updated_at
      FROM msat.lap_applications la
      ${where}
      ORDER BY la.application_number DESC
      LIMIT $${idx++} OFFSET $${idx++}
    `, [...params, Number(limit), offset]);

    res.json({
      success: true,
      data: dataResult.rows,
      total,
      page: Number(page),
      limit: Number(limit)
    });
  } catch (err) {
    next(err);
  }
}

// GET /api/lap/applications/:id — detail with linked orders + access records
export async function getApplicationById(req, res, next) {
  try {
    const { id } = req.params;

    const appResult = await pool.query(
      'SELECT * FROM msat.lap_applications WHERE id = $1',
      [id]
    );
    if (appResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Application not found' });
    }

    const app = appResult.rows[0];

    // Linked orders
    const ordersResult = await pool.query(`
      SELECT id, order_number, date_issued
      FROM msat.lap_orders
      WHERE application_id = $1
      ORDER BY date_issued DESC
    `, [id]);

    // Linked access records (via file_number)
    const accessResult = await pool.query(`
      SELECT id, file_number, status, reo, reo_date, co, co_date,
             purpose, project_type, wellsite_legal, operator,
             settlement, anniversary_date, lands_affected
      FROM msat.lap_access_records
      WHERE file_number = $1
      ORDER BY reo_date DESC NULLS LAST
    `, [app.file_number]);

    res.json({
      success: true,
      data: {
        ...app,
        orders: ordersResult.rows,
        access_records: accessResult.rows
      }
    });
  } catch (err) {
    next(err);
  }
}

// POST /api/lap/applications — create new application
export async function createApplication(req, res, next) {
  try {
    const { application_number, file_number, applicant, status, staff, contact_date, amendment, staff_notes } = req.body;

    if (!application_number) {
      return res.status(400).json({ success: false, message: 'Application number is required' });
    }

    const result = await pool.query(`
      INSERT INTO msat.lap_applications
        (application_number, file_number, applicant, status, staff, contact_date, amendment, staff_notes)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `, [application_number, file_number || null, applicant || null, status || 'Open',
        staff || null, contact_date || null, amendment || false, staff_notes || null]);

    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ success: false, message: 'Application number already exists' });
    }
    next(err);
  }
}

// PUT /api/lap/applications/:id — update application
export async function updateApplication(req, res, next) {
  try {
    const { id } = req.params;
    const { applicant, file_number, status, staff, contact_date, amendment, staff_notes } = req.body;

    const existing = await pool.query('SELECT id FROM msat.lap_applications WHERE id = $1', [id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Application not found' });
    }

    const result = await pool.query(`
      UPDATE msat.lap_applications
      SET applicant = COALESCE($1, applicant),
          file_number = COALESCE($2, file_number),
          status = COALESCE($3, status),
          staff = COALESCE($4, staff),
          contact_date = COALESCE($5, contact_date),
          amendment = COALESCE($6, amendment),
          staff_notes = COALESCE($7, staff_notes),
          updated_at = NOW()
      WHERE id = $8
      RETURNING *
    `, [applicant, file_number, status, staff, contact_date, amendment, staff_notes, id]);

    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    next(err);
  }
}

// DELETE /api/lap/applications/:id — delete application
export async function deleteApplication(req, res, next) {
  try {
    const result = await pool.query(
      'DELETE FROM msat.lap_applications WHERE id = $1 RETURNING id',
      [req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Application not found' });
    }
    res.json({ success: true, message: 'Application deleted' });
  } catch (err) {
    next(err);
  }
}

// GET /api/lap/statuses — distinct statuses for filter
export async function listStatuses(req, res, next) {
  try {
    const result = await pool.query(`
      SELECT DISTINCT status, COUNT(*) AS count
      FROM msat.lap_applications
      WHERE status IS NOT NULL
      GROUP BY status
      ORDER BY count DESC
    `);
    res.json({ success: true, data: result.rows });
  } catch (err) {
    next(err);
  }
}

// ==============================
// LAP Orders
// ==============================

// GET /api/lap/orders — list with filters + pagination
export async function listOrders(req, res, next) {
  try {
    const { application_id, search, page = 1, limit = 25 } = req.query;
    const offset = (Math.max(1, Number(page)) - 1) * Number(limit);

    let conditions = [];
    let params = [];
    let idx = 1;

    if (application_id) {
      conditions.push(`o.application_id = $${idx++}`);
      params.push(application_id);
    }
    if (search) {
      conditions.push(`(o.order_number ILIKE $${idx} OR a.applicant ILIKE $${idx} OR a.application_number ILIKE $${idx})`);
      params.push(`%${search}%`);
      idx++;
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const countResult = await pool.query(
      `SELECT COUNT(*) FROM msat.lap_orders o LEFT JOIN msat.lap_applications a ON a.id = o.application_id ${where}`,
      params
    );
    const total = parseInt(countResult.rows[0].count);

    const dataResult = await pool.query(`
      SELECT o.id, o.order_number, o.date_issued, o.application_id, o.created_at,
             a.application_number, a.applicant, a.file_number, a.status AS application_status
      FROM msat.lap_orders o
      LEFT JOIN msat.lap_applications a ON a.id = o.application_id
      ${where}
      ORDER BY o.date_issued DESC NULLS LAST
      LIMIT $${idx++} OFFSET $${idx++}
    `, [...params, Number(limit), offset]);

    res.json({
      success: true,
      data: dataResult.rows,
      total,
      page: Number(page),
      limit: Number(limit)
    });
  } catch (err) {
    next(err);
  }
}

// GET /api/lap/orders/:id — single order with linked application
export async function getOrderById(req, res, next) {
  try {
    const { id } = req.params;

    const result = await pool.query(`
      SELECT o.*, a.application_number, a.applicant, a.file_number, a.status AS application_status
      FROM msat.lap_orders o
      LEFT JOIN msat.lap_applications a ON a.id = o.application_id
      WHERE o.id = $1
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    next(err);
  }
}

// POST /api/lap/orders — create order linked to application
export async function createOrder(req, res, next) {
  try {
    const { application_id, order_number, date_issued } = req.body;

    if (!application_id) {
      return res.status(400).json({ success: false, message: 'Application ID is required' });
    }

    // Verify application exists
    const appCheck = await pool.query('SELECT id FROM msat.lap_applications WHERE id = $1', [application_id]);
    if (appCheck.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Application not found' });
    }

    const result = await pool.query(`
      INSERT INTO msat.lap_orders (application_id, order_number, date_issued)
      VALUES ($1, $2, $3)
      RETURNING *
    `, [application_id, order_number || null, date_issued || null]);

    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (err) {
    next(err);
  }
}

// PUT /api/lap/orders/:id — update order
export async function updateOrder(req, res, next) {
  try {
    const { id } = req.params;
    const { order_number, date_issued, application_id } = req.body;

    const existing = await pool.query('SELECT id FROM msat.lap_orders WHERE id = $1', [id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    const result = await pool.query(`
      UPDATE msat.lap_orders
      SET order_number = COALESCE($1, order_number),
          date_issued = COALESCE($2, date_issued),
          application_id = COALESCE($3, application_id)
      WHERE id = $4
      RETURNING *
    `, [order_number, date_issued, application_id, id]);

    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    next(err);
  }
}

// DELETE /api/lap/orders/:id — delete order
export async function deleteOrder(req, res, next) {
  try {
    const result = await pool.query(
      'DELETE FROM msat.lap_orders WHERE id = $1 RETURNING id',
      [req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }
    res.json({ success: true, message: 'Order deleted' });
  } catch (err) {
    next(err);
  }
}

// ==============================
// LAP Access Records
// ==============================

// GET /api/lap/access-records — list with filters + pagination
export async function listAccessRecords(req, res, next) {
  try {
    const { settlement, project_type, search, page = 1, limit = 25 } = req.query;
    const offset = (Math.max(1, Number(page)) - 1) * Number(limit);

    let conditions = [];
    let params = [];
    let idx = 1;

    if (settlement) {
      conditions.push(`ar.settlement = $${idx++}`);
      params.push(settlement);
    }
    if (project_type) {
      conditions.push(`ar.project_type = $${idx++}`);
      params.push(project_type);
    }
    if (search) {
      conditions.push(`(ar.operator ILIKE $${idx} OR ar.file_number ILIKE $${idx} OR ar.wellsite_legal ILIKE $${idx} OR ar.reo ILIKE $${idx})`);
      params.push(`%${search}%`);
      idx++;
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const countResult = await pool.query(
      `SELECT COUNT(*) FROM msat.lap_access_records ar ${where}`,
      params
    );
    const total = parseInt(countResult.rows[0].count);

    const dataResult = await pool.query(`
      SELECT ar.id, ar.file_number, ar.status, ar.reo, ar.reo_date, ar.co, ar.co_date,
             ar.purpose, ar.project_type, ar.wellsite_legal, ar.operator,
             ar.settlement, ar.anniversary_date, ar.lands_affected, ar.created_at
      FROM msat.lap_access_records ar
      ${where}
      ORDER BY ar.reo_date DESC NULLS LAST
      LIMIT $${idx++} OFFSET $${idx++}
    `, [...params, Number(limit), offset]);

    res.json({
      success: true,
      data: dataResult.rows,
      total,
      page: Number(page),
      limit: Number(limit)
    });
  } catch (err) {
    next(err);
  }
}

// GET /api/lap/access-records/settlements — distinct settlements for filter
export async function listSettlements(req, res, next) {
  try {
    const result = await pool.query(`
      SELECT DISTINCT settlement, COUNT(*) AS count
      FROM msat.lap_access_records
      WHERE settlement IS NOT NULL
      GROUP BY settlement
      ORDER BY count DESC
    `);
    res.json({ success: true, data: result.rows });
  } catch (err) {
    next(err);
  }
}

// GET /api/lap/access-records/project-types — distinct project types for filter
export async function listProjectTypes(req, res, next) {
  try {
    const result = await pool.query(`
      SELECT DISTINCT project_type, COUNT(*) AS count
      FROM msat.lap_access_records
      WHERE project_type IS NOT NULL
      GROUP BY project_type
      ORDER BY count DESC
    `);
    res.json({ success: true, data: result.rows });
  } catch (err) {
    next(err);
  }
}

// GET /api/lap/access-records/:id — single access record
export async function getAccessRecordById(req, res, next) {
  try {
    const result = await pool.query(
      'SELECT * FROM msat.lap_access_records WHERE id = $1',
      [req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Access record not found' });
    }
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    next(err);
  }
}

// POST /api/lap/access-records — create access record
export async function createAccessRecord(req, res, next) {
  try {
    const { file_number, status, reo, reo_date, co, co_date, purpose,
            project_type, wellsite_legal, operator, settlement,
            anniversary_date, lands_affected } = req.body;

    if (!file_number) {
      return res.status(400).json({ success: false, message: 'File number is required' });
    }

    const result = await pool.query(`
      INSERT INTO msat.lap_access_records
        (file_number, status, reo, reo_date, co, co_date, purpose,
         project_type, wellsite_legal, operator, settlement,
         anniversary_date, lands_affected)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING *
    `, [file_number, status || null, reo || null, reo_date || null,
        co || null, co_date || null, purpose || null, project_type || null,
        wellsite_legal || null, operator || null, settlement || null,
        anniversary_date || null, lands_affected || null]);

    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (err) {
    next(err);
  }
}

// PUT /api/lap/access-records/:id — update access record
export async function updateAccessRecord(req, res, next) {
  try {
    const { id } = req.params;
    const { status, reo, reo_date, co, co_date, purpose,
            project_type, wellsite_legal, operator, settlement,
            anniversary_date, lands_affected } = req.body;

    const existing = await pool.query('SELECT id FROM msat.lap_access_records WHERE id = $1', [id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Access record not found' });
    }

    const result = await pool.query(`
      UPDATE msat.lap_access_records
      SET status = COALESCE($1, status),
          reo = COALESCE($2, reo),
          reo_date = COALESCE($3, reo_date),
          co = COALESCE($4, co),
          co_date = COALESCE($5, co_date),
          purpose = COALESCE($6, purpose),
          project_type = COALESCE($7, project_type),
          wellsite_legal = COALESCE($8, wellsite_legal),
          operator = COALESCE($9, operator),
          settlement = COALESCE($10, settlement),
          anniversary_date = COALESCE($11, anniversary_date),
          lands_affected = COALESCE($12, lands_affected),
          updated_at = NOW()
      WHERE id = $13
      RETURNING *
    `, [status, reo, reo_date, co, co_date, purpose, project_type,
        wellsite_legal, operator, settlement, anniversary_date, lands_affected, id]);

    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    next(err);
  }
}

// DELETE /api/lap/access-records/:id — delete access record
export async function deleteAccessRecord(req, res, next) {
  try {
    const result = await pool.query(
      'DELETE FROM msat.lap_access_records WHERE id = $1 RETURNING id',
      [req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Access record not found' });
    }
    res.json({ success: true, message: 'Access record deleted' });
  } catch (err) {
    next(err);
  }
}

// ==============================
// Map Data
// ==============================

// Known Metis Settlement coordinates (approximate centroids)
const SETTLEMENT_COORDS = {
  'Buffalo Lake Metis Settlement':    { lat: 52.42, lng: -112.87 },
  'East Prairie Metis Settlement':    { lat: 55.16, lng: -116.46 },
  'Elizabeth Metis Settlement':        { lat: 54.72, lng: -110.80 },
  'Fishing Lake Metis Settlement':    { lat: 54.42, lng: -111.48 },
  'Gift Lake Metis Settlement':       { lat: 55.50, lng: -115.97 },
  'Kikino Metis Settlement':          { lat: 54.68, lng: -112.00 },
  'Paddle Prairie Metis Settlement':  { lat: 57.39, lng: -117.48 },
  'Peavine Metis Settlement':         { lat: 55.18, lng: -116.78 }
};

// GET /api/lap/map-data — aggregated data for map view
export async function getMapData(req, res, next) {
  try {
    const { settlement, project_type, operator } = req.query;

    let conditions = ["ar.settlement IS NOT NULL AND ar.settlement != ''"];
    let params = [];
    let idx = 1;

    if (settlement) {
      conditions.push(`ar.settlement = $${idx++}`);
      params.push(settlement);
    }
    if (project_type) {
      conditions.push(`ar.project_type = $${idx++}`);
      params.push(project_type);
    }
    if (operator) {
      conditions.push(`ar.operator ILIKE $${idx++}`);
      params.push(`%${operator}%`);
    }

    const where = `WHERE ${conditions.join(' AND ')}`;

    // Aggregated by settlement + status
    const result = await pool.query(`
      SELECT ar.settlement,
             ar.status,
             COUNT(*) AS count
      FROM msat.lap_access_records ar
      ${where}
      GROUP BY ar.settlement, ar.status
      ORDER BY ar.settlement, count DESC
    `, params);

    // Build settlement-level summary with coordinates
    const settlementMap = {};
    result.rows.forEach(row => {
      if (!settlementMap[row.settlement]) {
        const coords = SETTLEMENT_COORDS[row.settlement] || { lat: 55.0, lng: -114.0 };
        settlementMap[row.settlement] = {
          settlement: row.settlement,
          lat: coords.lat,
          lng: coords.lng,
          total: 0,
          statuses: {}
        };
      }
      settlementMap[row.settlement].total += parseInt(row.count);
      settlementMap[row.settlement].statuses[row.status] = parseInt(row.count);
    });

    // Also fetch recent records per settlement for popup detail
    const detailResult = await pool.query(`
      SELECT ar.id, ar.settlement, ar.operator, ar.project_type, ar.status,
             ar.wellsite_legal, ar.reo, ar.file_number
      FROM msat.lap_access_records ar
      ${where}
      ORDER BY ar.settlement, ar.created_at DESC
    `, params);

    // Group detail records by settlement (limit to 10 per settlement for popup)
    const detailMap = {};
    detailResult.rows.forEach(row => {
      if (!detailMap[row.settlement]) detailMap[row.settlement] = [];
      if (detailMap[row.settlement].length < 10) {
        detailMap[row.settlement].push(row);
      }
    });

    // Merge detail into settlement data
    const data = Object.values(settlementMap).map(s => ({
      ...s,
      records: detailMap[s.settlement] || []
    }));

    res.json({ success: true, data, total: detailResult.rows.length });
  } catch (err) {
    next(err);
  }
}
