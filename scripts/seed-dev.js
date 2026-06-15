/**
 * Seed complet pour développement local.
 * Crée : site, manager, extras, créneaux semaine courante, dispos mockées.
 * Idempotent : peut être relancé sans dupliquer les données.
 *
 * Usage : node scripts/seed-dev.js
 */
import 'dotenv/config';
import bcrypt from 'bcrypt';
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
await pool.query(`
  CREATE TABLE IF NOT EXISTS presets (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    site_id     UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
    label       VARCHAR(100) NOT NULL,
    slot_label  VARCHAR(100) NOT NULL,
    heure_debut VARCHAR(5)   NOT NULL,
    heure_fin   VARCHAR(5)   NOT NULL,
    sort_order  INTEGER NOT NULL DEFAULT 0,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (site_id, label)
  )
`).catch(() => {});

// ── Site ────────────────────────────────────────────────────────────────────
await pool.query(`
  INSERT INTO sites (id, nom, siret)
  VALUES ($1, 'Restaurant Le Central', '00000000000000')
  ON CONFLICT (id) DO NOTHING
`, [SITE_ID]);
console.log('✓ Site');

// ── Manager ─────────────────────────────────────────────────────────────────
const hash = await bcrypt.hash('test1234', 12);
await pool.query(`
  INSERT INTO managers (site_id, email, password_hash, role)
  VALUES ($1, 'admin@test.fr', $2, 'admin')
  ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash
`, [SITE_ID, hash]);
console.log('✓ Manager  admin@test.fr / test1234');

await pool.query(`
  INSERT INTO managers (site_id, email, password_hash, role)
  VALUES ($1, 'superadmin@test.fr', $2, 'superadmin')
  ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash, role = 'superadmin'
`, [SITE_ID, hash]);
console.log('✓ Superadmin  superadmin@test.fr / test1234  → /admin.html');

// ── Présets ──────────────────────────────────────────────────────────────────
const presetsData = [
  { label: 'Service midi',  slot_label: 'Service midi',  heure_debut: '11:00', heure_fin: '15:00', sort_order: 0 },
  { label: 'Service soir',  slot_label: 'Service soir',  heure_debut: '18:00', heure_fin: '23:00', sort_order: 1 },
  { label: 'Nuit',          slot_label: 'Nuit',          heure_debut: '22:30', heure_fin: '06:00', sort_order: 2 },
  { label: 'Journée',       slot_label: 'Journée',       heure_debut: '09:00', heure_fin: '17:00', sort_order: 3 },
  { label: 'Matin',         slot_label: 'Matin',         heure_debut: '08:00', heure_fin: '13:00', sort_order: 4 },
  { label: 'Après-midi',    slot_label: 'Après-midi',    heure_debut: '13:00', heure_fin: '18:00', sort_order: 5 },
];
for (const p of presetsData) {
  const ex = await pool.query('SELECT id FROM presets WHERE site_id=$1 AND label=$2', [SITE_ID, p.label]);
  if (!ex.rows[0]) await pool.query(
    'INSERT INTO presets (site_id, label, slot_label, heure_debut, heure_fin, sort_order) VALUES ($1,$2,$3,$4,$5,$6)',
    [SITE_ID, p.label, p.slot_label, p.heure_debut, p.heure_fin, p.sort_order]
  );
}
console.log(`✓ ${presetsData.length} présets`);

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
// 50 extras avec noms français réalistes et compétences variées
// postesData : 0=Chef de rang, 1=Barman, 2=Runner, 3=Responsable, 4=Vestiaire, 5=Billetterie
const extrasData = [
  { matricule: 'M001', nom: 'Dupont',       prenom: 'Marc',      email: 'marc.dupont@test.fr',      postes: [0, 2] },
  { matricule: 'M002', nom: 'Martin',       prenom: 'Laura',     email: 'laura.martin@test.fr',     postes: [1, 2] },
  { matricule: 'M003', nom: 'Petit',        prenom: 'Sophie',    email: 'sophie.petit@test.fr',     postes: [0, 3] },
  { matricule: 'M004', nom: 'Leroy',        prenom: 'Romain',    email: 'romain.leroy@test.fr',     postes: [4] },
  { matricule: 'M005', nom: 'Bernard',      prenom: 'Chloé',     email: 'chloe.bernard@test.fr',    postes: [5, 1] },
  { matricule: 'M006', nom: 'Moreau',       prenom: 'Antoine',   email: 'antoine.moreau@test.fr',   postes: [0, 2] },
  { matricule: 'M007', nom: 'Simon',        prenom: 'Camille',   email: 'camille.simon@test.fr',    postes: [1] },
  { matricule: 'M008', nom: 'Laurent',      prenom: 'Thomas',    email: 'thomas.laurent@test.fr',   postes: [2, 3] },
  { matricule: 'M009', nom: 'Lefebvre',     prenom: 'Anaïs',     email: 'anais.lefebvre@test.fr',   postes: [4, 5] },
  { matricule: 'M010', nom: 'Michel',       prenom: 'Julien',    email: 'julien.michel@test.fr',    postes: [0] },
  { matricule: 'M011', nom: 'Garcia',       prenom: 'Léa',       email: 'lea.garcia@test.fr',       postes: [1, 2] },
  { matricule: 'M012', nom: 'David',        prenom: 'Nicolas',   email: 'nicolas.david@test.fr',    postes: [2] },
  { matricule: 'M013', nom: 'Bertrand',     prenom: 'Emma',      email: 'emma.bertrand@test.fr',    postes: [0, 1] },
  { matricule: 'M014', nom: 'Robert',       prenom: 'Hugo',      email: 'hugo.robert@test.fr',      postes: [3, 0] },
  { matricule: 'M015', nom: 'Richard',      prenom: 'Manon',     email: 'manon.richard@test.fr',    postes: [5] },
  { matricule: 'M016', nom: 'Durand',       prenom: 'Alexis',    email: 'alexis.durand@test.fr',    postes: [1, 4] },
  { matricule: 'M017', nom: 'Roux',         prenom: 'Inès',      email: 'ines.roux@test.fr',        postes: [2, 5] },
  { matricule: 'M018', nom: 'Vincent',      prenom: 'Mathieu',   email: 'mathieu.vincent@test.fr',  postes: [0] },
  { matricule: 'M019', nom: 'Fournier',     prenom: 'Lucie',     email: 'lucie.fournier@test.fr',   postes: [1, 3] },
  { matricule: 'M020', nom: 'Morin',        prenom: 'Baptiste',  email: 'baptiste.morin@test.fr',   postes: [4] },
  { matricule: 'M021', nom: 'Girard',       prenom: 'Clara',     email: 'clara.girard@test.fr',     postes: [0, 2] },
  { matricule: 'M022', nom: 'André',        prenom: 'Rémi',      email: 'remi.andre@test.fr',       postes: [1] },
  { matricule: 'M023', nom: 'Lefèvre',      prenom: 'Julie',     email: 'julie.lefevre@test.fr',    postes: [5, 0] },
  { matricule: 'M024', nom: 'Mercier',      prenom: 'Kévin',     email: 'kevin.mercier@test.fr',    postes: [2, 3] },
  { matricule: 'M025', nom: 'Dupuis',       prenom: 'Pauline',   email: 'pauline.dupuis@test.fr',   postes: [4, 1] },
  { matricule: 'M026', nom: 'Fontaine',     prenom: 'Arthur',    email: 'arthur.fontaine@test.fr',  postes: [0] },
  { matricule: 'M027', nom: 'Chevalier',    prenom: 'Margot',    email: 'margot.chevalier@test.fr', postes: [1, 2] },
  { matricule: 'M028', nom: 'Robin',        prenom: 'Théo',      email: 'theo.robin@test.fr',       postes: [3] },
  { matricule: 'M029', nom: 'Muller',       prenom: 'Alice',     email: 'alice.muller@test.fr',     postes: [0, 5] },
  { matricule: 'M030', nom: 'Lecomte',      prenom: 'Maxime',    email: 'maxime.lecomte@test.fr',   postes: [2] },
  { matricule: 'M031', nom: 'Perrin',       prenom: 'Jade',      email: 'jade.perrin@test.fr',      postes: [1, 4] },
  { matricule: 'M032', nom: 'Renard',       prenom: 'Clément',   email: 'clement.renard@test.fr',   postes: [0, 2] },
  { matricule: 'M033', nom: 'Gilles',       prenom: 'Élodie',    email: 'elodie.gilles@test.fr',    postes: [5] },
  { matricule: 'M034', nom: 'Rousseau',     prenom: 'Florian',   email: 'florian.rousseau@test.fr', postes: [1, 3] },
  { matricule: 'M035', nom: 'Blanc',        prenom: 'Océane',    email: 'oceane.blanc@test.fr',     postes: [4, 0] },
  { matricule: 'M036', nom: 'Guérin',       prenom: 'Samuel',    email: 'samuel.guerin@test.fr',    postes: [2] },
  { matricule: 'M037', nom: 'Boyer',        prenom: 'Laëtitia',  email: 'laetitia.boyer@test.fr',   postes: [0, 1] },
  { matricule: 'M038', nom: 'Gauthier',     prenom: 'Sébastien', email: 'sebastien.gauthier@test.fr', postes: [3, 2] },
  { matricule: 'M039', nom: 'Rey',          prenom: 'Noémie',    email: 'noemie.rey@test.fr',       postes: [1] },
  { matricule: 'M040', nom: 'Henry',        prenom: 'Adrien',    email: 'adrien.henry@test.fr',     postes: [5, 4] },
  { matricule: 'M041', nom: 'Perrot',       prenom: 'Valentine', email: 'valentine.perrot@test.fr', postes: [0] },
  { matricule: 'M042', nom: 'Leclerc',      prenom: 'Guillaume', email: 'guillaume.leclerc@test.fr', postes: [1, 2] },
  { matricule: 'M043', nom: 'Aubert',       prenom: 'Amandine',  email: 'amandine.aubert@test.fr',  postes: [3, 0] },
  { matricule: 'M044', nom: 'Carpentier',   prenom: 'Luca',      email: 'luca.carpentier@test.fr',  postes: [2] },
  { matricule: 'M045', nom: 'Collet',       prenom: 'Mathilde',  email: 'mathilde.collet@test.fr',  postes: [4, 5] },
  { matricule: 'M046', nom: 'Fernandez',    prenom: 'Dylan',     email: 'dylan.fernandez@test.fr',  postes: [1, 3] },
  { matricule: 'M047', nom: 'Dufour',       prenom: 'Estelle',   email: 'estelle.dufour@test.fr',   postes: [0, 2] },
  { matricule: 'M048', nom: 'Jacquet',      prenom: 'Tristan',   email: 'tristan.jacquet@test.fr',  postes: [5] },
  { matricule: 'M049', nom: 'Breton',       prenom: 'Audrey',    email: 'audrey.breton@test.fr',    postes: [1, 4] },
  { matricule: 'M050', nom: 'Marchand',     prenom: 'Corentin',  email: 'corentin.marchand@test.fr', postes: [0, 3] },
];
const extras = [];
for (const e of extrasData) {
  // Upsert entité globale (dédup par email)
  const { rows: extRows } = await pool.query(`
    INSERT INTO extras (nom, prenom, email)
    VALUES ($1, $2, $3)
    ON CONFLICT (email) WHERE email IS NOT NULL
    DO UPDATE SET nom=EXCLUDED.nom, prenom=EXCLUDED.prenom
    RETURNING id, nom, prenom
  `, [e.nom, e.prenom, e.email]);
  const extra = extRows[0];
  // Liaison site avec matricule Silae propre à ce dossier
  await pool.query(`
    INSERT INTO site_extras (site_id, extra_id, matricule_silae)
    VALUES ($1, $2, $3)
    ON CONFLICT (site_id, extra_id) DO UPDATE SET matricule_silae = EXCLUDED.matricule_silae
  `, [SITE_ID, extra.id, e.matricule]);
  extras.push({ ...extra, postesIdx: e.postes });
}
console.log(`✓ ${extras.length} extras`);

// Associer les postes aux extras
for (const extra of extras) {
  const ids = extra.postesIdx.map(pi => postes[pi]?.id).filter(Boolean);
  await pool.query('DELETE FROM extras_postes WHERE extra_id = $1 AND site_id = $2', [extra.id, SITE_ID]);
  for (const pid of ids) {
    await pool.query('INSERT INTO extras_postes (extra_id, poste_id, site_id) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING', [extra.id, pid, SITE_ID]);
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

// Patterns variés : 60–80 % de dispo, ~20 % sans réponse (ni dispo ni pas dispo)
// Un extra sur 6 n'a pas répondu du tout (dispo_creneau_ids vide)
const patterns = [
  (i) => i % 3 !== 0,
  (i) => i % 2 === 0,
  (i) => i < Math.ceil(creneaux.length * 0.75),
  (i) => i % 3 !== 1,
  (i) => i % 2 !== 0,
  (i) => [0, 2, 4, 6, 8, 10].includes(i),
  (i) => i < Math.ceil(creneaux.length * 0.5),
  (i) => i % 4 !== 2,
];
let totalDispos = 0;
for (let ei = 0; ei < extras.length; ei++) {
  const extra = extras[ei];
  // 1 extra sur 6 = pas répondu
  if (ei % 6 === 5) continue;
  const myCreneaux = creneaux.filter((_, i) => patterns[ei % patterns.length](i));
  for (const c of myCreneaux) {
    await pool.query(`
      INSERT INTO disponibilites (extra_id, semaine_id, site_id, creneau_id)
      VALUES ($1, $2, $3, $4) ON CONFLICT (extra_id, creneau_id) DO NOTHING
    `, [extra.id, semaineId, SITE_ID, c.id]);
  }
  totalDispos += myCreneaux.length;
}
console.log(`✓ ${totalDispos} disponibilités (${extras.length - Math.floor(extras.length / 6)} extras ont répondu, ${Math.floor(extras.length / 6)} sans réponse)`);

console.log(`
✅ Seed terminé !

  URL manager  : http://localhost:3000/manager.html
  Login        : admin@test.fr / test1234
  Semaine      : ${isoWeek}
`);
await pool.end();
