import dotenv from 'dotenv';
import pg from 'pg';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../.env') });

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function seed() {
  const client = await pool.connect();

  try {
    console.log('Seeding Lookup Data - MSAT');
    console.log('='.repeat(70));

    await client.query('SET search_path TO msat, public;');

    // ============================================================
    // SETTLEMENTS
    // ============================================================
    console.log('\nSeeding settlements...');
    const settlements = [
      { code: 'BL', name: 'Buffalo Lake', sort: 1 },
      { code: 'EP', name: 'East Prairie', sort: 2 },
      { code: 'EL', name: 'Elizabeth', sort: 3 },
      { code: 'FL', name: 'Fishing Lake', sort: 4 },
      { code: 'GL', name: 'Gift Lake', sort: 5 },
      { code: 'KI', name: 'Kikino', sort: 6 },
      { code: 'PP', name: 'Paddle Prairie', sort: 7 },
      { code: 'PV', name: 'Peavine', sort: 8 }
    ];

    for (const s of settlements) {
      await client.query(`
        INSERT INTO msat.settlements (code, name, sort_order)
        VALUES ($1, $2, $3)
        ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, sort_order = EXCLUDED.sort_order
      `, [s.code, s.name, s.sort]);
    }
    console.log(`  ${settlements.length} settlements`);

    // ============================================================
    // ISSUE TYPES
    // ============================================================
    console.log('\nSeeding issue types...');
    const issueTypes = [
      { code: 'Land', name: 'Land', sort: 1 },
      { code: 'Membership', name: 'Membership', sort: 2 },
      { code: 'Compensation', name: 'Compensation', sort: 3 },
      { code: 'Descent of Property', name: 'Descent of Property', sort: 4 },
      { code: 'PMT Cancellations', name: 'PMT Cancellations', sort: 5 },
      { code: 'Trespass', name: 'Trespass', sort: 6 },
      { code: 'Dower', name: 'Dower', sort: 7 },
      { code: 'Estate', name: 'Estate', sort: 8 }
    ];

    for (const it of issueTypes) {
      await client.query(`
        INSERT INTO msat.issue_types (code, name, sort_order)
        VALUES ($1, $2, $3)
        ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, sort_order = EXCLUDED.sort_order
      `, [it.code, it.name, it.sort]);
    }
    console.log(`  ${issueTypes.length} issue types`);

    // ============================================================
    // APPEAL STATUSES
    // ============================================================
    console.log('\nSeeding appeal statuses...');
    const appealStatuses = [
      { code: 'New', name: 'New', sort: 1 },
      { code: 'Active', name: 'Active', sort: 2 },
      { code: 'Conciliation', name: 'Conciliation', sort: 3 },
      { code: 'Conciliated', name: 'Conciliated', sort: 4 },
      { code: 'Mediation', name: 'Mediation', sort: 5 },
      { code: 'Mediated', name: 'Mediated', sort: 6 },
      { code: 'On Hold', name: 'On Hold', sort: 7 },
      { code: 'Order Issued', name: 'Order Issued', sort: 8 },
      { code: 'Decision Letter Issued', name: 'Decision Letter Issued', sort: 9 },
      { code: 'No Merit', name: 'No Merit', sort: 10 },
      { code: 'No Jurisdiction', name: 'No Jurisdiction', sort: 11 },
      { code: 'Withdrawn', name: 'Withdrawn', sort: 12 },
      { code: 'Closed', name: 'Closed', sort: 13 }
    ];

    for (const as of appealStatuses) {
      await client.query(`
        INSERT INTO msat.appeal_statuses (code, name, sort_order)
        VALUES ($1, $2, $3)
        ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, sort_order = EXCLUDED.sort_order
      `, [as.code, as.name, as.sort]);
    }
    console.log(`  ${appealStatuses.length} appeal statuses`);

    // ============================================================
    // APPEAL STAGES (from Operations Manual)
    // ============================================================
    console.log('\nSeeding appeal stages...');
    const appealStages = [
      { code: '1', name: 'Receipt of Appeal', sort: 1 },
      { code: '2a', name: 'Mediation', sort: 2 },
      { code: '2b', name: 'Preliminary Information Gathering', sort: 3 },
      { code: '2c', name: 'Paper Review', sort: 4 },
      { code: '3', name: 'Information Gathering & Draft Hearing Package', sort: 5 },
      { code: '4', name: 'Draft Hearing Package & Hearing Scheduling', sort: 6 },
      { code: '5', name: 'Hearing & Decision', sort: 7 },
      { code: 'Information Gathering', name: 'Information Gathering', sort: 8 },
      { code: 'Conciliation Phase', name: 'Conciliation Phase', sort: 9 },
      { code: 'Mediation', name: 'Mediation', sort: 10 },
      { code: 'Hearing Scheduled', name: 'Hearing Scheduled', sort: 11 },
      { code: 'Decision Pending', name: 'Decision Pending', sort: 12 },
      { code: 'Paper Review', name: 'Paper Review', sort: 13 },
      { code: 'DHP Prep', name: 'Draft Hearing Package Preparation', sort: 14 },
      { code: 'DHP Sent', name: 'Draft Hearing Package Sent', sort: 15 },
      { code: 'Draft Hearing Package Sent', name: 'Draft Hearing Package Sent', sort: 16 },
      { code: 'Preliminary Issue Jurisdiction', name: 'Preliminary Issue - Jurisdiction', sort: 17 },
      { code: 'On Hold', name: 'On Hold', sort: 18 },
      { code: 'Order Issued', name: 'Order Issued', sort: 19 }
    ];

    for (const st of appealStages) {
      await client.query(`
        INSERT INTO msat.appeal_stages (code, name, sort_order)
        VALUES ($1, $2, $3)
        ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, sort_order = EXCLUDED.sort_order
      `, [st.code, st.name, st.sort]);
    }
    console.log(`  ${appealStages.length} appeal stages`);

    console.log('\n' + '='.repeat(70));
    console.log('Seed completed successfully!');

  } catch (error) {
    console.error('Seed error:', error.message);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

seed().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
