/**
 * Insère des disponibilités mockées pour la semaine courante.
 * Chaque extra est disponible sur un sous-ensemble de créneaux.
 *
 * Usage : node scripts/seed-dispos.js [isoWeek]
 * Exemple : node scripts/seed-dispos.js 2026-W24
 */
import 'dotenv/config';
import pool from '../src/models/db.js';

function currentISOWeek() {
  const d = new Date();
  const jan4 = new Date(d.getFullYear(), 0, 4);
  const w = Math.ceil(((d - jan4) / 86400000 + ((jan4.getDay() || 7) - 1) + 1) / 7);
  return `${d.getFullYear()}-W${String(w).padStart(2, '0')}`;
}

const isoWeek = process.argv[2] || currentISOWeek();
console.log(`Seed dispos pour : ${isoWeek}`);

const { rows: sites } = await pool.query('SELECT id FROM sites LIMIT 1');
const siteId = sites[0]?.id;
if (!siteId) { console.error('Aucun site en base'); process.exit(1); }

// Récupérer ou créer la semaine
const { rows: semRows } = await pool.query(
  `INSERT INTO semaines (site_id, iso_week) VALUES ($1, $2)
   ON CONFLICT (site_id, iso_week) DO UPDATE SET iso_week = EXCLUDED.iso_week
   RETURNING id`,
  [siteId, isoWeek]
);
const semaineId = semRows[0].id;

const { rows: creneaux } = await pool.query(
  'SELECT id, jour, heure_debut, slot_label FROM creneaux WHERE semaine_id = $1 ORDER BY jour, heure_debut',
  [semaineId]
);
if (!creneaux.length) {
  console.error(`Aucun créneau pour la semaine ${isoWeek}. Créez-en d'abord depuis le manager.`);
  process.exit(1);
}

const { rows: extras } = await pool.query(
  'SELECT id, nom, prenom FROM extras WHERE site_id = $1 ORDER BY nom',
  [siteId]
);
if (!extras.length) { console.error('Aucun extra en base'); process.exit(1); }

console.log(`${creneaux.length} créneaux, ${extras.length} extras`);

// Répartition mockée : chaque extra disponible sur ~60% des créneaux, de façon variée
const patterns = [
  (i) => i % 3 !== 0,       // extra 0 : disponible sauf 1/3
  (i) => i % 2 === 0,       // extra 1 : disponible créneaux pairs
  (i) => i < creneaux.length * 0.7, // extra 2 : disponible sur les 70% premiers
  (i) => i % 3 !== 1,       // extra 3 : disponible sauf 1/3
  (i) => i % 2 !== 0,       // extra 4 : disponible créneaux impairs
];

// Supprimer les dispos existantes pour cette semaine
await pool.query(
  'DELETE FROM disponibilites WHERE semaine_id = $1 AND site_id = $2',
  [semaineId, siteId]
);

let total = 0;
for (let ei = 0; ei < extras.length; ei++) {
  const extra = extras[ei];
  const pattern = patterns[ei % patterns.length];
  const dispoCreneaux = creneaux.filter((_, i) => pattern(i));

  for (const c of dispoCreneaux) {
    await pool.query(
      `INSERT INTO disponibilites (extra_id, semaine_id, site_id, creneau_id)
       VALUES ($1, $2, $3, $4) ON CONFLICT (extra_id, creneau_id) DO NOTHING`,
      [extra.id, semaineId, siteId, c.id]
    );
    total++;
  }

  const labels = dispoCreneaux.map(c => `${c.jour} ${c.heure_debut.slice(0,5)}`).join(', ');
  console.log(`  ${extra.prenom} ${extra.nom} → ${dispoCreneaux.length} dispos : ${labels}`);
}

console.log(`\n✓ ${total} disponibilités insérées`);
await pool.end();
