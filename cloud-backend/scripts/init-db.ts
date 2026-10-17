// =============================================================================
// RAMAZANOĞLU TECH MAIL HQ - DATABASE SCHEMA MIGRATOR SCRIPT
// =============================================================================

import fs from 'fs';
import path from 'path';
import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

async function runMigration() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl || dbUrl.includes('kullanici:sifre@host')) {
    console.log('[MIGRATION INFO] DATABASE_URL is not configured with a live PostgreSQL instance.');
    console.log('[MIGRATION INFO] Ramazanoğlu Tech Mail HQ operates in In-Memory Resilient Mode with all 54 corporate aliases pre-loaded.');
    console.log('[MIGRATION INFO] To connect a live cloud database, create a free PostgreSQL instance on Neon.tech or Supabase.com and paste the connection string into .env.');
    return;
  }

  console.log('[MIGRATION] Connecting to PostgreSQL database...');
  const pool = new Pool({
    connectionString: dbUrl,
    ssl: dbUrl.includes('localhost') ? false : { rejectUnauthorized: true },
  });

  try {
    const schemaSqlPath = path.resolve(__dirname, '../schema.sql');
    const sql = fs.readFileSync(schemaSqlPath, 'utf8');

    console.log('[MIGRATION] Executing schema.sql...');
    await pool.query(sql);
    console.log('[MIGRATION] Schema migration and seed data executed successfully!');
  } catch (err) {
    console.error('[MIGRATION ERROR]:', err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runMigration();
