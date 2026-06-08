import pool from './db.js';

const PLANNING_COLS = 'id, semaine_id, site_id, published_at, created_at';
const AFFECTATION_COLS = 'id, planning_id, extra_id, creneau_id, site_id, created_at';

export async function findPlanningBySemaine(semaineId, siteId) {
  const { rows } = await pool.query(
    `SELECT ${PLANNING_COLS} FROM plannings WHERE semaine_id = $1 AND site_id = $2`,
    [semaineId, siteId]
  );
  return rows[0] ?? null;
}

export async function createPlanning(semaineId, siteId) {
  const { rows } = await pool.query(
    `INSERT INTO plannings (semaine_id, site_id) VALUES ($1, $2) RETURNING ${PLANNING_COLS}`,
    [semaineId, siteId]
  );
  return rows[0];
}

export async function publishPlanning(planningId, siteId) {
  const { rows } = await pool.query(
    `UPDATE plannings SET published_at = NOW()
     WHERE id = $1 AND site_id = $2
     RETURNING ${PLANNING_COLS}`,
    [planningId, siteId]
  );
  return rows[0] ?? null;
}

export async function findAffectations(planningId, siteId) {
  const { rows } = await pool.query(
    `SELECT ${AFFECTATION_COLS} FROM affectations WHERE planning_id = $1 AND site_id = $2`,
    [planningId, siteId]
  );
  return rows;
}

export async function createAffectation(planningId, extraId, creneauId, siteId) {
  const { rows } = await pool.query(
    `INSERT INTO affectations (planning_id, extra_id, creneau_id, site_id)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (extra_id, creneau_id) DO NOTHING
     RETURNING ${AFFECTATION_COLS}`,
    [planningId, extraId, creneauId, siteId]
  );
  return rows[0] ?? null;
}

export async function addAffectation(planningId, creneauId, extraId, siteId) {
  const { rows } = await pool.query(
    `INSERT INTO affectations (planning_id, extra_id, creneau_id, site_id)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (extra_id, creneau_id) DO NOTHING
     RETURNING ${AFFECTATION_COLS}`,
    [planningId, extraId, creneauId, siteId]
  );
  return rows[0] ?? null;
}

export async function removeAffectationByExtra(planningId, creneauId, extraId, siteId) {
  await pool.query(
    'DELETE FROM affectations WHERE planning_id = $1 AND creneau_id = $2 AND extra_id = $3 AND site_id = $4',
    [planningId, creneauId, extraId, siteId]
  );
}

export async function clearAffectations(planningId, siteId) {
  await pool.query(
    'DELETE FROM affectations WHERE planning_id = $1 AND site_id = $2',
    [planningId, siteId]
  );
}
