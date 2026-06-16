import pool from './db.js';

const JOURS = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];
const JOUR_ORDER = Object.fromEntries(JOURS.map((j, i) => [j, i]));
const CRENEAU_COLS = 'id, semaine_id, jour, slot_label, heure_debut, heure_fin, poste_id, nb_postes, notes, point_de_vente_id';

export { JOURS };

function normalizeTime(t) {
  return t ? t.slice(0, 5) : t;
}

export async function findCreneauxBySemaine(semaineId, siteId = null) {
  const { rows } = await pool.query(
    `SELECT c.id, c.semaine_id, c.jour, c.slot_label, c.heure_debut, c.heure_fin,
            c.poste_id, c.nb_postes, c.notes, c.point_de_vente_id,
            p.libelle AS poste_libelle,
            pdv.nom AS pdv_nom
     FROM creneaux c
     JOIN semaines s ON s.id = c.semaine_id
     LEFT JOIN postes p ON p.id = c.poste_id AND p.site_id = s.site_id
     LEFT JOIN points_de_vente pdv ON pdv.id = c.point_de_vente_id AND pdv.site_id = s.site_id
     WHERE c.semaine_id = $1
       AND ($2::uuid IS NULL OR s.site_id = $2)`,
    [semaineId, siteId ?? null]
  );
  return rows
    .map(r => ({ ...r, heure_debut: normalizeTime(r.heure_debut), heure_fin: normalizeTime(r.heure_fin) }))
    .sort((a, b) =>
      (JOUR_ORDER[a.jour] ?? 9) - (JOUR_ORDER[b.jour] ?? 9) ||
      a.heure_debut.localeCompare(b.heure_debut)
    );
}

export async function createCreneau({ semaineId, jour, slotLabel, heureDebut, heureFin, posteId, nbPostes = 1, notes = null, pointDeVenteId = null }) {
  const { rows } = await pool.query(
    `WITH ins AS (
       INSERT INTO creneaux (semaine_id, jour, slot_label, heure_debut, heure_fin, poste_id, nb_postes, notes, point_de_vente_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *
     )
     SELECT ins.id, ins.semaine_id, ins.jour, ins.slot_label, ins.heure_debut, ins.heure_fin,
            ins.poste_id, ins.nb_postes, ins.notes, ins.point_de_vente_id,
            p.libelle AS poste_libelle,
            pdv.nom   AS pdv_nom
     FROM ins
     JOIN semaines s ON s.id = ins.semaine_id
     LEFT JOIN postes p   ON p.id  = ins.poste_id          AND p.site_id   = s.site_id
     LEFT JOIN points_de_vente pdv ON pdv.id = ins.point_de_vente_id AND pdv.site_id = s.site_id`,
    [semaineId, jour, slotLabel, heureDebut, heureFin, posteId ?? null, nbPostes, notes ?? null, pointDeVenteId ?? null]
  );
  return rows[0] ? { ...rows[0], heure_debut: normalizeTime(rows[0].heure_debut), heure_fin: normalizeTime(rows[0].heure_fin) } : null;
}

export async function updateCreneau(creneauId, semaineId, { slotLabel, heureDebut, heureFin, posteId, nbPostes, notes, pointDeVenteId }) {
  const { rows } = await pool.query(
    `WITH upd AS (
       UPDATE creneaux
       SET slot_label = $1, heure_debut = $2, heure_fin = $3, poste_id = $4, nb_postes = $5, notes = $6, point_de_vente_id = $7
       WHERE id = $8 AND semaine_id = $9
       RETURNING *
     )
     SELECT upd.id, upd.semaine_id, upd.jour, upd.slot_label, upd.heure_debut, upd.heure_fin,
            upd.poste_id, upd.nb_postes, upd.notes, upd.point_de_vente_id,
            p.libelle AS poste_libelle,
            pdv.nom   AS pdv_nom
     FROM upd
     JOIN semaines s ON s.id = upd.semaine_id
     LEFT JOIN postes p   ON p.id  = upd.poste_id          AND p.site_id   = s.site_id
     LEFT JOIN points_de_vente pdv ON pdv.id = upd.point_de_vente_id AND pdv.site_id = s.site_id`,
    [slotLabel, heureDebut, heureFin, posteId ?? null, nbPostes, notes ?? null, pointDeVenteId ?? null, creneauId, semaineId]
  );
  return rows[0] ? { ...rows[0], heure_debut: normalizeTime(rows[0].heure_debut), heure_fin: normalizeTime(rows[0].heure_fin) } : null;
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
