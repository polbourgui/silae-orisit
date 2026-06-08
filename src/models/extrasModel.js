import pool from './db.js';

const EXTRA_COLUMNS = 'id, site_id, matricule_silae, nom, prenom, email, telephone, token_version, created_at';

/**
 * @param {string} extraId
 * @param {string} siteId
 */
export async function findExtraById(extraId, siteId) {
  const { rows } = await pool.query(
    `SELECT ${EXTRA_COLUMNS} FROM extras WHERE id = $1 AND site_id = $2`,
    [extraId, siteId]
  );
  return rows[0] ?? null;
}

/**
 * @param {string} siteId
 */
export async function findExtrasBySite(siteId) {
  const { rows } = await pool.query(
    `SELECT ${EXTRA_COLUMNS} FROM extras WHERE site_id = $1 ORDER BY nom, prenom`,
    [siteId]
  );
  return rows;
}

/**
 * @param {string} siteId
 * @param {{ matricule_silae: string, nom: string, prenom: string, email: string, telephone: string }} silaeData
 */
export async function upsertExtra(siteId, silaeData) {
  const { matricule_silae, nom, prenom, email, telephone } = silaeData;
  const { rows } = await pool.query(
    `INSERT INTO extras (site_id, matricule_silae, nom, prenom, email, telephone)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (site_id, matricule_silae)
     DO UPDATE SET nom = EXCLUDED.nom, prenom = EXCLUDED.prenom,
       email = EXCLUDED.email, telephone = EXCLUDED.telephone
     RETURNING ${EXTRA_COLUMNS}`,
    [siteId, matricule_silae, nom, prenom, email, telephone]
  );
  return rows[0];
}

/**
 * Increments token_version to invalidate all previous magic links
 * @param {string} extraId
 */
export async function updateTokenVersion(extraId) {
  const { rows } = await pool.query(
    `UPDATE extras SET token_version = token_version + 1
     WHERE id = $1
     RETURNING id, token_version`,
    [extraId]
  );
  return rows[0];
}
