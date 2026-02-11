import dotenv from 'dotenv';
import pg from 'pg';
import bcrypt from 'bcryptjs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env') });

const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function seedUsers() {
  const client = await pool.connect();

  try {
    console.log('Seeding Test Users - MSAT');
    console.log('='.repeat(70));

    const users = [
      {
        email: 'admin@msat.gov.ab.ca',
        password: 'admin123',
        first_name: 'Sarah',
        last_name: 'Thompson',
        role: 'admin'
      },
      {
        email: 'staff@msat.gov.ab.ca',
        password: 'staff123',
        first_name: 'BJ',
        last_name: 'Simpson',
        role: 'staff'
      },
      {
        email: 'board@msat.gov.ab.ca',
        password: 'board123',
        first_name: 'Robert',
        last_name: 'Daniels',
        role: 'board_member'
      },
      {
        email: 'user@example.com',
        password: 'user123',
        first_name: 'Patrick',
        last_name: 'Glynn',
        role: 'user'
      }
    ];

    for (const u of users) {
      const hash = await bcrypt.hash(u.password, 10);
      const res = await client.query(`
        INSERT INTO msat.users (email, password_hash, first_name, last_name, role, provider, is_active)
        VALUES ($1, $2, $3, $4, $5, 'local', true)
        ON CONFLICT (email) DO UPDATE SET
          password_hash = EXCLUDED.password_hash,
          first_name = EXCLUDED.first_name,
          last_name = EXCLUDED.last_name,
          role = EXCLUDED.role,
          updated_at = NOW()
        RETURNING id, email, role
      `, [u.email, hash, u.first_name, u.last_name, u.role]);
      console.log(`  ${res.rows[0].role.padEnd(15)} ${res.rows[0].email}`);
    }

    // Verify
    const count = await client.query('SELECT COUNT(*) as cnt FROM msat.users');
    console.log(`\nTotal users: ${count.rows[0].cnt}`);

    console.log('\n' + '='.repeat(70));
    console.log('Users seeded successfully!');
    console.log('\nTest credentials:');
    console.log('  admin@msat.gov.ab.ca / admin123  (Admin)');
    console.log('  staff@msat.gov.ab.ca / staff123  (Staff)');
    console.log('  board@msat.gov.ab.ca / board123  (Board Member)');
    console.log('  user@example.com     / user123   (User)');

  } catch (error) {
    console.error('Error:', error.message);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

seedUsers().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
