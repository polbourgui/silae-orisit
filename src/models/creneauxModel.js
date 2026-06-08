import pool from './db.js';

const CRENEAU_COLS = 'id, semaine_id, slot_label, heure_debut, heure_fin, poste_id';

export async function findCreneauxBySemaine(semaineId) {
  const { rows } = await pool.query(
    `SELECT ${CRENEAU_COLS} FROM creneaux WHERE semaine_id = $1 ORDER BY heure_debut`,
    [semaineId]
  );
  return rows;
}

export async function createCreneau({ semaineId, slotLabel, heureDebut, heureFin, posteId }) {
  const { rows } = await pool.query(
    `INSERT INTO creneaux (semaine_id, slot_label, heure_debut, heure_fin, poste_id)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING ${CRENEAU_COLS}`,
    [semaineId, slotLabel, heureDebut, heureFin, posteId ?? null]
  );
  return rows[0];
}

export async function createCreneauxBatch(semaineId, creneaux) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const inserted = [];
    for (const c of creneaux) {
      const { rows } = await client.query(
        `INSERT INTO creneaux (semaine_id, slot_label, heure_debut, heure_fin, poste_id)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING ${CRENEAU_COLS}`,
        [semaineId, c.slot_label, c.heure_debut, c.heure_fin, c.poste_id ?? null]
      );
      inserted.push(rows[0]);
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

export async function deleteCreneau(creneauId, semaineId) {
  const { rowCount } = await pool.query(
    'DELETE FROM creneaux WHERE id = $1 AND semaine_id = $2',
    [creneauId, semaineId]
  );
  return rowCount > 0;
}
