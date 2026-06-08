import pool from './db.js';

const SEMAINE_COLUMNS = 'id, site_id, iso_week, created_at';

/**
 * @param {string} siteId
 * @param {string} isoWeek  e.g. '2026-W24'
 */
export async function findOrCreateSemaine(siteId, isoWeek) {
  const { rows } = await pool.query(
    `INSERT INTO semaines (site_id, iso_week)
     VALUES ($1, $2)
     ON CONFLICT (site_id, iso_week) DO UPDATE SET iso_week = EXCLUDED.iso_week
     RETURNING ${SEMAINE_COLUMNS}`,
    [siteId, isoWeek]
  );
  return rows[0];
}

/**
 * @param {string} siteId
 */
export async function findSemaineBySite(siteId) {
  const { rows } = await pool.query(
    `SELECT ${SEMAINE_COLUMNS} FROM semaines WHERE site_id = $1 ORDER BY iso_week DESC`,
    [siteId]
  );
  return rows;
}
