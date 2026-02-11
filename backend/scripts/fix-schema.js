import dotenv from 'dotenv';
import pg from 'pg';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import MDBReader from 'mdb-reader';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../.env') });

const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

const PROJECT_DATA = path.join(__dirname, '../../project_data/IR - MSAT');

function trim(val) {
  if (val === null || val === undefined) return null;
  const s = String(val).trim();
  return s === '' ? null : s;
}

function parseDate(val) {
  if (!val) return null;
  if (val instanceof Date) {
    if (isNaN(val.getTime())) return null;
    return val.toISOString().split('T')[0];
  }
  const s = String(val).trim();
  if (!s || s === 'null') return null;
  const d = new Date(s);
  if (isNaN(d.getTime())) return null;
  return d.toISOString().split('T')[0];
}

async function fix() {
  const client = await pool.connect();

  try {
    console.log('Schema Fix - MSAT');
    console.log('='.repeat(70));

    // Step 1: Get all unique stage and status values from Access
    const msatBuf = fs.readFileSync(path.join(PROJECT_DATA, 'MSAT Database – Protected A.accdb'));
    const msatDb = new MDBReader(Buffer.from(msatBuf));
    const appeals = msatDb.getTable('Appeal').getData();

    const stages = new Set();
    const statuses = new Set();
    for (const r of appeals) {
      if (r.Stage) stages.add(String(r.Stage).trim());
      if (r.Status) statuses.add(String(r.Status).trim());
    }
    console.log('\nUnique Stages in Access DB:', [...stages].sort());
    console.log('Unique Statuses in Access DB:', [...statuses].sort());

    // Step 2: Widen VARCHAR columns
    console.log('\n--- Widening columns ---');

    await client.query(`ALTER TABLE msat.appeal_stages ALTER COLUMN code TYPE VARCHAR(50);`);
    console.log('  appeal_stages.code → VARCHAR(50)');

    await client.query(`ALTER TABLE msat.appeals ALTER COLUMN stage TYPE VARCHAR(50);`);
    console.log('  appeals.stage → VARCHAR(50)');

    // Step 3: Seed any missing stage lookup values
    console.log('\n--- Seeding missing stage values ---');
    for (const stage of stages) {
      const res = await client.query(
        `INSERT INTO msat.appeal_stages (code, name, sort_order)
         VALUES ($1, $2, $3)
         ON CONFLICT (code) DO NOTHING`,
        [stage, stage, 0]
      );
      if (res.rowCount > 0) console.log('  Added stage: ' + stage);
    }

    // Seed any missing status values
    for (const status of statuses) {
      const res = await client.query(
        `INSERT INTO msat.appeal_statuses (code, name, sort_order)
         VALUES ($1, $2, $3)
         ON CONFLICT (code) DO NOTHING`,
        [status, status, 0]
      );
      if (res.rowCount > 0) console.log('  Added status: ' + status);
    }

    // Step 4: Create missing tables (Legal, LegalSubject)
    console.log('\n--- Creating missing tables ---');

    await client.query(`
      CREATE TABLE IF NOT EXISTS msat.legal (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        legacy_legal_id INTEGER UNIQUE,
        appeal_id UUID REFERENCES msat.appeals(id) ON DELETE CASCADE,
        legacy_file_number VARCHAR(30),
        law_firm TEXT,
        legal_pdf TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    console.log('  legal (from Access Legal table - 0 rows currently)');

    await client.query(`
      CREATE TABLE IF NOT EXISTS msat.legal_subjects (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        legal_id UUID REFERENCES msat.legal(id) ON DELETE CASCADE,
        legacy_legal_id INTEGER,
        jurisdiction TEXT,
        membership TEXT,
        estate_instructions TEXT,
        dower TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    console.log('  legal_subjects (from Access LegalSubject table - 0 rows currently)');

    // Add indexes for new tables
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_legal_appeal ON msat.legal(appeal_id);
      CREATE INDEX IF NOT EXISTS idx_legal_file_number ON msat.legal(legacy_file_number);
      CREATE INDEX IF NOT EXISTS idx_legal_subjects_legal ON msat.legal_subjects(legal_id);
    `);
    console.log('  Indexes created for new tables');

    // Step 5: Re-import the 329 missing appeals
    console.log('\n--- Re-importing failed appeals ---');
    let imported = 0;
    let failed = 0;
    const errors = [];

    for (const row of appeals) {
      const fileNo = trim(row.FileNo);
      if (!fileNo) { failed++; continue; }

      // Check if already exists
      const existing = await client.query('SELECT id FROM msat.appeals WHERE file_number = $1', [fileNo]);
      if (existing.rows.length > 0) continue; // already imported

      try {
        await client.query(`
          INSERT INTO msat.appeals (
            file_number, contact_date, issue_type, legal_description,
            mediation_date, hearing_date, closed_date, primary_staff,
            secondary_staff, status, stage, description, notes,
            on_hold_start, on_hold_end, background
          ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
          ON CONFLICT (file_number) DO UPDATE SET
            status = EXCLUDED.status, stage = EXCLUDED.stage,
            hearing_date = EXCLUDED.hearing_date, closed_date = EXCLUDED.closed_date,
            updated_at = NOW()
        `, [
          fileNo, parseDate(row.ContactDate), trim(row.Issue),
          trim(row.LegalDesc), parseDate(row.MedDate), parseDate(row.HearDate),
          parseDate(row.ClosedDate), trim(row.Staff), trim(row['Staff 2']),
          trim(row.Status), trim(row.Stage), trim(row.Description),
          trim(row.Notes), parseDate(row['On Hold Start']),
          parseDate(row['On Hold End']), trim(row.Background)
        ]);
        imported++;
      } catch (e) {
        failed++;
        if (errors.length < 5) errors.push({ fileNo, error: e.message });
      }
    }
    console.log(`  Newly imported: ${imported}, Failed: ${failed}`);
    if (errors.length > 0) {
      console.log('  Sample errors:', JSON.stringify(errors, null, 2));
    }

    // Step 6: Re-link panel_compositions that may now have matching appeals
    console.log('\n--- Re-linking panel_compositions to new appeals ---');
    const linkResult = await client.query(`
      UPDATE msat.panel_compositions pc
      SET appeal_id = a.id
      FROM msat.appeals a
      WHERE pc.legacy_file_number = a.file_number
        AND pc.appeal_id IS NULL
    `);
    console.log(`  panel_compositions → appeals: ${linkResult.rowCount} newly linked`);

    // Re-link appeal_parties
    const linkAP = await client.query(`
      UPDATE msat.appeal_parties ap
      SET appeal_id = a.id
      FROM msat.appeals a
      WHERE ap.legacy_file_number = a.file_number
        AND ap.appeal_id IS NULL
    `);
    console.log(`  appeal_parties → appeals: ${linkAP.rowCount} newly linked`);

    // Step 7: Final record counts
    console.log('\n--- Final Record Counts ---');
    const tables = [
      'settlements', 'issue_types', 'appeal_statuses', 'appeal_stages',
      'organizations', 'clients', 'appeals', 'orders', 'order_subjects',
      'appeal_parties', 'panel_compositions', 'legal', 'legal_subjects',
      'documents', 'hearing_schedule', 'correspondence', 'messages',
      'lap_applications', 'lap_orders', 'lap_access_records',
      'users', 'notifications', 'audit_log', 'import_history'
    ];
    for (const t of tables) {
      const r = await client.query(`SELECT COUNT(*) as cnt FROM msat.${t}`);
      console.log(`  ${t.padEnd(25)}: ${r.rows[0].cnt} rows`);
    }

    // Access DB totals for comparison
    console.log('\n--- Access DB Totals (source) ---');
    console.log(`  Appeal:                  ${appeals.length} rows`);
    console.log(`  Client:                  ${msatDb.getTable('Client').getData().length} rows`);
    console.log(`  Organizations:           ${msatDb.getTable('Organizations').getData().length} rows`);
    console.log(`  Order:                   ${msatDb.getTable('Order').getData().length} rows`);
    console.log(`  OrderSubject:            ${msatDb.getTable('OrderSubject').getData().length} rows`);
    console.log(`  AppealDetails:           ${msatDb.getTable('AppealDetails').getData().length} rows`);
    console.log(`  PanelComp:               ${msatDb.getTable('PanelComp').getData().length} rows`);
    console.log(`  Legal:                   ${msatDb.getTable('Legal').getData().length} rows`);
    console.log(`  LegalSubject:            ${msatDb.getTable('LegalSubject').getData().length} rows`);

    const lapBuf = fs.readFileSync(path.join(PROJECT_DATA, 'LAP.accdb'));
    const lapDb = new MDBReader(Buffer.from(lapBuf));
    console.log(`  TblLAPApplication:       ${lapDb.getTable('TblLAPApplication').getData().length} rows`);
    console.log(`  TblLAPOrder:             ${lapDb.getTable('TblLAPOrder').getData().length} rows`);
    console.log(`  TblAccess to Patented Land: ${lapDb.getTable('TblAccess to Patented Land').getData().length} rows`);

    console.log('\n' + '='.repeat(70));
    console.log('Schema fix completed successfully!');

  } catch (error) {
    console.error('Error:', error.message);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

fix().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
