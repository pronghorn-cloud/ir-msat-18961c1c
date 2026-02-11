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

function parseBool(val) {
  if (val === null || val === undefined) return false;
  if (typeof val === 'boolean') return val;
  const s = String(val).toLowerCase().trim();
  return s === 'true' || s === 'yes' || s === '1' || s === '-1';
}

function parseInt2(val) {
  if (val === null || val === undefined) return null;
  const n = parseInt(String(val), 10);
  return isNaN(n) ? null : n;
}

async function logImport(client, fileName, tableName, imported, failed, errorMsg) {
  await client.query(`
    INSERT INTO msat.import_history (file_name, table_name, records_imported, records_failed, status, error_message)
    VALUES ($1, $2, $3, $4, $5, $6)
  `, [fileName, tableName, imported, failed, failed > 0 ? 'Partial' : 'Success', errorMsg || null]);
}

async function importData() {
  const client = await pool.connect();

  try {
    console.log('Data Import - MSAT');
    console.log('='.repeat(70));

    await client.query('SET search_path TO msat, public;');

    // ============================================================
    // MSAT DATABASE
    // ============================================================
    const msatDbPath = path.join(PROJECT_DATA, 'MSAT Database – Protected A.accdb');
    console.log(`\nReading MSAT Database: ${path.basename(msatDbPath)}`);

    const msatBuf = fs.readFileSync(msatDbPath);
    const msatDb = new MDBReader(msatBuf);

    // ----- Organizations -----
    console.log('\n--- Organizations ---');
    const orgs = msatDb.getTable('Organizations').getData();
    let imported = 0, failed = 0;

    for (const row of orgs) {
      try {
        await client.query(`
          INSERT INTO msat.organizations (legacy_org_id, name, address_1, address_2, city, province, postal_code, phone, fax, toll_free, email)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
          ON CONFLICT (legacy_org_id) DO UPDATE SET
            name = EXCLUDED.name, address_1 = EXCLUDED.address_1, city = EXCLUDED.city,
            phone = EXCLUDED.phone, email = EXCLUDED.email, updated_at = NOW()
        `, [
          parseInt2(row.OrgID), trim(row.OrgName), trim(row.Addr1), trim(row.Addr2),
          trim(row.City), trim(row.Prov), trim(row.Postal), trim(row.Work),
          trim(row.Fax), trim(row.TollFree), trim(row.Email)
        ]);
        imported++;
      } catch (e) { failed++; }
    }
    console.log(`  Imported: ${imported}, Failed: ${failed}`);
    await logImport(client, 'MSAT Database', 'organizations', imported, failed);

    // ----- Clients -----
    console.log('\n--- Clients ---');
    const clients = msatDb.getTable('Client').getData();
    imported = 0; failed = 0;

    for (const row of clients) {
      try {
        await client.query(`
          INSERT INTO msat.clients (
            legacy_client_id, member_id, title, first_name, middle_name, last_name,
            address_1, address_2, city, province, postal_code, date_of_birth,
            phone_home, phone_work, phone_cell, fax, email, settlement,
            org_name, job_title, department, notes
          ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22)
          ON CONFLICT (legacy_client_id) DO UPDATE SET
            first_name = EXCLUDED.first_name, last_name = EXCLUDED.last_name,
            email = EXCLUDED.email, phone_cell = EXCLUDED.phone_cell,
            settlement = EXCLUDED.settlement, updated_at = NOW()
        `, [
          parseInt2(row.ClientID), trim(row.MemberID), trim(row.Title),
          trim(row.FName), trim(row.MName), trim(row.LName),
          trim(row.Addr1), trim(row.Addr2), trim(row.City),
          trim(row.Prov), trim(row.Postal), parseDate(row.DOB),
          trim(row.Home), trim(row.Work), trim(row.Cell),
          trim(row.Fax), trim(row.Email), trim(row.Settlement),
          trim(row.OrgName), trim(row.JobTitle), trim(row.Department),
          trim(row.Notes)
        ]);
        imported++;
      } catch (e) { failed++; }
    }
    console.log(`  Imported: ${imported}, Failed: ${failed}`);
    await logImport(client, 'MSAT Database', 'clients', imported, failed);

    // ----- Appeals -----
    console.log('\n--- Appeals ---');
    const appeals = msatDb.getTable('Appeal').getData();
    imported = 0; failed = 0;

    for (const row of appeals) {
      try {
        const fileNo = trim(row.FileNo);
        if (!fileNo) { failed++; continue; }

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
      } catch (e) { failed++; }
    }
    console.log(`  Imported: ${imported}, Failed: ${failed}`);
    await logImport(client, 'MSAT Database', 'appeals', imported, failed);

    // ----- Orders -----
    console.log('\n--- Orders ---');
    const orders = msatDb.getTable('Order').getData();
    imported = 0; failed = 0;

    for (const row of orders) {
      try {
        const orderNo = parseInt2(row.OrderNo);
        if (!orderNo) { failed++; continue; }

        await client.query(`
          INSERT INTO msat.orders (order_number, issue_date, hearing_date, keyword, app_for_leave, leave_granted)
          VALUES ($1, $2, $3, $4, $5, $6)
          ON CONFLICT (order_number) DO UPDATE SET
            issue_date = EXCLUDED.issue_date, keyword = EXCLUDED.keyword, updated_at = NOW()
        `, [
          orderNo, parseDate(row.IssueDate), parseDate(row.HearDate),
          trim(row.Keyword), parseBool(row.AppForLeave), parseBool(row.LeaveGranted)
        ]);
        imported++;
      } catch (e) { failed++; }
    }
    console.log(`  Imported: ${imported}, Failed: ${failed}`);
    await logImport(client, 'MSAT Database', 'orders', imported, failed);

    // ----- Appeal Details (Parties) -----
    console.log('\n--- Appeal Parties (AppealDetails) ---');
    const details = msatDb.getTable('AppealDetails').getData();
    imported = 0; failed = 0;

    for (const row of details) {
      try {
        await client.query(`
          INSERT INTO msat.appeal_parties (
            legacy_file_number, legacy_client_id, legacy_org_id, legacy_order_number, party_type
          ) VALUES ($1, $2, $3, $4, $5)
        `, [
          trim(row.FileNo), parseInt2(row.ClientID), parseInt2(row.OrgID),
          parseInt2(row.OrderNo), trim(row.ClientType)
        ]);
        imported++;
      } catch (e) { failed++; }
    }
    console.log(`  Imported: ${imported}, Failed: ${failed}`);
    await logImport(client, 'MSAT Database', 'appeal_parties', imported, failed);

    // ----- Panel Compositions -----
    console.log('\n--- Panel Compositions ---');
    const panels = msatDb.getTable('PanelComp').getData();
    imported = 0; failed = 0;

    for (const row of panels) {
      try {
        await client.query(`
          INSERT INTO msat.panel_compositions (
            legacy_file_number, panel_chair, panel_member_2, panel_member_3, date_assigned, mediator
          ) VALUES ($1, $2, $3, $4, $5, $6)
        `, [
          trim(row.FileNo), trim(row.PanelChair), trim(row.Panel2),
          trim(row.Panel3), parseDate(row.DateAssigned), trim(row.Mediator)
        ]);
        imported++;
      } catch (e) { failed++; }
    }
    console.log(`  Imported: ${imported}, Failed: ${failed}`);
    await logImport(client, 'MSAT Database', 'panel_compositions', imported, failed);

    // ----- Order Subjects -----
    console.log('\n--- Order Subjects ---');
    const orderSubjects = msatDb.getTable('OrderSubject').getData();
    imported = 0; failed = 0;

    for (const row of orderSubjects) {
      try {
        await client.query(`
          INSERT INTO msat.order_subjects (
            order_number, land, membership, compensation,
            descent_of_property, pmt_cancellations, trespass
          ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        `, [
          parseInt2(row.OrderNo), parseBool(row.Land), parseBool(row.Membership),
          parseBool(row.Compensation), parseBool(row.DescentOfProperty),
          parseBool(row.PMTCancellations), parseBool(row.Trespass)
        ]);
        imported++;
      } catch (e) { failed++; }
    }
    console.log(`  Imported: ${imported}, Failed: ${failed}`);
    await logImport(client, 'MSAT Database', 'order_subjects', imported, failed);

    // ============================================================
    // LAP DATABASE
    // ============================================================
    const lapDbPath = path.join(PROJECT_DATA, 'LAP.accdb');
    console.log(`\n\nReading LAP Database: ${path.basename(lapDbPath)}`);

    const lapBuf = fs.readFileSync(lapDbPath);
    const lapDb = new MDBReader(lapBuf);

    // ----- LAP Applications -----
    console.log('\n--- LAP Applications ---');
    const lapApps = lapDb.getTable('TblLAPApplication').getData();
    imported = 0; failed = 0;

    for (const row of lapApps) {
      try {
        const appNum = trim(row.LAPApplicationNumber);
        if (!appNum) { failed++; continue; }

        await client.query(`
          INSERT INTO msat.lap_applications (
            application_number, file_number, applicant, contact_date,
            amendment, status, staff_notes, staff
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          ON CONFLICT (application_number) DO UPDATE SET
            status = EXCLUDED.status, staff = EXCLUDED.staff, updated_at = NOW()
        `, [
          appNum, trim(row.LAPFileNumber), trim(row.Applicant),
          parseDate(row['Contact Date']), parseBool(row.Amendment),
          trim(row.Status), trim(row['Staff Notes']), trim(row.Staff)
        ]);
        imported++;
      } catch (e) { failed++; }
    }
    console.log(`  Imported: ${imported}, Failed: ${failed}`);
    await logImport(client, 'LAP Database', 'lap_applications', imported, failed);

    // ----- LAP Orders -----
    console.log('\n--- LAP Orders ---');
    const lapOrders = lapDb.getTable('TblLAPOrder').getData();
    imported = 0; failed = 0;

    for (const row of lapOrders) {
      try {
        await client.query(`
          INSERT INTO msat.lap_orders (order_number, date_issued, legacy_application_number)
          VALUES ($1, $2, $3)
        `, [
          trim(row.LAPOrderNumber), parseDate(row.LAPOrderDateIssued),
          trim(row.LAPApplicationNumber)
        ]);
        imported++;
      } catch (e) { failed++; }
    }
    console.log(`  Imported: ${imported}, Failed: ${failed}`);
    await logImport(client, 'LAP Database', 'lap_orders', imported, failed);

    // ----- LAP Access Records -----
    console.log('\n--- LAP Access Records ---');
    const lapAccess = lapDb.getTable('TblAccess to Patented Land').getData();
    imported = 0; failed = 0;

    for (const row of lapAccess) {
      try {
        await client.query(`
          INSERT INTO msat.lap_access_records (
            file_number, status, reo, reo_date, co, co_date,
            purpose, project_type, wellsite_legal, operator,
            settlement, anniversary_date, lands_affected
          ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
        `, [
          trim(row.LAPFileNumber), trim(row.Statuslookup), trim(row.REO),
          parseDate(row['REO Date Issued']), trim(row.CO), parseDate(row['CO Date Issued']),
          trim(row['Purpose of REO']), trim(row.ProjectType),
          trim(row['Wellsite Legal']), trim(row.Operator),
          trim(row.Settlement), parseDate(row['Aniversary Date']),
          trim(row.LandsAffected)
        ]);
        imported++;
      } catch (e) { failed++; }
    }
    console.log(`  Imported: ${imported}, Failed: ${failed}`);
    await logImport(client, 'LAP Database', 'lap_access_records', imported, failed);

    // ============================================================
    // LINK FOREIGN KEYS
    // ============================================================
    console.log('\n\nLinking foreign keys...');

    // Link appeal_parties.appeal_id
    const apLink = await client.query(`
      UPDATE msat.appeal_parties ap
      SET appeal_id = a.id
      FROM msat.appeals a
      WHERE ap.legacy_file_number = a.file_number AND ap.appeal_id IS NULL
    `);
    console.log(`  appeal_parties → appeals: ${apLink.rowCount} linked`);

    // Link appeal_parties.client_id
    const clLink = await client.query(`
      UPDATE msat.appeal_parties ap
      SET client_id = c.id
      FROM msat.clients c
      WHERE ap.legacy_client_id = c.legacy_client_id AND ap.client_id IS NULL
    `);
    console.log(`  appeal_parties → clients: ${clLink.rowCount} linked`);

    // Link appeal_parties.organization_id
    const orgLink = await client.query(`
      UPDATE msat.appeal_parties ap
      SET organization_id = o.id
      FROM msat.organizations o
      WHERE ap.legacy_org_id = o.legacy_org_id AND ap.organization_id IS NULL AND ap.legacy_org_id IS NOT NULL
    `);
    console.log(`  appeal_parties → organizations: ${orgLink.rowCount} linked`);

    // Link appeal_parties.order_id
    const ordLink = await client.query(`
      UPDATE msat.appeal_parties ap
      SET order_id = o.id
      FROM msat.orders o
      WHERE ap.legacy_order_number = o.order_number AND ap.order_id IS NULL AND ap.legacy_order_number IS NOT NULL
    `);
    console.log(`  appeal_parties → orders: ${ordLink.rowCount} linked`);

    // Link panel_compositions.appeal_id
    const panelLink = await client.query(`
      UPDATE msat.panel_compositions pc
      SET appeal_id = a.id
      FROM msat.appeals a
      WHERE pc.legacy_file_number = a.file_number AND pc.appeal_id IS NULL
    `);
    console.log(`  panel_compositions → appeals: ${panelLink.rowCount} linked`);

    // Link lap_orders.application_id
    const lapOrdLink = await client.query(`
      UPDATE msat.lap_orders lo
      SET application_id = la.id
      FROM msat.lap_applications la
      WHERE lo.legacy_application_number = la.application_number AND lo.application_id IS NULL
    `);
    console.log(`  lap_orders → lap_applications: ${lapOrdLink.rowCount} linked`);

    console.log('\n' + '='.repeat(70));
    console.log('Import completed successfully!');

    // Print summary
    console.log('\n--- Record Counts ---');
    const tables = [
      'organizations', 'clients', 'appeals', 'orders', 'order_subjects',
      'appeal_parties', 'panel_compositions',
      'lap_applications', 'lap_orders', 'lap_access_records'
    ];

    for (const t of tables) {
      const res = await client.query(`SELECT COUNT(*) FROM msat.${t}`);
      console.log(`  ${t}: ${res.rows[0].count}`);
    }

  } catch (error) {
    console.error('Import error:', error.message);
    console.error(error.stack);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

importData().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
