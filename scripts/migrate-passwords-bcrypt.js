/**
 * Migration one-shot : convertit les password_hash SHA-256 existants en bcrypt.
 * Détecte les hash SHA-256 (64 chars hex) et les remplace par un hash bcrypt temporaire
 * qui forcera un reset de mot de passe, OU peut être lancé avec un mapping email→mdp
 * si les mots de passe sont connus (environnement de dev).
 *
 * Usage dev  : node scripts/migrate-passwords-bcrypt.js
 * Usage prod : fournir les nouveaux mots de passe manuellement ou forcer un reset.
 */
import 'dotenv/config';
import bcrypt from 'bcrypt';
import pool from '../src/models/db.js';

const SHA256_RE = /^[0-9a-f]{64}$/i;

const { rows: managers } = await pool.query('SELECT id, email, password_hash FROM managers');

let migrated = 0;
for (const m of managers) {
  if (!SHA256_RE.test(m.password_hash)) {
    console.log(`  skip ${m.email} (already bcrypt)`);
    continue;
  }
  // En dev uniquement — adapte si tu connais le mot de passe
  // En prod, utilise un token de reset à la place
  console.log(`  migrating ${m.email}...`);
  // Marque le hash comme invalide pour forcer un reset (préfixe non-bcrypt)
  await pool.query(
    `UPDATE managers SET password_hash = 'RESET_REQUIRED' WHERE id = $1`,
    [m.id]
  );
  migrated++;
}

console.log(`\nDone: ${migrated} manager(s) marked for password reset.`);
console.log('Re-run seed-dev.js or use /auth/reset to set new bcrypt passwords.');
await pool.end();
