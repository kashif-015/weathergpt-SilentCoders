import fs from 'fs';
import path from 'path';
import pg from 'pg';
const { Client } = pg;

import 'dotenv/config';

const migrationPath = path.resolve('supabase/migrations/20261010000000_create_conversations_and_messages.sql');
const sql = fs.readFileSync(migrationPath, 'utf8');

const client = new Client({
  host: process.env.SUPABASE_DB_HOST || 'aws-0-ap-south-1.pooler.supabase.com',
  port: Number(process.env.SUPABASE_DB_PORT) || 6543,
  database: process.env.SUPABASE_DB_NAME || 'postgres',
  user: process.env.SUPABASE_DB_USER || 'postgres.iujimmoonhfgooryhgvd',
  password: process.env.SUPABASE_DB_PASSWORD || '',
  ssl: { rejectUnauthorized: false }
});

async function run() {
  console.log('Connecting to Supabase PostgreSQL...');
  await client.connect();
  console.log('Connected. Running migration...');
  await client.query(sql);
  console.log('Migration executed successfully!');

  // Verify created tables
  const res = await client.query(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    ORDER BY table_name;
  `);
  console.log('Public tables now:', res.rows.map(r => r.table_name));

  await client.end();
}

run().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
