import pg from 'pg';
import 'dotenv/config';

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,
  connectionTimeoutMillis: 5000,
  idleTimeoutMillis: 30000,
  statement_timeout: 15000,
  ...(process.env.PGSSL === 'true' ? { ssl: { rejectUnauthorized: false } } : {}),
});

pool.on('error', (err) => {
  process.stderr.write(`Unexpected pg pool error: ${err.message}\n`);
  // Ne pas quitter sur les erreurs transitoires (connexion perdue momentanément)
  if (err.code === 'ECONNRESET' || err.code === 'ETIMEDOUT' || err.code === 'ECONNREFUSED') return;
  process.exit(1);
});

export default pool;
