/**
 * Onboarding d'un nouveau site : crée le site + son manager.
 * Un manager = un site (architecture mono-site par compte).
 *
 * Usage :
 *   node scripts/create-site.js --nom "Le Grand Café" --siret 12345678901234 \
 *     --email manager@legrandcafe.fr --password "motdepasse"
 */
import 'dotenv/config';
import bcrypt from 'bcrypt';
import pool from '../src/models/db.js';
import { createSite } from '../src/models/sitesModel.js';

function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i += 2) {
    if (!argv[i].startsWith('--')) continue;
    args[argv[i].slice(2)] = argv[i + 1];
  }
  return args;
}

const { nom, siret, email, password, role = 'manager' } = parseArgs(process.argv);

if (!nom || !siret || !email || !password) {
  console.error('Usage : node scripts/create-site.js --nom "Nom du site" --siret 12345678901234 --email manager@site.fr --password "..."');
  process.exit(1);
}
if (!/^\d{14}$/.test(siret)) {
  console.error('Erreur : le SIRET doit comporter exactement 14 chiffres.');
  process.exit(1);
}
if (password.length < 8) {
  console.error('Erreur : le mot de passe doit comporter au moins 8 caractères.');
  process.exit(1);
}

const { rows: existing } = await pool.query('SELECT id FROM managers WHERE email = $1', [email]);
if (existing.length > 0) {
  console.error(`Erreur : un manager existe déjà avec l'email ${email}.`);
  process.exit(1);
}

const site = await createSite(nom, siret);
const hash = await bcrypt.hash(password, 12);
await pool.query(
  `INSERT INTO managers (site_id, email, password_hash, role) VALUES ($1, $2, $3, $4)`,
  [site.id, email, hash, role]
);

console.log(`✓ Site créé    : ${site.nom} (${site.siret})`);
console.log(`  site_id      : ${site.id}`);
console.log(`✓ Manager créé : ${email} (${role})`);
await pool.end();
