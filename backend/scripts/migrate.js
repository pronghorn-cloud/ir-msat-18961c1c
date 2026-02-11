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

async function migrate() {
  const client = await pool.connect();

  try {
    console.log('Database Migration - MSAT');
    console.log('='.repeat(70));

    // Test connection
    const res = await client.query('SELECT NOW()');
    console.log(`Connected at ${res.rows[0].now}\n`);

    // Create schema
    await client.query('CREATE SCHEMA IF NOT EXISTS msat;');
    console.log('Schema created: msat\n');

    await client.query('SET search_path TO msat, public;');

    // ============================================================
    // LOOKUP TABLES
    // ============================================================
    console.log('Creating lookup tables...');

    await client.query(`
      CREATE TABLE IF NOT EXISTS msat.settlements (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        code VARCHAR(20) UNIQUE NOT NULL,
        name VARCHAR(100) NOT NULL,
        sort_order INTEGER,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    console.log('  settlements');

    await client.query(`
      CREATE TABLE IF NOT EXISTS msat.issue_types (
        code VARCHAR(50) PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        sort_order INTEGER,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    console.log('  issue_types');

    await client.query(`
      CREATE TABLE IF NOT EXISTS msat.appeal_statuses (
        code VARCHAR(50) PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        sort_order INTEGER,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    console.log('  appeal_statuses');

    await client.query(`
      CREATE TABLE IF NOT EXISTS msat.appeal_stages (
        code VARCHAR(50) PRIMARY KEY,
        name VARCHAR(200) NOT NULL,
        sort_order INTEGER,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    console.log('  appeal_stages');

    // ============================================================
    // CORE TABLES
    // ============================================================
    console.log('\nCreating core tables...');

    // Organizations
    await client.query(`
      CREATE TABLE IF NOT EXISTS msat.organizations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        legacy_org_id INTEGER UNIQUE,
        name TEXT NOT NULL,
        type VARCHAR(50) DEFAULT 'Other',
        address_1 TEXT,
        address_2 TEXT,
        city VARCHAR(100),
        province VARCHAR(20) DEFAULT 'AB',
        postal_code VARCHAR(20),
        phone VARCHAR(30),
        fax VARCHAR(30),
        toll_free VARCHAR(30),
        email VARCHAR(255),
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    console.log('  organizations');

    // Clients
    await client.query(`
      CREATE TABLE IF NOT EXISTS msat.clients (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        legacy_client_id INTEGER UNIQUE,
        member_id VARCHAR(50),
        title VARCHAR(20),
        first_name VARCHAR(100),
        middle_name VARCHAR(100),
        last_name VARCHAR(100),
        address_1 TEXT,
        address_2 TEXT,
        city VARCHAR(100),
        province VARCHAR(20) DEFAULT 'AB',
        postal_code VARCHAR(20),
        date_of_birth DATE,
        phone_home VARCHAR(30),
        phone_work VARCHAR(30),
        phone_cell VARCHAR(30),
        fax VARCHAR(30),
        email VARCHAR(255),
        settlement VARCHAR(100),
        org_name VARCHAR(200),
        job_title VARCHAR(100),
        department VARCHAR(100),
        notes TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    console.log('  clients');

    // Appeals
    await client.query(`
      CREATE TABLE IF NOT EXISTS msat.appeals (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        file_number VARCHAR(30) UNIQUE NOT NULL,
        contact_date DATE,
        issue_type VARCHAR(100),
        legal_description TEXT,
        mediation_date DATE,
        hearing_date DATE,
        closed_date DATE,
        primary_staff VARCHAR(100),
        secondary_staff VARCHAR(100),
        status VARCHAR(50) DEFAULT 'Active',
        stage VARCHAR(50) DEFAULT '1',
        description TEXT,
        notes TEXT,
        on_hold_start DATE,
        on_hold_end DATE,
        background TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    console.log('  appeals');

    // Orders
    await client.query(`
      CREATE TABLE IF NOT EXISTS msat.orders (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        order_number INTEGER UNIQUE NOT NULL,
        issue_date DATE,
        hearing_date DATE,
        keyword TEXT,
        app_for_leave BOOLEAN DEFAULT FALSE,
        leave_granted BOOLEAN DEFAULT FALSE,
        document_url TEXT,
        is_public BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    console.log('  orders');

    // Order Subjects
    await client.query(`
      CREATE TABLE IF NOT EXISTS msat.order_subjects (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        order_id UUID REFERENCES msat.orders(id) ON DELETE CASCADE,
        order_number INTEGER,
        land BOOLEAN DEFAULT FALSE,
        membership BOOLEAN DEFAULT FALSE,
        compensation BOOLEAN DEFAULT FALSE,
        descent_of_property BOOLEAN DEFAULT FALSE,
        pmt_cancellations BOOLEAN DEFAULT FALSE,
        trespass BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    console.log('  order_subjects');

    // Appeal Parties (junction: appeals <-> clients/orgs)
    await client.query(`
      CREATE TABLE IF NOT EXISTS msat.appeal_parties (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        appeal_id UUID REFERENCES msat.appeals(id) ON DELETE CASCADE,
        client_id UUID REFERENCES msat.clients(id) ON DELETE SET NULL,
        organization_id UUID REFERENCES msat.organizations(id) ON DELETE SET NULL,
        order_id UUID REFERENCES msat.orders(id) ON DELETE SET NULL,
        party_type VARCHAR(50),
        legacy_file_number VARCHAR(30),
        legacy_client_id INTEGER,
        legacy_org_id INTEGER,
        legacy_order_number INTEGER,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    console.log('  appeal_parties');

    // Panel Compositions
    await client.query(`
      CREATE TABLE IF NOT EXISTS msat.panel_compositions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        appeal_id UUID REFERENCES msat.appeals(id) ON DELETE CASCADE,
        legacy_file_number VARCHAR(30),
        panel_chair VARCHAR(100),
        panel_member_2 VARCHAR(100),
        panel_member_3 VARCHAR(100),
        date_assigned DATE,
        mediator VARCHAR(100),
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    console.log('  panel_compositions');

    // Legal (from Access Legal table)
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
    console.log('  legal');

    // Legal Subjects (from Access LegalSubject table)
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
    console.log('  legal_subjects');

    // Documents
    await client.query(`
      CREATE TABLE IF NOT EXISTS msat.documents (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        appeal_id UUID REFERENCES msat.appeals(id) ON DELETE CASCADE,
        file_name TEXT NOT NULL,
        file_type VARCHAR(20),
        file_size INTEGER,
        storage_url TEXT,
        category VARCHAR(50),
        description TEXT,
        uploaded_by UUID,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    console.log('  documents');

    // Hearing Schedule
    await client.query(`
      CREATE TABLE IF NOT EXISTS msat.hearing_schedule (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        appeal_id UUID REFERENCES msat.appeals(id) ON DELETE CASCADE,
        hearing_date DATE NOT NULL,
        hearing_time TIME,
        location TEXT,
        hearing_type VARCHAR(50) DEFAULT 'Oral',
        is_public BOOLEAN DEFAULT TRUE,
        notes TEXT,
        outcome VARCHAR(50),
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    console.log('  hearing_schedule');

    // Correspondence
    await client.query(`
      CREATE TABLE IF NOT EXISTS msat.correspondence (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        appeal_id UUID REFERENCES msat.appeals(id) ON DELETE CASCADE,
        template_type VARCHAR(50),
        recipient TEXT,
        subject TEXT,
        body TEXT,
        sent_date TIMESTAMPTZ,
        sent_by VARCHAR(100),
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    console.log('  correspondence');

    // Messages (secure case messaging)
    await client.query(`
      CREATE TABLE IF NOT EXISTS msat.messages (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        appeal_id UUID REFERENCES msat.appeals(id) ON DELETE CASCADE,
        sender_id UUID,
        recipient_id UUID,
        subject TEXT,
        body TEXT,
        is_read BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    console.log('  messages');

    // ============================================================
    // LAP TABLES
    // ============================================================
    console.log('\nCreating LAP tables...');

    await client.query(`
      CREATE TABLE IF NOT EXISTS msat.lap_applications (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        application_number VARCHAR(50) UNIQUE,
        file_number VARCHAR(50),
        applicant TEXT,
        contact_date DATE,
        amendment BOOLEAN DEFAULT FALSE,
        status VARCHAR(50),
        staff_notes TEXT,
        staff VARCHAR(100),
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    console.log('  lap_applications');

    await client.query(`
      CREATE TABLE IF NOT EXISTS msat.lap_orders (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        order_number VARCHAR(50),
        date_issued DATE,
        application_id UUID REFERENCES msat.lap_applications(id) ON DELETE SET NULL,
        legacy_application_number VARCHAR(50),
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    console.log('  lap_orders');

    await client.query(`
      CREATE TABLE IF NOT EXISTS msat.lap_access_records (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        file_number VARCHAR(50),
        status VARCHAR(50),
        reo VARCHAR(50),
        reo_date DATE,
        co VARCHAR(50),
        co_date DATE,
        purpose TEXT,
        project_type VARCHAR(50),
        wellsite_legal TEXT,
        operator VARCHAR(200),
        settlement VARCHAR(100),
        anniversary_date DATE,
        lands_affected TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    console.log('  lap_access_records');

    // ============================================================
    // SYSTEM TABLES
    // ============================================================
    console.log('\nCreating system tables...');

    // Users
    await client.query(`
      CREATE TABLE IF NOT EXISTS msat.users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash TEXT,
        first_name VARCHAR(100),
        last_name VARCHAR(100),
        role VARCHAR(20) DEFAULT 'user' CHECK (role IN ('superadmin', 'admin', 'staff', 'board_member', 'user')),
        provider VARCHAR(20) DEFAULT 'local' CHECK (provider IN ('local', 'microsoft', 'google')),
        provider_id TEXT,
        is_active BOOLEAN DEFAULT TRUE,
        last_login TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    console.log('  users');

    // Notifications
    await client.query(`
      CREATE TABLE IF NOT EXISTS msat.notifications (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES msat.users(id) ON DELETE CASCADE,
        title TEXT NOT NULL,
        message TEXT,
        type VARCHAR(50) DEFAULT 'info',
        is_read BOOLEAN DEFAULT FALSE,
        link TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    console.log('  notifications');

    // Audit Log
    await client.query(`
      CREATE TABLE IF NOT EXISTS msat.audit_log (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID,
        action VARCHAR(50) NOT NULL,
        entity_type VARCHAR(50),
        entity_id UUID,
        details JSONB,
        ip_address VARCHAR(45),
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    console.log('  audit_log');

    // Import History
    await client.query(`
      CREATE TABLE IF NOT EXISTS msat.import_history (
        id SERIAL PRIMARY KEY,
        import_date TIMESTAMPTZ DEFAULT NOW(),
        file_name TEXT NOT NULL,
        table_name TEXT NOT NULL,
        records_imported INTEGER DEFAULT 0,
        records_failed INTEGER DEFAULT 0,
        status VARCHAR(20) DEFAULT 'Success',
        error_message TEXT,
        imported_by VARCHAR(100) DEFAULT 'migration_script'
      );
    `);
    console.log('  import_history');

    // ============================================================
    // INDEXES
    // ============================================================
    console.log('\nCreating indexes...');

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_appeals_status ON msat.appeals(status);
      CREATE INDEX IF NOT EXISTS idx_appeals_stage ON msat.appeals(stage);
      CREATE INDEX IF NOT EXISTS idx_appeals_file_number ON msat.appeals(file_number);
      CREATE INDEX IF NOT EXISTS idx_appeals_issue_type ON msat.appeals(issue_type);
      CREATE INDEX IF NOT EXISTS idx_appeals_contact_date ON msat.appeals(contact_date);
      CREATE INDEX IF NOT EXISTS idx_appeals_primary_staff ON msat.appeals(primary_staff);

      CREATE INDEX IF NOT EXISTS idx_clients_last_name ON msat.clients(last_name);
      CREATE INDEX IF NOT EXISTS idx_clients_settlement ON msat.clients(settlement);
      CREATE INDEX IF NOT EXISTS idx_clients_legacy_id ON msat.clients(legacy_client_id);

      CREATE INDEX IF NOT EXISTS idx_orders_order_number ON msat.orders(order_number);
      CREATE INDEX IF NOT EXISTS idx_orders_issue_date ON msat.orders(issue_date);

      CREATE INDEX IF NOT EXISTS idx_appeal_parties_appeal ON msat.appeal_parties(appeal_id);
      CREATE INDEX IF NOT EXISTS idx_appeal_parties_client ON msat.appeal_parties(client_id);

      CREATE INDEX IF NOT EXISTS idx_panel_appeal ON msat.panel_compositions(appeal_id);

      CREATE INDEX IF NOT EXISTS idx_legal_appeal ON msat.legal(appeal_id);
      CREATE INDEX IF NOT EXISTS idx_legal_file_number ON msat.legal(legacy_file_number);
      CREATE INDEX IF NOT EXISTS idx_legal_subjects_legal ON msat.legal_subjects(legal_id);

      CREATE INDEX IF NOT EXISTS idx_documents_appeal ON msat.documents(appeal_id);
      CREATE INDEX IF NOT EXISTS idx_hearing_schedule_date ON msat.hearing_schedule(hearing_date);
      CREATE INDEX IF NOT EXISTS idx_correspondence_appeal ON msat.correspondence(appeal_id);

      CREATE INDEX IF NOT EXISTS idx_lap_apps_number ON msat.lap_applications(application_number);
      CREATE INDEX IF NOT EXISTS idx_lap_apps_status ON msat.lap_applications(status);
      CREATE INDEX IF NOT EXISTS idx_lap_access_settlement ON msat.lap_access_records(settlement);
      CREATE INDEX IF NOT EXISTS idx_lap_access_operator ON msat.lap_access_records(operator);

      CREATE INDEX IF NOT EXISTS idx_users_email ON msat.users(email);
      CREATE INDEX IF NOT EXISTS idx_users_role ON msat.users(role);
      CREATE INDEX IF NOT EXISTS idx_audit_log_user ON msat.audit_log(user_id);
      CREATE INDEX IF NOT EXISTS idx_audit_log_action ON msat.audit_log(action);
      CREATE INDEX IF NOT EXISTS idx_audit_log_date ON msat.audit_log(created_at);
      CREATE INDEX IF NOT EXISTS idx_notifications_user ON msat.notifications(user_id);
    `);
    console.log('  All indexes created');

    console.log('\n' + '='.repeat(70));
    console.log('Migration completed successfully!');

  } catch (error) {
    console.error('Migration error:', error.message);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

migrate().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
