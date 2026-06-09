import pool from './db.js';

const SITE_COLS = 'id, nom, siret, created_at';

export async function findSiteById(siteId) {
  const { rows } = await pool.query(
    `SELECT ${SITE_COLS} FROM sites WHERE id = $1`,
    [siteId]
  );
  return rows[0] ?? null;
}

export async function findAllSites() {
  const { rows } = await pool.query(`SELECT ${SITE_COLS} FROM sites ORDER BY nom`);
  return rows;
}

export async function createSite(nom, siret) {
  const { rows } = await pool.query(
    `INSERT INTO sites (nom, siret) VALUES ($1, $2) RETURNING ${SITE_COLS}`,
    [nom.trim(), siret.trim()]
  );
  return rows[0];
}
