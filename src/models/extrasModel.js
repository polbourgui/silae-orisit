import pool from './db.js';

export async function findExtraById(extraId, siteId) {
  const { rows } = await pool.query(`
    SELECT e.id, e.nom, e.prenom, e.email, e.telephone, e.token_version, e.created_at,
           se.matricule_silae, se.is_blocked
    FROM extras e
    JOIN site_extras se ON se.extra_id = e.id AND se.site_id = $2
    WHERE e.id = $1
  `, [extraId, siteId]);
  return rows[0] ?? null;
}

export async function findExtrasBySite(siteId) {
  const { rows } = await pool.query(`
    SELECT e.id, e.nom, e.prenom, e.email, e.telephone, e.token_version, e.created_at,
           se.matricule_silae, se.is_blocked,
           COALESCE(array_agg(ep.poste_id) FILTER (WHERE ep.poste_id IS NOT NULL), '{}') AS poste_ids
    FROM extras e
    JOIN site_extras se ON se.extra_id = e.id AND se.site_id = $1
    LEFT JOIN extras_postes ep ON ep.extra_id = e.id AND ep.site_id = $1
    GROUP BY e.id, e.nom, e.prenom, e.email, e.telephone, e.token_version, e.created_at,
             se.matricule_silae, se.is_blocked
    ORDER BY e.nom, e.prenom
  `, [siteId]);
  return rows;
}

/**
 * Upsert un extra depuis Silae.
 * Déduplication par email : si un extra avec cet email existe déjà (même sur un autre site),
 * on réutilise le même enregistrement extras et on ajoute/met à jour sa ligne site_extras.
 * Matricule Silae = propre à chaque dossier (site).
 */
export async function upsertExtra(siteId, silaeData) {
  const { matricule_silae, nom, prenom, email, telephone } = silaeData;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Trouver ou créer l'entité globale par email
    let extraId;
    if (email) {
      const { rows } = await client.query(
        'SELECT id FROM extras WHERE email = $1',
        [email]
      );
      if (rows[0]) {
        extraId = rows[0].id;
        await client.query(
          'UPDATE extras SET nom=$1, prenom=$2, telephone=$3 WHERE id=$4',
          [nom, prenom, telephone, extraId]
        );
      }
    }
    if (!extraId) {
      const { rows } = await client.query(
        'INSERT INTO extras (nom, prenom, email, telephone) VALUES ($1,$2,$3,$4) RETURNING id',
        [nom, prenom, email, telephone]
      );
      extraId = rows[0].id;
    }

    // Liaison site ↔ extra avec le matricule propre à ce dossier Silae
    await client.query(`
      INSERT INTO site_extras (site_id, extra_id, matricule_silae)
      VALUES ($1, $2, $3)
      ON CONFLICT (site_id, extra_id) DO UPDATE SET matricule_silae = EXCLUDED.matricule_silae
    `, [siteId, extraId, matricule_silae]);

    await client.query('COMMIT');
    return findExtraById(extraId, siteId);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function updateTokenVersion(extraId) {
  const { rows } = await pool.query(
    `UPDATE extras SET token_version = token_version + 1
     WHERE id = $1
     RETURNING id, token_version`,
    [extraId]
  );
  return rows[0];
}

/**
 * Retourne tous les créneaux auxquels un extra est affecté sur TOUS les sites
 * pour une semaine donnée. Utilisé pour la détection de conflits cross-site.
 */
export async function findExtraAssignmentsAllSites(extraId, isoWeek) {
  const { rows } = await pool.query(`
    SELECT c.id, c.jour, c.heure_debut, c.heure_fin, s.nom AS site_nom
    FROM affectations a
    JOIN creneaux c ON c.id = a.creneau_id
    JOIN semaines sem ON sem.id = c.semaine_id AND sem.iso_week = $2
    JOIN sites s ON s.id = a.site_id
    WHERE a.extra_id = $1
  `, [extraId, isoWeek]);
  return rows;
}
