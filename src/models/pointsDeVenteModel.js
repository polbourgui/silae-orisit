import pool from './db.js';

const PDV_COLS = 'id, site_id, nom, sort_order, created_at';

export async function findPointsDeVenteBySite(siteId) {
  const { rows } = await pool.query(
    `SELECT ${PDV_COLS} FROM points_de_vente WHERE site_id = $1 ORDER BY sort_order, nom`,
    [siteId]
  );
  return rows;
}

export async function createPointDeVente(siteId, nom) {
  const { rows } = await pool.query(
    `INSERT INTO points_de_vente (site_id, nom)
     VALUES ($1, $2)
     RETURNING ${PDV_COLS}`,
    [siteId, nom.trim()]
  );
  return rows[0];
}

export async function updatePointDeVente(id, siteId, nom) {
  const { rows } = await pool.query(
    `UPDATE points_de_vente SET nom = $1 WHERE id = $2 AND site_id = $3 RETURNING ${PDV_COLS}`,
    [nom.trim(), id, siteId]
  );
  return rows[0] ?? null;
}

export async function deletePointDeVente(id, siteId) {
  const { rowCount } = await pool.query(
    'DELETE FROM points_de_vente WHERE id = $1 AND site_id = $2',
    [id, siteId]
  );
  return rowCount > 0;
}
