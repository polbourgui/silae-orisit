import pool from './db.js';

const JOURS = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];
const JOUR_ORDER = Object.fromEntries(JOURS.map((j, i) => [j, i]));
const CRENEAU_COLS = 'id, semaine_id, jour, slot_label, heure_debut, heure_fin, poste_id, nb_postes';

export { JOURS };

function normalizeTime(t) {
  return t ? t.slice(0, 5) : t;
}

export async function findCreneauxBySemaine(semaineId) {
  const { rows } = await pool.query(
    `SELECT c.id, c.semaine_id, c.jour, c.slot_label, c.heure_debut, c.heure_fin,
            c.poste_id, c.nb_postes, p.libelle AS poste_libelle
     FROM creneaux c
     LEFT JOIN postes p ON p.id = c.poste_id
     WHERE c.semaine_id = $1`,
    [semaineId]
  );
  return rows
    .map(r => ({ ...r, heure_debut: normalizeTime(r.heure_debut), heure_fin: normalizeTime(r.heure_fin) }))
    .sort((a, b) =>
      (JOUR_ORDER[a.jour] ?? 9) - (JOUR_ORDER[b.jour] ?? 9) ||
      a.heure_debut.localeCompare(b.heure_debut)
    );
}

export async function createCreneau({ semaineId, jour, slotLabel, heureDebut, heureFin, posteId, nbPostes = 1 }) {
  const { rows } = await pool.query(
    `INSERT INTO creneaux (semaine_id, jour, slot_label, heure_debut, heure_fin, poste_id, nb_postes)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING ${CRENEAU_COLS}`,
    [semaineId, jour, slotLabel, heureDebut, heureFin, posteId ?? null, nbPostes]
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
        `INSERT INTO creneaux (semaine_id, jour, slot_label, heure_debut, heure_fin, poste_id, nb_postes)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING ${CRENEAU_COLS}`,
        [semaineId, c.jour ?? 'lundi', c.slot_label, c.heure_debut, c.heure_fin, c.poste_id ?? null, c.nb_postes ?? 1]
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
