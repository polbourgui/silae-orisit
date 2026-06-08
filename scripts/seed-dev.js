/**
 * Seed complet pour développement local.
 * Crée : site, manager, extras, créneaux semaine courante, dispos mockées.
 * Idempotent : peut être relancé sans dupliquer les données.
 *
 * Usage : node scripts/seed-dev.js
 */
import 'dotenv/config';
import { createHash } from 'crypto';
import pool from '../src/models/db.js';

function currentISOWeek() {
  const d = new Date();
  const jan4 = new Date(d.getFullYear(), 0, 4);
  const w = Math.ceil(((d - jan4) / 86400000 + ((jan4.getDay() || 7) - 1) + 1) / 7);
  return `${d.getFullYear()}-W${String(w).padStart(2, '0')}`;
}

const SITE_ID   = '00000000-0000-0000-0000-000000000001';
const isoWeek   = currentISOWeek();

console.log(`\n🌱 Seed dev — semaine ${isoWeek}\n`);

// ── Migrations inline (idempotent) ───────────────────────────────────────────
await pool.query(`ALTER TABLE postes ALTER COLUMN code_emploi DROP NOT NULL`).catch(() => {});
await pool.query(`ALTER TABLE postes ALTER COLUMN code_emploi SET DEFAULT NULL`).catch(() => {});
await pool.query(`
  CREATE TABLE IF NOT EXISTS extras_postes (
    extra_id UUID NOT NULL REFERENCES extras(id) ON DELETE CASCADE,
    poste_id UUID NOT NULL REFERENCES postes(id) ON DELETE CASCADE,
    site_id  UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
    PRIMARY KEY (extra_id, poste_id)
  )
`).catch(() => {});
await pool.query(`ALTER TABLE postes ADD CONSTRAINT postes_site_libelle_unique UNIQUE (site_id, libelle)`).catch(() => {});

// ── Site ────────────────────────────────────────────────────────────────────
await pool.query(`
  INSERT INTO sites (id, nom, siret)
  VALUES ($1, 'Restaurant Le Central', '00000000000000')
  ON CONFLICT (id) DO NOTHING
`, [SITE_ID]);
console.log('✓ Site');

// ── Manager ─────────────────────────────────────────────────────────────────
const hash = createHash('sha256').update('test1234').digest('hex');
await pool.query(`
  INSERT INTO managers (site_id, email, password_hash, role)
  VALUES ($1, 'admin@test.fr', $2, 'admin')
  ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash
`, [SITE_ID, hash]);
console.log('✓ Manager  admin@test.fr / test1234');

// ── Postes ───────────────────────────────────────────────────────────────────
const postesData = [
  'Chef·fe de rang', 'Barman·maid', 'Runner', 'Responsable', 'Vestiaire', 'Billetterie',
];
const postes = [];
for (const libelle of postesData) {
  const existing = await pool.query('SELECT id, libelle FROM postes WHERE site_id = $1 AND libelle = $2', [SITE_ID, libelle]);
  if (existing.rows[0]) { postes.push(existing.rows[0]); continue; }
  const { rows } = await pool.query(
    `INSERT INTO postes (site_id, libelle) VALUES ($1, $2) RETURNING id, libelle`,
    [SITE_ID, libelle]
  );
  postes.push(rows[0]);
}
console.log(`✓ ${postes.length} postes`);

// ── Extras ───────────────────────────────────────────────────────────────────
const extrasData = [
  { matricule: 'M001', nom: 'Dupont',  prenom: 'Marc',   email: 'marc@test.fr' },
  { matricule: 'M002', nom: 'Martin',  prenom: 'Laura',  email: 'laura@test.fr' },
  { matricule: 'M003', nom: 'Petit',   prenom: 'Sophie', email: 'sophie@test.fr' },
  { matricule: 'M004', nom: 'Leroy',   prenom: 'Romain', email: 'romain@test.fr' },
  { matricule: 'M005', nom: 'Bernard', prenom: 'Chloé',  email: 'chloe@test.fr' },
];
const extras = [];
for (const e of extrasData) {
  const { rows } = await pool.query(`
    INSERT INTO extras (site_id, matricule_silae, nom, prenom, email)
    VALUES ($1, $2, $3, $4, $5)
    ON CONFLICT (site_id, matricule_silae) DO UPDATE SET nom=EXCLUDED.nom, prenom=EXCLUDED.prenom, email=EXCLUDED.email
    RETURNING id, nom, prenom
  `, [SITE_ID, e.matricule, e.nom, e.prenom, e.email]);
  extras.push(rows[0]);
}
console.log(`✓ ${extras.length} extras`);

// Associer des postes aux extras (indices dans postesData)
const extraPostes = [
  [0, 2],       // Marc : Chef de rang, Runner
  [1, 2],       // Laura : Barman, Runner
  [0, 3],       // Sophie : Chef de rang, Responsable
  [4],          // Romain : Vestiaire
  [5, 1],       // Chloé : Billetterie, Barman
];
for (let i = 0; i < extras.length; i++) {
  const ids = (extraPostes[i] ?? []).map(pi => postes[pi]?.id).filter(Boolean);
  await pool.query('DELETE FROM extras_postes WHERE extra_id = $1 AND site_id = $2', [extras[i].id, SITE_ID]);
  for (const pid of ids) {
    await pool.query('INSERT INTO extras_postes (extra_id, poste_id, site_id) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING', [extras[i].id, pid, SITE_ID]);
  }
}
console.log('✓ compétences extras associées');

// ── Semaine ──────────────────────────────────────────────────────────────────
const { rows: semRows } = await pool.query(`
  INSERT INTO semaines (site_id, iso_week)
  VALUES ($1, $2)
  ON CONFLICT (site_id, iso_week) DO UPDATE SET iso_week = EXCLUDED.iso_week
  RETURNING id
`, [SITE_ID, isoWeek]);
const semaineId = semRows[0].id;

// ── Créneaux ─────────────────────────────────────────────────────────────────
// Supprimer les anciens créneaux de cette semaine pour repartir propre
await pool.query('DELETE FROM creneaux WHERE semaine_id = $1', [semaineId]);

const creneauxData = [
  { jour: 'lundi',    slot_label: 'Service midi',   heure_debut: '11:00', heure_fin: '15:00' },
  { jour: 'lundi',    slot_label: 'Service soir',   heure_debut: '18:00', heure_fin: '23:00' },
  { jour: 'mardi',    slot_label: 'Service midi',   heure_debut: '11:00', heure_fin: '15:00' },
  { jour: 'mardi',    slot_label: 'Service soir',   heure_debut: '18:00', heure_fin: '23:00' },
  { jour: 'mercredi', slot_label: 'Service midi',   heure_debut: '11:00', heure_fin: '15:00' },
  { jour: 'mercredi', slot_label: 'Service soir',   heure_debut: '18:00', heure_fin: '23:00' },
  { jour: 'jeudi',    slot_label: 'Service soir',   heure_debut: '18:00', heure_fin: '23:00' },
  { jour: 'vendredi', slot_label: 'Service midi',   heure_debut: '11:00', heure_fin: '15:00' },
  { jour: 'vendredi', slot_label: 'Service soir',   heure_debut: '18:00', heure_fin: '23:00' },
  { jour: 'samedi',   slot_label: 'Service soir',   heure_debut: '18:00', heure_fin: '23:00' },
  { jour: 'samedi',   slot_label: 'Nuit',           heure_debut: '22:30', heure_fin: '06:00' },
];
const creneaux = [];
for (const c of creneauxData) {
  const { rows } = await pool.query(`
    INSERT INTO creneaux (semaine_id, jour, slot_label, heure_debut, heure_fin)
    VALUES ($1, $2, $3, $4, $5) RETURNING id, jour, heure_debut
  `, [semaineId, c.jour, c.slot_label, c.heure_debut, c.heure_fin]);
  creneaux.push(rows[0]);
}
console.log(`✓ ${creneaux.length} créneaux`);

// ── Disponibilités mockées ────────────────────────────────────────────────────
// Patterns variés par extra (~60-75% de disponibilité)
await pool.query('DELETE FROM disponibilites WHERE semaine_id = $1 AND site_id = $2', [semaineId, SITE_ID]);

const patterns = [
  (i) => i % 3 !== 0,
  (i) => i % 2 === 0,
  (i) => i < Math.ceil(creneaux.length * 0.75),
  (i) => i % 3 !== 1,
  (i) => i % 2 !== 0,
];
let totalDispos = 0;
for (let ei = 0; ei < extras.length; ei++) {
  const extra = extras[ei];
  const myCreneaux = creneaux.filter((_, i) => patterns[ei % patterns.length](i));
  for (const c of myCreneaux) {
    await pool.query(`
      INSERT INTO disponibilites (extra_id, semaine_id, site_id, creneau_id)
      VALUES ($1, $2, $3, $4) ON CONFLICT (extra_id, creneau_id) DO NOTHING
    `, [extra.id, semaineId, SITE_ID, c.id]);
  }
  const labels = myCreneaux.map(c => `${c.jour} ${c.heure_debut.slice(0,5)}`).join(', ');
  console.log(`  ${extra.prenom} ${extra.nom} → ${myCreneaux.length} dispos : ${labels}`);
  totalDispos += myCreneaux.length;
}
console.log(`✓ ${totalDispos} disponibilités`);

console.log(`
✅ Seed terminé !

  URL manager  : http://localhost:3000/manager.html
  Login        : admin@test.fr / test1234
  Semaine      : ${isoWeek}
`);
await pool.end();
