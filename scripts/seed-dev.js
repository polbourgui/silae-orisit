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
