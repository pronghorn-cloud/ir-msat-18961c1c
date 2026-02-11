import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env') });

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

const res = await pool.query(`
  SELECT table_name
  FROM information_schema.tables
  WHERE table_schema = 'msat'
  ORDER BY table_name ASC
`);

console.log('');
console.log('TABLE NAME                     RECORDS');
console.log('─'.repeat(45));

let total = 0;
for (const row of res.rows) {
  const cnt = await pool.query(`SELECT COUNT(*) as c FROM msat.${row.table_name}`);
  const count = parseInt(cnt.rows[0].c);
  total += count;
  console.log(`${row.table_name.padEnd(31)} ${String(count).padStart(7)}`);
}

console.log('─'.repeat(45));
console.log(`${'TOTAL'.padEnd(31)} ${String(total).padStart(7)}`);
console.log(`\n${res.rows.length} tables in msat schema`);

await pool.end();
