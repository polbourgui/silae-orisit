import pool from './db.js';
import logger from '../logger.js';

// DDL incrémental appliqué au démarrage — idempotent, ne remplace pas migrate.js
export async function applyIncrementalMigrations() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS extras_postes (
      extra_id UUID NOT NULL REFERENCES extras(id) ON DELETE CASCADE,
      poste_id UUID NOT NULL REFERENCES postes(id) ON DELETE CASCADE,
      site_id  UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
      PRIMARY KEY (extra_id, poste_id)
    )
  `);
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
  `);
  logger.info({ message: 'incremental migrations OK' });
}
