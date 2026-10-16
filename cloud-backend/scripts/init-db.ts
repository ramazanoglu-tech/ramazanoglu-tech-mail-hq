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
  if (!dbUrl) {
    console.error('[ERROR] DATABASE_URL environment variable is required to run migrations.');
    process.exit(1);
  }

  console.log('[MIGRATION] Connecting to PostgreSQL database...');
  const pool = new Pool({
    connectionString: dbUrl,
    ssl: dbUrl.includes('localhost') ? false : { rejectUnauthorized: false },
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
