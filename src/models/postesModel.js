import pool from './db.js';

const POSTE_COLS = 'id, site_id, libelle, code_emploi, created_at';

export async function findPostesBySite(siteId) {
  const { rows } = await pool.query(
    `SELECT ${POSTE_COLS} FROM postes WHERE site_id = $1 ORDER BY libelle`,
    [siteId]
  );
  return rows;
}

export async function createPoste(siteId, libelle, codeEmploi) {
  const { rows } = await pool.query(
    `INSERT INTO postes (site_id, libelle, code_emploi)
     VALUES ($1, $2, $3)
     RETURNING ${POSTE_COLS}`,
    [siteId, libelle.trim(), codeEmploi?.trim() || null]
  );
  return rows[0];
}

export async function deletePoste(posteId, siteId) {
  const { rowCount } = await pool.query(
    'DELETE FROM postes WHERE id = $1 AND site_id = $2',
    [posteId, siteId]
  );
  return rowCount > 0;
}

export async function findPostesByExtra(extraId, siteId) {
  const { rows } = await pool.query(
    `SELECT p.id, p.libelle, p.code_emploi
     FROM postes p
     JOIN extras_postes ep ON ep.poste_id = p.id
     WHERE ep.extra_id = $1 AND ep.site_id = $2`,
    [extraId, siteId]
  );
  return rows;
}

export async function setPostesForExtra(extraId, siteId, posteIds) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      'DELETE FROM extras_postes WHERE extra_id = $1 AND site_id = $2',
      [extraId, siteId]
    );
    for (const posteId of posteIds) {
      await client.query(
        'INSERT INTO extras_postes (extra_id, poste_id, site_id) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING',
        [extraId, posteId, siteId]
      );
    }
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// Retourne { extraId → Set<posteId> } pour une liste d'extras
export async function getPostesByExtras(extraIds, siteId) {
  if (!extraIds.length) return {};
  const { rows } = await pool.query(
    `SELECT extra_id, poste_id FROM extras_postes WHERE extra_id = ANY($1) AND site_id = $2`,
    [extraIds, siteId]
  );
  const map = {};
  for (const r of rows) {
    if (!map[r.extra_id]) map[r.extra_id] = [];
    map[r.extra_id].push(r.poste_id);
  }
  return map;
}
