import pool from '../config/database.js';
import { APIError } from '../middleware/errorHandler.js';

// Generate file number: {settlement_sort_order_padded}-{sequence}-{2digit_year}
async function generateFileNumber(settlementSortOrder) {
  const prefix = String(settlementSortOrder).padStart(2, '0');
  const year = String(new Date().getFullYear()).slice(-2);
  const pattern = `${prefix}-%%-${year}`;

  // Find the highest existing sequence for this settlement+year
  const result = await pool.query(
    `SELECT file_number FROM msat.appeals
     WHERE file_number LIKE $1
     ORDER BY file_number DESC
     LIMIT 1`,
    [`${prefix}-%-${year}`]
  );

  let nextSeq = 1;
  if (result.rows.length > 0) {
    const lastFileNumber = result.rows[0].file_number;
    const parts = lastFileNumber.split('-');
    if (parts.length === 3) {
      nextSeq = parseInt(parts[1], 10) + 1;
    }
  }

  return `${prefix}-${String(nextSeq).padStart(4, '0')}-${year}`;
}

export async function listAppeals(req, res, next) {
  try {
    const { limit = 50, offset = 0, status, stage, settlement, issue_type, staff, date_from, date_to, search } = req.query;
    const limitNum = Math.min(parseInt(limit) || 50, 200);
    const offsetNum = parseInt(offset) || 0;

    const conditions = [];
    const params = [];
    let paramIdx = 1;

    if (status) {
      conditions.push(`a.status = $${paramIdx++}`);
      params.push(status);
    }

    if (stage) {
      conditions.push(`a.stage = $${paramIdx++}`);
      params.push(stage);
    }

    if (settlement) {
      // Settlement filter: match by file_number prefix (sort_order padded to 2 digits)
      conditions.push(`SPLIT_PART(a.file_number, '-', 1) = $${paramIdx++}`);
      params.push(String(settlement).padStart(2, '0'));
    }

    if (issue_type) {
      conditions.push(`a.issue_type = $${paramIdx++}`);
      params.push(issue_type);
    }

    if (staff) {
      conditions.push(`a.primary_staff = $${paramIdx++}`);
      params.push(staff);
    }

    if (date_from) {
      conditions.push(`a.contact_date >= $${paramIdx++}`);
      params.push(date_from);
    }

    if (date_to) {
      conditions.push(`a.contact_date <= $${paramIdx++}`);
      params.push(date_to);
    }

    if (search && search.trim().length >= 2) {
      const searchTerm = `%${search.trim()}%`;
      conditions.push(`(a.file_number ILIKE $${paramIdx} OR a.description ILIKE $${paramIdx} OR a.primary_staff ILIKE $${paramIdx})`);
      params.push(searchTerm);
      paramIdx++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countResult = await pool.query(
      `SELECT COUNT(*) FROM msat.appeals a ${whereClause}`,
      params
    );
    const total = parseInt(countResult.rows[0].count);

    const result = await pool.query(
      `SELECT a.id, a.file_number, a.contact_date, a.issue_type, a.status, a.stage, a.primary_staff, a.created_at
       FROM msat.appeals a
       ${whereClause}
       ORDER BY a.created_at DESC
       LIMIT $${paramIdx++} OFFSET $${paramIdx++}`,
      [...params, limitNum, offsetNum]
    );

    res.json({ success: true, data: result.rows, total, limit: limitNum, offset: offsetNum });
  } catch (err) {
    next(err);
  }
}

export async function createAppeal(req, res, next) {
  const client = await pool.connect();

  try {
    const { settlement_id, issue_type, description, legal_description, primary_staff, appellant_id } = req.body;

    // Validation
    if (!settlement_id) throw new APIError('Settlement is required', 400);
    if (!issue_type) throw new APIError('Issue type is required', 400);
    if (!description || !description.trim()) throw new APIError('Description is required', 400);
    if (description.length > 2000) throw new APIError('Description must be 2000 characters or less', 400);
    if (!primary_staff) throw new APIError('Assigned staff is required', 400);
    if (!appellant_id) throw new APIError('Appellant is required', 400);

    // Get settlement sort_order for file number generation
    const settlementResult = await client.query(
      'SELECT sort_order, name FROM msat.settlements WHERE id = $1',
      [settlement_id]
    );

    if (settlementResult.rows.length === 0) {
      throw new APIError('Invalid settlement', 400);
    }

    const settlement = settlementResult.rows[0];

    // Verify appellant exists
    const clientResult = await client.query(
      'SELECT id, first_name, last_name FROM msat.clients WHERE id = $1',
      [appellant_id]
    );

    if (clientResult.rows.length === 0) {
      throw new APIError('Appellant client not found', 400);
    }

    await client.query('BEGIN');

    // Generate file number
    const fileNumber = await generateFileNumber(settlement.sort_order);

    // Create appeal
    const appealResult = await client.query(
      `INSERT INTO msat.appeals (file_number, contact_date, issue_type, description, legal_description, primary_staff, status, stage, created_at, updated_at)
       VALUES ($1, CURRENT_DATE, $2, $3, $4, $5, 'Active', '1', NOW(), NOW())
       RETURNING *`,
      [fileNumber, issue_type, description.trim(), legal_description?.trim() || null, primary_staff]
    );

    const appeal = appealResult.rows[0];

    // Link appellant as party
    await client.query(
      `INSERT INTO msat.appeal_parties (appeal_id, client_id, party_type, created_at)
       VALUES ($1, $2, 'Applicant', NOW())`,
      [appeal.id, appellant_id]
    );

    // Log audit event
    await client.query(
      `INSERT INTO msat.audit_log (user_id, action, entity_type, entity_id, details, ip_address)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [req.user.id, 'appeal_create', 'appeal', appeal.id, JSON.stringify({
        file_number: fileNumber,
        settlement: settlement.name,
        issue_type,
        appellant: `${clientResult.rows[0].first_name} ${clientResult.rows[0].last_name}`
      }), req.ip]
    );

    await client.query('COMMIT');

    res.status(201).json({
      success: true,
      message: 'Appeal created successfully',
      appeal: {
        ...appeal,
        settlement_name: settlement.name,
        appellant: clientResult.rows[0]
      }
    });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
}

export async function getAppealById(req, res, next) {
  try {
    const { id } = req.params;

    const appealResult = await pool.query(
      `SELECT a.*,
              s.name as settlement_name
       FROM msat.appeals a
       LEFT JOIN msat.settlements s ON s.sort_order = CAST(SPLIT_PART(a.file_number, '-', 1) AS INTEGER)
       WHERE a.id = $1`,
      [id]
    );

    if (appealResult.rows.length === 0) {
      throw new APIError('Appeal not found', 404);
    }

    // Run all tab queries in parallel
    const [partiesResult, panelResult, documentsResult, timelineResult, correspondenceResult, hearingsResult, ordersResult, packagesResult] = await Promise.all([
      // Parties tab
      pool.query(
        `SELECT ap.id, ap.party_type, ap.client_id, ap.organization_id,
                c.first_name, c.last_name, c.email as client_email, c.phone_cell,
                c.address_1, c.city, c.province, c.postal_code,
                o.name as org_name
         FROM msat.appeal_parties ap
         LEFT JOIN msat.clients c ON ap.client_id = c.id
         LEFT JOIN msat.organizations o ON ap.organization_id = o.id
         WHERE ap.appeal_id = $1
         ORDER BY ap.party_type`,
        [id]
      ),
      // Panel tab
      pool.query(
        `SELECT id, panel_chair, panel_member_2, panel_member_3, date_assigned, mediator
         FROM msat.panel_compositions
         WHERE appeal_id = $1
         ORDER BY date_assigned DESC`,
        [id]
      ),
      // Documents tab
      pool.query(
        `SELECT id, file_name, original_name, file_type, mime_type, file_size, category, description, uploaded_by, created_at
         FROM msat.documents
         WHERE appeal_id = $1
         ORDER BY created_at DESC`,
        [id]
      ),
      // Timeline: audit log entries for this appeal
      pool.query(
        `SELECT al.id, al.action, al.details, al.created_at,
                u.first_name || ' ' || u.last_name as performed_by
         FROM msat.audit_log al
         LEFT JOIN msat.users u ON al.user_id = u.id
         WHERE (al.entity_type = 'appeal' AND al.entity_id = $1)
            OR (al.entity_type IN ('document', 'hearing_package') AND al.details->>'appeal_id' = $1::text)
         ORDER BY al.created_at DESC`,
        [id]
      ),
      // Correspondence / notes
      pool.query(
        `SELECT id, template_type, recipient, subject, body, sent_date, sent_by, created_at
         FROM msat.correspondence
         WHERE appeal_id = $1
         ORDER BY created_at DESC`,
        [id]
      ),
      // Hearing schedule
      pool.query(
        `SELECT id, hearing_date, hearing_time, location, hearing_type, is_public, notes, outcome
         FROM msat.hearing_schedule
         WHERE appeal_id = $1
         ORDER BY hearing_date DESC`,
        [id]
      ),
      // Orders/Decisions
      pool.query(
        `SELECT o.id, o.order_number, o.issue_date, o.hearing_date, o.keyword,
                o.app_for_leave, o.leave_granted, o.document_url, o.is_public, o.created_at,
                os.land, os.membership, os.compensation, os.descent_of_property,
                os.pmt_cancellations, os.trespass
         FROM msat.orders o
         LEFT JOIN msat.order_subjects os ON os.order_id = o.id
         WHERE o.appeal_id = $1
         ORDER BY o.order_number DESC`,
        [id]
      ),
      // Hearing packages
      pool.query(
        `SELECT hp.id, hp.name, hp.status, hp.compiled_by, hp.compiled_date, hp.hearing_id,
                u.first_name || ' ' || u.last_name as compiled_by_name,
                (SELECT COUNT(*) FROM msat.hearing_package_documents hpd WHERE hpd.package_id = hp.id) as document_count
         FROM msat.hearing_packages hp
         LEFT JOIN msat.users u ON hp.compiled_by = u.id
         WHERE hp.appeal_id = $1
         ORDER BY hp.compiled_date DESC`,
        [id]
      )
    ]);

    res.json({
      success: true,
      appeal: appealResult.rows[0],
      parties: partiesResult.rows,
      panel: panelResult.rows,
      documents: documentsResult.rows,
      timeline: timelineResult.rows,
      correspondence: correspondenceResult.rows,
      hearings: hearingsResult.rows,
      orders: ordersResult.rows,
      hearing_packages: packagesResult.rows
    });
  } catch (err) {
    next(err);
  }
}

export async function updateAppealStatus(req, res, next) {
  const client = await pool.connect();

  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!status) throw new APIError('Status is required', 400);

    // Verify appeal exists and get current status
    const current = await client.query(
      'SELECT id, status, on_hold_start FROM msat.appeals WHERE id = $1',
      [id]
    );

    if (current.rows.length === 0) {
      throw new APIError('Appeal not found', 404);
    }

    const oldStatus = current.rows[0].status;
    if (oldStatus === status) {
      return res.json({ success: true, message: 'Status unchanged', appeal: current.rows[0] });
    }

    // Validate status exists in lookup
    const statusCheck = await client.query(
      'SELECT name FROM msat.appeal_statuses WHERE name = $1',
      [status]
    );
    if (statusCheck.rows.length === 0) {
      throw new APIError('Invalid status value', 400);
    }

    await client.query('BEGIN');

    // Build update — handle on_hold_start/on_hold_end automatically
    let updateSQL = `UPDATE msat.appeals SET status = $1, updated_at = NOW()`;
    const updateParams = [status];
    let paramIdx = 2;

    if (status === 'On Hold') {
      updateSQL += `, on_hold_start = CURRENT_DATE`;
    } else if (oldStatus === 'On Hold') {
      updateSQL += `, on_hold_end = CURRENT_DATE`;
    }

    updateSQL += ` WHERE id = $${paramIdx} RETURNING *`;
    updateParams.push(id);

    const result = await client.query(updateSQL, updateParams);

    // Log audit event
    await client.query(
      `INSERT INTO msat.audit_log (user_id, action, entity_type, entity_id, details, ip_address)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [req.user.id, 'status_change', 'appeal', id, JSON.stringify({
        old_status: oldStatus,
        new_status: status
      }), req.ip]
    );

    await client.query('COMMIT');

    res.json({ success: true, message: 'Status updated', appeal: result.rows[0] });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
}

export async function updateAppealStage(req, res, next) {
  const client = await pool.connect();

  try {
    const { id } = req.params;
    const { stage } = req.body;

    if (!stage) throw new APIError('Stage is required', 400);

    // Verify appeal exists and get current stage
    const current = await client.query(
      'SELECT id, stage FROM msat.appeals WHERE id = $1',
      [id]
    );

    if (current.rows.length === 0) {
      throw new APIError('Appeal not found', 404);
    }

    const oldStage = current.rows[0].stage;
    if (oldStage === stage) {
      return res.json({ success: true, message: 'Stage unchanged', appeal: current.rows[0] });
    }

    // Validate stage exists in lookup
    const stageCheck = await client.query(
      'SELECT code FROM msat.appeal_stages WHERE code = $1',
      [stage]
    );
    if (stageCheck.rows.length === 0) {
      throw new APIError('Invalid stage value', 400);
    }

    await client.query('BEGIN');

    const result = await client.query(
      `UPDATE msat.appeals SET stage = $1, updated_at = NOW() WHERE id = $2 RETURNING *`,
      [stage, id]
    );

    // Log audit event
    await client.query(
      `INSERT INTO msat.audit_log (user_id, action, entity_type, entity_id, details, ip_address)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [req.user.id, 'stage_change', 'appeal', id, JSON.stringify({
        old_stage: oldStage,
        new_stage: stage
      }), req.ip]
    );

    await client.query('COMMIT');

    res.json({ success: true, message: 'Stage updated', appeal: result.rows[0] });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
}

export async function addParty(req, res, next) {
  const client = await pool.connect();

  try {
    const { id } = req.params;
    const { client_id, organization_id, party_type } = req.body;

    // Validation
    if (!party_type) throw new APIError('Party type is required', 400);
    if (!client_id && !organization_id) throw new APIError('Client or organization is required', 400);
    if (client_id && organization_id) throw new APIError('Provide either a client or an organization, not both', 400);

    // Verify appeal exists
    const appealResult = await client.query(
      'SELECT id, file_number FROM msat.appeals WHERE id = $1',
      [id]
    );
    if (appealResult.rows.length === 0) {
      throw new APIError('Appeal not found', 404);
    }

    // Verify the client or organization exists
    let partyName = '';
    if (client_id) {
      const clientResult = await client.query(
        'SELECT id, first_name, last_name FROM msat.clients WHERE id = $1',
        [client_id]
      );
      if (clientResult.rows.length === 0) {
        throw new APIError('Client not found', 400);
      }
      partyName = `${clientResult.rows[0].first_name} ${clientResult.rows[0].last_name}`;

      // Check for duplicate
      const dupCheck = await client.query(
        'SELECT id FROM msat.appeal_parties WHERE appeal_id = $1 AND client_id = $2 AND party_type = $3',
        [id, client_id, party_type]
      );
      if (dupCheck.rows.length > 0) {
        throw new APIError('This client is already linked as this party type', 409);
      }
    } else {
      const orgResult = await client.query(
        'SELECT id, name FROM msat.organizations WHERE id = $1',
        [organization_id]
      );
      if (orgResult.rows.length === 0) {
        throw new APIError('Organization not found', 400);
      }
      partyName = orgResult.rows[0].name;

      // Check for duplicate
      const dupCheck = await client.query(
        'SELECT id FROM msat.appeal_parties WHERE appeal_id = $1 AND organization_id = $2 AND party_type = $3',
        [id, organization_id, party_type]
      );
      if (dupCheck.rows.length > 0) {
        throw new APIError('This organization is already linked as this party type', 409);
      }
    }

    await client.query('BEGIN');

    const insertResult = await client.query(
      `INSERT INTO msat.appeal_parties (appeal_id, client_id, organization_id, party_type, created_at)
       VALUES ($1, $2, $3, $4, NOW())
       RETURNING *`,
      [id, client_id || null, organization_id || null, party_type]
    );

    // Log audit event
    await client.query(
      `INSERT INTO msat.audit_log (user_id, action, entity_type, entity_id, details, ip_address)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [req.user.id, 'party_add', 'appeal', id, JSON.stringify({
        party_name: partyName,
        party_type,
        party_kind: client_id ? 'client' : 'organization'
      }), req.ip]
    );

    await client.query('COMMIT');

    res.status(201).json({
      success: true,
      message: `${partyName} added as ${party_type}`,
      party: insertResult.rows[0]
    });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
}

export async function removeParty(req, res, next) {
  const client = await pool.connect();

  try {
    const { id, partyId } = req.params;

    // Verify appeal exists
    const appealResult = await client.query(
      'SELECT id FROM msat.appeals WHERE id = $1',
      [id]
    );
    if (appealResult.rows.length === 0) {
      throw new APIError('Appeal not found', 404);
    }

    // Get party details before deleting (for audit log)
    const partyResult = await client.query(
      `SELECT ap.id, ap.party_type, ap.client_id, ap.organization_id,
              c.first_name, c.last_name,
              o.name as org_name
       FROM msat.appeal_parties ap
       LEFT JOIN msat.clients c ON ap.client_id = c.id
       LEFT JOIN msat.organizations o ON ap.organization_id = o.id
       WHERE ap.id = $1 AND ap.appeal_id = $2`,
      [partyId, id]
    );

    if (partyResult.rows.length === 0) {
      throw new APIError('Party not found on this appeal', 404);
    }

    const party = partyResult.rows[0];
    const partyName = party.client_id
      ? `${party.first_name} ${party.last_name}`
      : party.org_name;

    await client.query('BEGIN');

    await client.query(
      'DELETE FROM msat.appeal_parties WHERE id = $1 AND appeal_id = $2',
      [partyId, id]
    );

    // Log audit event
    await client.query(
      `INSERT INTO msat.audit_log (user_id, action, entity_type, entity_id, details, ip_address)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [req.user.id, 'party_remove', 'appeal', id, JSON.stringify({
        party_name: partyName,
        party_type: party.party_type,
        party_kind: party.client_id ? 'client' : 'organization'
      }), req.ip]
    );

    await client.query('COMMIT');

    res.json({
      success: true,
      message: `${partyName} removed from appeal`
    });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
}

export async function assignPanel(req, res, next) {
  const client = await pool.connect();

  try {
    const { id } = req.params;
    const { panel_chair, panel_member_2, panel_member_3, mediator, date_assigned } = req.body;

    // Validation
    if (!panel_chair || !panel_chair.trim()) throw new APIError('Panel Chair is required', 400);
    if (!panel_member_2 || !panel_member_2.trim()) throw new APIError('Panel Member 2 is required', 400);

    // Check for duplicate names across roles
    const names = [panel_chair.trim(), panel_member_2.trim()];
    if (panel_member_3?.trim()) names.push(panel_member_3.trim());
    if (mediator?.trim()) names.push(mediator.trim());
    const uniqueNames = new Set(names.map(n => n.toLowerCase()));
    if (uniqueNames.size !== names.length) {
      throw new APIError('Cannot assign the same person to multiple panel roles', 400);
    }

    // Verify appeal exists
    const appealResult = await client.query(
      'SELECT id, file_number FROM msat.appeals WHERE id = $1',
      [id]
    );
    if (appealResult.rows.length === 0) {
      throw new APIError('Appeal not found', 404);
    }

    await client.query('BEGIN');

    const result = await client.query(
      `INSERT INTO msat.panel_compositions (appeal_id, panel_chair, panel_member_2, panel_member_3, mediator, date_assigned, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())
       RETURNING *`,
      [id, panel_chair.trim(), panel_member_2.trim(), panel_member_3?.trim() || null, mediator?.trim() || null, date_assigned || new Date().toISOString().split('T')[0]]
    );

    // Log audit event
    await client.query(
      `INSERT INTO msat.audit_log (user_id, action, entity_type, entity_id, details, ip_address)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [req.user.id, 'panel_assign', 'appeal', id, JSON.stringify({
        panel_chair: panel_chair.trim(),
        panel_member_2: panel_member_2.trim(),
        panel_member_3: panel_member_3?.trim() || null,
        mediator: mediator?.trim() || null
      }), req.ip]
    );

    await client.query('COMMIT');

    res.status(201).json({
      success: true,
      message: 'Panel assigned successfully',
      panel: result.rows[0]
    });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
}

export async function scheduleMediation(req, res, next) {
  const client = await pool.connect();

  try {
    const { id } = req.params;
    const { hearing_date, hearing_time, location, notes, is_public } = req.body;

    // Validation
    if (!hearing_date) throw new APIError('Mediation date is required', 400);

    // Verify appeal exists
    const appealResult = await client.query(
      'SELECT id, file_number, stage FROM msat.appeals WHERE id = $1',
      [id]
    );
    if (appealResult.rows.length === 0) {
      throw new APIError('Appeal not found', 404);
    }

    await client.query('BEGIN');

    // Insert into hearing_schedule with hearing_type = 'Mediation'
    const result = await client.query(
      `INSERT INTO msat.hearing_schedule (appeal_id, hearing_date, hearing_time, location, hearing_type, is_public, notes, created_at, updated_at)
       VALUES ($1, $2, $3, $4, 'Mediation', $5, $6, NOW(), NOW())
       RETURNING *`,
      [id, hearing_date, hearing_time || null, location || null, is_public !== false, notes || null]
    );

    // Update appeal mediation_date
    await client.query(
      'UPDATE msat.appeals SET mediation_date = $1 WHERE id = $2',
      [hearing_date, id]
    );

    // Auto-update stage to 2a if currently at stage 1
    const currentStage = appealResult.rows[0].stage;
    if (currentStage === '1') {
      await client.query(
        'UPDATE msat.appeals SET stage = $1 WHERE id = $2',
        ['2a', id]
      );
    }

    // Log audit event
    await client.query(
      `INSERT INTO msat.audit_log (user_id, action, entity_type, entity_id, details, ip_address)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [req.user.id, 'mediation_schedule', 'appeal', id, JSON.stringify({
        hearing_date,
        hearing_time: hearing_time || null,
        location: location || null,
        stage_updated: currentStage === '1' ? '1 → 2a' : null
      }), req.ip]
    );

    await client.query('COMMIT');

    res.status(201).json({
      success: true,
      message: 'Mediation scheduled successfully' + (currentStage === '1' ? ' (stage updated to 2a)' : ''),
      mediation: result.rows[0]
    });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
}

export async function updateMediationOutcome(req, res, next) {
  const client = await pool.connect();

  try {
    const { id, mediationId } = req.params;
    const { outcome } = req.body;

    // Validation
    const validOutcomes = ['Resolved', 'Unresolved', 'Adjourned'];
    if (!outcome || !validOutcomes.includes(outcome)) {
      throw new APIError(`Outcome must be one of: ${validOutcomes.join(', ')}`, 400);
    }

    // Verify mediation exists for this appeal
    const mediationResult = await client.query(
      `SELECT id, hearing_date FROM msat.hearing_schedule
       WHERE id = $1 AND appeal_id = $2 AND hearing_type = 'Mediation'`,
      [mediationId, id]
    );
    if (mediationResult.rows.length === 0) {
      throw new APIError('Mediation not found on this appeal', 404);
    }

    await client.query('BEGIN');

    const result = await client.query(
      `UPDATE msat.hearing_schedule SET outcome = $1, updated_at = NOW()
       WHERE id = $2 RETURNING *`,
      [outcome, mediationId]
    );

    // Log audit event
    await client.query(
      `INSERT INTO msat.audit_log (user_id, action, entity_type, entity_id, details, ip_address)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [req.user.id, 'mediation_outcome', 'appeal', id, JSON.stringify({
        mediation_id: mediationId,
        outcome,
        hearing_date: mediationResult.rows[0].hearing_date
      }), req.ip]
    );

    await client.query('COMMIT');

    res.json({
      success: true,
      message: `Mediation outcome recorded: ${outcome}`,
      mediation: result.rows[0]
    });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
}

export async function scheduleHearing(req, res, next) {
  const client = await pool.connect();

  try {
    const { id } = req.params;
    const { hearing_date, hearing_time, location, notes, is_public } = req.body;

    if (!hearing_date) throw new APIError('Hearing date is required', 400);

    // Verify appeal exists and get current stage
    const appealResult = await client.query(
      'SELECT id, file_number, stage FROM msat.appeals WHERE id = $1',
      [id]
    );
    if (appealResult.rows.length === 0) {
      throw new APIError('Appeal not found', 404);
    }

    // Panel must be assigned before scheduling a hearing
    const panelCheck = await client.query(
      'SELECT id FROM msat.panel_compositions WHERE appeal_id = $1 LIMIT 1',
      [id]
    );
    if (panelCheck.rows.length === 0) {
      throw new APIError('A panel must be assigned before scheduling a hearing', 400);
    }

    await client.query('BEGIN');

    // Insert into hearing_schedule with hearing_type = 'Oral' (default)
    const result = await client.query(
      `INSERT INTO msat.hearing_schedule (appeal_id, hearing_date, hearing_time, location, hearing_type, is_public, notes, created_at, updated_at)
       VALUES ($1, $2, $3, $4, 'Oral', $5, $6, NOW(), NOW())
       RETURNING *`,
      [id, hearing_date, hearing_time || null, location || null, is_public !== false, notes || null]
    );

    // Update appeal hearing_date
    await client.query(
      'UPDATE msat.appeals SET hearing_date = $1 WHERE id = $2',
      [hearing_date, id]
    );

    // Auto-update stage to 4 if currently at an earlier stage (1, 2a, 2b, 2c, 3)
    const currentStage = appealResult.rows[0].stage;
    const earlyStages = ['1', '2a', '2b', '2c', '3'];
    let stageUpdated = null;
    if (earlyStages.includes(currentStage)) {
      await client.query(
        'UPDATE msat.appeals SET stage = $1 WHERE id = $2',
        ['4', id]
      );
      stageUpdated = `${currentStage} → 4`;
    }

    // Log audit event
    await client.query(
      `INSERT INTO msat.audit_log (user_id, action, entity_type, entity_id, details, ip_address)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [req.user.id, 'hearing_schedule', 'appeal', id, JSON.stringify({
        hearing_date,
        hearing_time: hearing_time || null,
        location: location || null,
        is_public: is_public !== false,
        stage_updated: stageUpdated
      }), req.ip]
    );

    await client.query('COMMIT');

    res.status(201).json({
      success: true,
      message: 'Hearing scheduled successfully' + (stageUpdated ? ` (stage updated to 4)` : ''),
      hearing: result.rows[0]
    });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
}

export async function updateHearingOutcome(req, res, next) {
  const client = await pool.connect();

  try {
    const { id, hearingId } = req.params;
    const { outcome } = req.body;

    const validOutcomes = ['Completed', 'Adjourned', 'Cancelled'];
    if (!outcome || !validOutcomes.includes(outcome)) {
      throw new APIError(`Outcome must be one of: ${validOutcomes.join(', ')}`, 400);
    }

    // Verify hearing exists for this appeal
    const hearingResult = await client.query(
      `SELECT id, hearing_date FROM msat.hearing_schedule
       WHERE id = $1 AND appeal_id = $2 AND hearing_type = 'Oral'`,
      [hearingId, id]
    );
    if (hearingResult.rows.length === 0) {
      throw new APIError('Hearing not found on this appeal', 404);
    }

    await client.query('BEGIN');

    const result = await client.query(
      `UPDATE msat.hearing_schedule SET outcome = $1, updated_at = NOW()
       WHERE id = $2 RETURNING *`,
      [outcome, hearingId]
    );

    // Log audit event
    await client.query(
      `INSERT INTO msat.audit_log (user_id, action, entity_type, entity_id, details, ip_address)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [req.user.id, 'hearing_outcome', 'appeal', id, JSON.stringify({
        hearing_id: hearingId,
        outcome,
        hearing_date: hearingResult.rows[0].hearing_date
      }), req.ip]
    );

    await client.query('COMMIT');

    res.json({
      success: true,
      message: `Hearing outcome recorded: ${outcome}`,
      hearing: result.rows[0]
    });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
}

export async function recordOrder(req, res, next) {
  const client = await pool.connect();

  try {
    const { id } = req.params;
    const { issue_date, hearing_date, keyword, app_for_leave, leave_granted, is_public, subjects } = req.body;

    if (!issue_date) throw new APIError('Issue date is required', 400);

    // Verify appeal exists
    const appealResult = await client.query(
      'SELECT id, file_number, status FROM msat.appeals WHERE id = $1',
      [id]
    );
    if (appealResult.rows.length === 0) {
      throw new APIError('Appeal not found', 404);
    }

    await client.query('BEGIN');

    // Get next order_number (global auto-increment)
    const maxResult = await client.query('SELECT COALESCE(MAX(order_number), 0) + 1 AS next_num FROM msat.orders');
    const orderNumber = maxResult.rows[0].next_num;

    // Insert order
    const orderResult = await client.query(
      `INSERT INTO msat.orders (appeal_id, order_number, issue_date, hearing_date, keyword, app_for_leave, leave_granted, is_public, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
       RETURNING *`,
      [id, orderNumber, issue_date, hearing_date || null, keyword || null,
       app_for_leave === true, leave_granted === true, is_public !== false]
    );

    // Insert order subjects if provided
    if (subjects) {
      await client.query(
        `INSERT INTO msat.order_subjects (order_id, order_number, land, membership, compensation, descent_of_property, pmt_cancellations, trespass)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [orderResult.rows[0].id, orderNumber,
         subjects.land === true, subjects.membership === true,
         subjects.compensation === true, subjects.descent_of_property === true,
         subjects.pmt_cancellations === true, subjects.trespass === true]
      );
    }

    // Auto-update status to "Order Issued"
    const oldStatus = appealResult.rows[0].status;
    let statusUpdated = null;
    if (oldStatus !== 'Order Issued') {
      await client.query(
        'UPDATE msat.appeals SET status = $1 WHERE id = $2',
        ['Order Issued', id]
      );
      statusUpdated = `${oldStatus} → Order Issued`;
    }

    // Audit log
    await client.query(
      `INSERT INTO msat.audit_log (user_id, action, entity_type, entity_id, details, ip_address)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [req.user.id, 'order_record', 'appeal', id, JSON.stringify({
        order_number: orderNumber,
        issue_date,
        hearing_date: hearing_date || null,
        keyword: keyword || null,
        app_for_leave: app_for_leave === true,
        leave_granted: leave_granted === true,
        status_updated: statusUpdated
      }), req.ip]
    );

    await client.query('COMMIT');

    res.status(201).json({
      success: true,
      message: `Order #${orderNumber} recorded successfully` + (statusUpdated ? ' (status updated to Order Issued)' : ''),
      order: orderResult.rows[0]
    });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
}
