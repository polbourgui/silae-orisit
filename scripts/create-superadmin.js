/**
 * Crée (ou promeut) un compte superadmin pour l'UI d'administration (/admin.html).
 * Le superadmin doit être rattaché à un site existant (contrainte NOT NULL),
 * mais son rôle lui donne accès à la gestion de tous les sites.
 *
 * Usage :
 *   node scripts/create-superadmin.js --email admin@plateforme.fr --password "..." [--site-id <uuid>]
 *   (sans --site-id, le premier site en base est utilisé)
 */
import 'dotenv/config';
import bcrypt from 'bcrypt';
import pool from '../src/models/db.js';

function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i += 2) {
    if (!argv[i].startsWith('--')) continue;
    args[argv[i].slice(2)] = argv[i + 1];
  }
  return args;
}

const { email, password, 'site-id': siteIdArg } = parseArgs(process.argv);

if (!email || !password) {
  console.error('Usage : node scripts/create-superadmin.js --email admin@plateforme.fr --password "..." [--site-id <uuid>]');
  process.exit(1);
}
if (password.length < 8) {
  console.error('Erreur : le mot de passe doit comporter au moins 8 caractères.');
  process.exit(1);
}

let siteId = siteIdArg;
if (!siteId) {
  const { rows } = await pool.query('SELECT id, nom FROM sites ORDER BY created_at LIMIT 1');
  if (rows.length === 0) {
    console.error('Erreur : aucun site en base. Créez d\'abord un site (scripts/create-site.js).');
    process.exit(1);
  }
  siteId = rows[0].id;
  console.log(`Site de rattachement : ${rows[0].nom} (${siteId})`);
}

const hash = await bcrypt.hash(password, 12);
await pool.query(
  `INSERT INTO managers (site_id, email, password_hash, role)
   VALUES ($1, $2, $3, 'superadmin')
   ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash, role = 'superadmin'`,
  [siteId, email, hash]
);

console.log(`✓ Superadmin : ${email} → /admin.html`);
await pool.end();
