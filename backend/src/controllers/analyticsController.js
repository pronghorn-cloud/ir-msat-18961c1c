import pool from '../config/database.js';

// Helper: get current Alberta fiscal year boundaries (Apr 1 – Mar 31)
function getFiscalYearBounds(fyYear) {
  // fyYear = the year the FY starts in April
  // e.g. FY 2025 = Apr 1 2025 – Mar 31 2026
  const start = `${fyYear}-04-01`;
  const end = `${fyYear + 1}-04-01`;
  return { start, end };
}

function getCurrentFiscalYear() {
  const now = new Date();
  return now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
}

// GET /api/analytics/summary
export async function getSummary(req, res, next) {
  try {
    const { settlement, date_from, date_to } = req.query;
    const fy = getCurrentFiscalYear();
    const { start: fyStart, end: fyEnd } = getFiscalYearBounds(fy);

    // Build optional WHERE filters for appeals
    const conditions = [];
    const params = [];
    let paramIdx = 1;

    if (settlement) {
      conditions.push(`a.id IN (
        SELECT ap.appeal_id FROM msat.appeal_parties ap
        JOIN msat.clients c ON c.id = ap.client_id
        WHERE c.settlement = $${paramIdx}
      )`);
      params.push(settlement);
      paramIdx++;
    }
    if (date_from) {
      conditions.push(`a.contact_date >= $${paramIdx}`);
      params.push(date_from);
      paramIdx++;
    }
    if (date_to) {
      conditions.push(`a.contact_date <= $${paramIdx}`);
      params.push(date_to);
      paramIdx++;
    }

    const whereClause = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';

    // Summary cards query
    const fyStartIdx = paramIdx;
    const fyEndIdx = paramIdx + 1;
    params.push(fyStart, fyEnd);

    const summarySQL = `
      SELECT
        COUNT(*) FILTER (WHERE a.status = 'Active') AS active_appeals,
        COUNT(*) FILTER (WHERE a.contact_date >= $${fyStartIdx} AND a.contact_date < $${fyEndIdx}) AS filed_this_fy,
        ROUND(AVG(a.closed_date - a.contact_date) FILTER (WHERE a.closed_date IS NOT NULL AND a.contact_date IS NOT NULL)) AS avg_resolution_days,
        COUNT(*) FILTER (WHERE a.status = 'Active' AND a.hearing_date IS NULL) AS awaiting_hearing
      FROM msat.appeals a
      ${whereClause}
    `;

    const summaryResult = await pool.query(summarySQL, params);

    // Orders issued this FY (separate query since orders table is independent)
    let ordersSQL = `SELECT COUNT(*) AS orders_this_fy FROM msat.orders WHERE issue_date >= $1 AND issue_date < $2`;
    const ordersResult = await pool.query(ordersSQL, [fyStart, fyEnd]);

    // Active LAP applications
    const lapSQL = `SELECT COUNT(*) AS active_lap FROM msat.lap_applications WHERE status IN ('Active', 'Open', 'Pending')`;
    const lapResult = await pool.query(lapSQL);

    const summary = summaryResult.rows[0];

    res.json({
      success: true,
      data: {
        active_appeals: parseInt(summary.active_appeals) || 0,
        filed_this_fy: parseInt(summary.filed_this_fy) || 0,
        orders_this_fy: parseInt(ordersResult.rows[0].orders_this_fy) || 0,
        avg_resolution_days: parseInt(summary.avg_resolution_days) || 0,
        active_lap: parseInt(lapResult.rows[0].active_lap) || 0,
        awaiting_hearing: parseInt(summary.awaiting_hearing) || 0,
        fiscal_year: `${fy}/${fy + 1}`
      }
    });
  } catch (err) {
    next(err);
  }
}

// GET /api/analytics/appeals-by-year
export async function getAppealsByYear(req, res, next) {
  try {
    const { settlement, date_from, date_to } = req.query;

    const conditions = ['a.contact_date IS NOT NULL'];
    const params = [];
    let idx = 1;
    let joinClause = '';

    if (settlement) {
      joinClause = `
        JOIN msat.appeal_parties ap ON ap.appeal_id = a.id
        JOIN msat.clients c ON c.id = ap.client_id`;
      conditions.push(`c.settlement = $${idx}`);
      params.push(settlement);
      idx++;
    }
    if (date_from) {
      conditions.push(`a.contact_date >= $${idx}`);
      params.push(date_from);
      idx++;
    }
    if (date_to) {
      conditions.push(`a.contact_date <= $${idx}`);
      params.push(date_to);
      idx++;
    }

    const sql = `
      SELECT EXTRACT(YEAR FROM a.contact_date)::int AS year, COUNT(DISTINCT a.id) AS count
      FROM msat.appeals a
      ${joinClause}
      WHERE ${conditions.join(' AND ')}
      GROUP BY year ORDER BY year
    `;

    const result = await pool.query(sql, params);
    res.json({
      success: true,
      data: result.rows.map(r => ({ year: r.year, count: parseInt(r.count) }))
    });
  } catch (err) {
    next(err);
  }
}

// GET /api/analytics/appeals-by-issue
export async function getAppealsByIssue(req, res, next) {
  try {
    const { settlement, date_from, date_to } = req.query;

    const conditions = ['a.issue_type IS NOT NULL'];
    const params = [];
    let idx = 1;

    if (settlement) {
      conditions.push(`a.id IN (
        SELECT ap.appeal_id FROM msat.appeal_parties ap
        JOIN msat.clients c ON c.id = ap.client_id
        WHERE c.settlement = $${idx}
      )`);
      params.push(settlement);
      idx++;
    }
    if (date_from) {
      conditions.push(`a.contact_date >= $${idx}`);
      params.push(date_from);
      idx++;
    }
    if (date_to) {
      conditions.push(`a.contact_date <= $${idx}`);
      params.push(date_to);
      idx++;
    }

    const sql = `
      SELECT a.issue_type, COUNT(*) AS count
      FROM msat.appeals a
      WHERE ${conditions.join(' AND ')}
      GROUP BY a.issue_type
      ORDER BY count DESC
    `;

    const result = await pool.query(sql, params);
    res.json({
      success: true,
      data: result.rows.map(r => ({ issue_type: r.issue_type, count: parseInt(r.count) }))
    });
  } catch (err) {
    next(err);
  }
}

// GET /api/analytics/appeals-by-settlement
export async function getAppealsBySettlement(req, res, next) {
  try {
    const { date_from, date_to } = req.query;

    const conditions = ['c.settlement IS NOT NULL'];
    const params = [];
    let idx = 1;

    if (date_from) {
      conditions.push(`a.contact_date >= $${idx}`);
      params.push(date_from);
      idx++;
    }
    if (date_to) {
      conditions.push(`a.contact_date <= $${idx}`);
      params.push(date_to);
      idx++;
    }

    const sql = `
      SELECT c.settlement, COUNT(DISTINCT a.id) AS count
      FROM msat.appeals a
      JOIN msat.appeal_parties ap ON ap.appeal_id = a.id
      JOIN msat.clients c ON c.id = ap.client_id
      WHERE ${conditions.join(' AND ')}
      GROUP BY c.settlement
      ORDER BY count DESC
    `;

    const result = await pool.query(sql, params);
    res.json({
      success: true,
      data: result.rows.map(r => ({ settlement: r.settlement, count: parseInt(r.count) }))
    });
  } catch (err) {
    next(err);
  }
}

// GET /api/analytics/settlements (list for filter dropdown)
export async function listSettlements(req, res, next) {
  try {
    const result = await pool.query(`SELECT name FROM msat.settlements ORDER BY name`);
    res.json({
      success: true,
      data: result.rows.map(r => r.name)
    });
  } catch (err) {
    next(err);
  }
}

// GET /api/analytics/fiscal-years (list available FYs)
export async function listFiscalYears(req, res, next) {
  try {
    const result = await pool.query(`
      SELECT DISTINCT
        CASE WHEN EXTRACT(MONTH FROM contact_date) >= 4
          THEN EXTRACT(YEAR FROM contact_date)::int
          ELSE EXTRACT(YEAR FROM contact_date)::int - 1
        END AS fy_start
      FROM msat.appeals
      WHERE contact_date IS NOT NULL
      ORDER BY fy_start DESC
    `);
    res.json({
      success: true,
      data: result.rows.map(r => ({
        value: r.fy_start,
        label: `${r.fy_start}/${r.fy_start + 1}`
      }))
    });
  } catch (err) {
    next(err);
  }
}

// GET /api/analytics/annual-report?fy=2024
export async function getAnnualReport(req, res, next) {
  try {
    const fyYear = parseInt(req.query.fy) || getCurrentFiscalYear();
    const { start: fyStart, end: fyEnd } = getFiscalYearBounds(fyYear);
    const fyLabel = `${fyYear}/${fyYear + 1}`;

    // 1. Summary statistics
    const summaryResult = await pool.query(`
      SELECT
        COUNT(*) FILTER (WHERE contact_date >= $1 AND contact_date < $2) AS filed,
        COUNT(*) FILTER (WHERE closed_date >= $1 AND closed_date < $2) AS resolved,
        COUNT(*) FILTER (WHERE status = 'Active') AS active_at_present,
        ROUND(AVG(closed_date - contact_date) FILTER (WHERE closed_date >= $1 AND closed_date < $2 AND contact_date IS NOT NULL)) AS avg_resolution_days
      FROM msat.appeals
    `, [fyStart, fyEnd]);

    const ordersResult = await pool.query(
      `SELECT COUNT(*) AS cnt FROM msat.orders WHERE issue_date >= $1 AND issue_date < $2`,
      [fyStart, fyEnd]
    );

    const summary = summaryResult.rows[0];

    // 2. By settlement
    const bySettlement = await pool.query(`
      SELECT c.settlement,
        COUNT(DISTINCT a.id) FILTER (WHERE a.contact_date >= $1 AND a.contact_date < $2) AS filed,
        COUNT(DISTINCT a.id) FILTER (WHERE a.closed_date >= $1 AND a.closed_date < $2) AS resolved,
        COUNT(DISTINCT a.id) FILTER (WHERE a.status = 'Active') AS active
      FROM msat.appeals a
      JOIN msat.appeal_parties ap ON ap.appeal_id = a.id
      JOIN msat.clients c ON c.id = ap.client_id
      WHERE c.settlement IS NOT NULL
      GROUP BY c.settlement ORDER BY filed DESC
    `, [fyStart, fyEnd]);

    // 3. By issue type
    const byIssue = await pool.query(`
      SELECT issue_type, COUNT(*) AS count,
        ROUND(COUNT(*) * 100.0 / NULLIF(SUM(COUNT(*)) OVER(), 0), 1) AS percentage
      FROM msat.appeals
      WHERE contact_date >= $1 AND contact_date < $2 AND issue_type IS NOT NULL
      GROUP BY issue_type ORDER BY count DESC
    `, [fyStart, fyEnd]);

    // 4. Mediation statistics
    const medResult = await pool.query(`
      SELECT
        COUNT(*) FILTER (WHERE status IN ('Conciliation', 'Conciliated', 'Mediation', 'Mediated')
          AND contact_date >= $1 AND contact_date < $2) AS mediation_cases,
        COUNT(*) FILTER (WHERE status IN ('Conciliated', 'Mediated')
          AND contact_date >= $1 AND contact_date < $2) AS mediation_resolved,
        COUNT(*) FILTER (WHERE closed_date >= $1 AND closed_date < $2) AS total_resolved
      FROM msat.appeals
    `, [fyStart, fyEnd]);

    const med = medResult.rows[0];
    const totalResolved = parseInt(med.total_resolved) || 0;
    const medResolved = parseInt(med.mediation_resolved) || 0;
    const mediationRate = totalResolved > 0 ? Math.round(medResolved * 100 / totalResolved) : 0;

    res.json({
      success: true,
      data: {
        fiscal_year: fyLabel,
        fy_start: fyStart,
        fy_end: fyEnd,
        summary: {
          appeals_filed: parseInt(summary.filed) || 0,
          appeals_resolved: parseInt(summary.resolved) || 0,
          orders_issued: parseInt(ordersResult.rows[0].cnt) || 0,
          avg_resolution_days: parseInt(summary.avg_resolution_days) || 0,
          active_appeals: parseInt(summary.active_at_present) || 0
        },
        by_settlement: bySettlement.rows.map(r => ({
          settlement: r.settlement,
          filed: parseInt(r.filed) || 0,
          resolved: parseInt(r.resolved) || 0,
          active: parseInt(r.active) || 0
        })),
        by_issue_type: byIssue.rows.map(r => ({
          issue_type: r.issue_type,
          count: parseInt(r.count) || 0,
          percentage: parseFloat(r.percentage) || 0
        })),
        mediation: {
          cases_in_mediation: parseInt(med.mediation_cases) || 0,
          resolved_via_mediation: medResolved,
          mediation_rate_percent: mediationRate
        }
      }
    });
  } catch (err) {
    next(err);
  }
}
