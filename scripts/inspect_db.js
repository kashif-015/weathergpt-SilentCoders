import pg from 'pg';
const { Client } = pg;

import 'dotenv/config';

const client = new Client({
  host: process.env.SUPABASE_DB_HOST || 'aws-0-ap-south-1.pooler.supabase.com',
  port: Number(process.env.SUPABASE_DB_PORT) || 6543,
  database: process.env.SUPABASE_DB_NAME || 'postgres',
  user: process.env.SUPABASE_DB_USER || 'postgres.iujimmoonhfgooryhgvd',
  password: process.env.SUPABASE_DB_PASSWORD || '',
  ssl: { rejectUnauthorized: false }
});

async function main() {
  await client.connect();
  console.log('Connected to Supabase PostgreSQL!');

  const tables = await client.query(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    ORDER BY table_name;
  `);
  console.log('Public tables:', tables.rows.map(r => r.table_name));

  const policies = await client.query(`
    SELECT tablename, policyname, cmd, roles 
    FROM pg_policies 
    WHERE schemaname = 'public'
    ORDER BY tablename, policyname;
  `);
  console.log('Active RLS Policies:', policies.rows);

  await client.end();
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
