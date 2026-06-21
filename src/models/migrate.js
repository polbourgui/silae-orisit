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
  // is_blocked a été migré vers site_extras (migration 005) — on n'y touche plus sur extras
  await pool.query(`
    CREATE TABLE IF NOT EXISTS site_extras (
      id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      site_id         UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
      extra_id        UUID NOT NULL REFERENCES extras(id) ON DELETE CASCADE,
      matricule_silae VARCHAR(100) NOT NULL,
      is_blocked      BOOLEAN NOT NULL DEFAULT FALSE,
      created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (site_id, extra_id),
      UNIQUE (site_id, matricule_silae)
    )
  `);
  await pool.query(`ALTER TABLE creneaux ADD COLUMN IF NOT EXISTS nb_postes INTEGER NOT NULL DEFAULT 1`);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS points_de_vente (
      id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      site_id     UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
      nom         VARCHAR(100) NOT NULL,
      sort_order  INTEGER NOT NULL DEFAULT 0,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (site_id, nom)
    )
  `);
  await pool.query(`ALTER TABLE creneaux ADD COLUMN IF NOT EXISTS point_de_vente_id UUID REFERENCES points_de_vente(id) ON DELETE SET NULL`);
  await pool.query(`ALTER TABLE creneaux ADD COLUMN IF NOT EXISTS notes TEXT`);
  await pool.query(`ALTER TABLE points_de_vente ADD COLUMN IF NOT EXISTS couleur VARCHAR(7) NOT NULL DEFAULT '#6366f1'`);

  // Reporting : type d'activité sur les créneaux + taux horaire estimé sur les postes
  await pool.query(`ALTER TABLE creneaux ADD COLUMN IF NOT EXISTS type_activite TEXT CHECK (type_activite IN ('restauration', 'programmation', 'privatisation', 'autre'))`);
  await pool.query(`ALTER TABLE postes ADD COLUMN IF NOT EXISTS taux_horaire_estime NUMERIC(8,2)`);

  // Indexes de performance
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_creneaux_semaine_id ON creneaux(semaine_id)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_dispos_extra_semaine ON disponibilites(extra_id, semaine_id, site_id)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_affectations_planning ON affectations(planning_id, site_id)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_semaines_site_week ON semaines(site_id, iso_week)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_extras_postes_extra ON extras_postes(extra_id, site_id)`);

  logger.info({ message: 'incremental migrations OK' });
}
