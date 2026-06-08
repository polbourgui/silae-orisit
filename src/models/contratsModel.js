import pool from './db.js';

const CONTRAT_COLS = `id, planning_id, extra_id, creneau_id, site_id,
  silae_status, silae_payload, silae_response, silae_called_at, has_signed, created_at`;

export async function createContrat(data, siteId) {
  const { planningId, extraId, creneauId } = data;
  const { rows } = await pool.query(
    `INSERT INTO contrats (planning_id, extra_id, creneau_id, site_id, silae_status)
     VALUES ($1, $2, $3, $4, 'draft')
     RETURNING ${CONTRAT_COLS}`,
    [planningId, extraId, creneauId, siteId]
  );
  return rows[0];
}

export async function findContratById(contratId, siteId) {
  const { rows } = await pool.query(
    `SELECT ${CONTRAT_COLS} FROM contrats WHERE id = $1 AND site_id = $2`,
    [contratId, siteId]
  );
  return rows[0] ?? null;
}

export async function findContratsByPlanning(planningId, siteId) {
  const { rows } = await pool.query(
    `SELECT ${CONTRAT_COLS} FROM contrats WHERE planning_id = $1 AND site_id = $2`,
    [planningId, siteId]
  );
  return rows;
}

export async function updateContratStatus(contratId, status, siteId) {
  const { rows } = await pool.query(
    `UPDATE contrats SET silae_status = $1 WHERE id = $2 AND site_id = $3 RETURNING ${CONTRAT_COLS}`,
    [status, contratId, siteId]
  );
  return rows[0] ?? null;
}

export async function findContratsByExtra(extraId, siteId) {
  const { rows } = await pool.query(
    `SELECT ${CONTRAT_COLS} FROM contrats WHERE extra_id = $1 AND site_id = $2 ORDER BY created_at DESC`,
    [extraId, siteId]
  );
  return rows;
}
