import pool from './db.js';

const DISPO_COLS = 'id, extra_id, semaine_id, site_id, creneau_id, created_at';

/**
 * Saves disponibilites for an extra for a given semaine (replaces previous ones).
 * @param {string} extraId
 * @param {string} semaineId
 * @param {string} siteId
 * @param {string[]} creneauxIds
 */
export async function saveDisponibilites(extraId, semaineId, siteId, creneauxIds) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      'DELETE FROM disponibilites WHERE extra_id = $1 AND semaine_id = $2 AND site_id = $3',
      [extraId, semaineId, siteId]
    );
    const inserted = [];
    for (const creneauId of creneauxIds) {
      const { rows } = await client.query(
        `INSERT INTO disponibilites (extra_id, semaine_id, site_id, creneau_id)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (extra_id, creneau_id) DO NOTHING
         RETURNING ${DISPO_COLS}`,
        [extraId, semaineId, siteId, creneauId]
      );
      if (rows[0]) inserted.push(rows[0]);
    }
    await client.query('COMMIT');
    return inserted;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function findDisponibilites(semaineId, siteId) {
  const { rows } = await pool.query(
    `SELECT ${DISPO_COLS} FROM disponibilites WHERE semaine_id = $1 AND site_id = $2`,
    [semaineId, siteId]
  );
  return rows;
}

export async function findDisponibilitesExtra(extraId, semaineId, siteId) {
  const { rows } = await pool.query(
    `SELECT ${DISPO_COLS} FROM disponibilites
     WHERE extra_id = $1 AND semaine_id = $2 AND site_id = $3`,
    [extraId, semaineId, siteId]
  );
  return rows;
}
