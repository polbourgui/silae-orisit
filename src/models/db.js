import pg from 'pg';
import 'dotenv/config';

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

pool.on('error', (err) => {
  process.stderr.write(`Unexpected pg pool error: ${err.message}\n`);
  process.exit(1);
});

export default pool;
