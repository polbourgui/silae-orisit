-- Migration 005: Global extras with per-site membership
-- Un extra devient une entité globale (personne physique).
-- La liaison site ↔ extra avec le matricule Silae propre à chaque dossier
-- est déportée dans la table site_extras.

-- 1. Garantir que is_blocked existe sur extras avant de le migrer
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'extras' AND column_name = 'is_blocked'
  ) THEN
    ALTER TABLE extras ADD COLUMN is_blocked BOOLEAN NOT NULL DEFAULT FALSE;
  END IF;
END $$;

-- 2. Table de liaison site ↔ extra
CREATE TABLE IF NOT EXISTS site_extras (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  site_id         UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  extra_id        UUID NOT NULL REFERENCES extras(id) ON DELETE CASCADE,
  matricule_silae VARCHAR(100) NOT NULL,
  is_blocked      BOOLEAN NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (site_id, extra_id),
  UNIQUE (site_id, matricule_silae)
);

-- 3. Migrer les données existantes vers site_extras
INSERT INTO site_extras (site_id, extra_id, matricule_silae, is_blocked)
SELECT site_id, id, matricule_silae, COALESCE(is_blocked, FALSE)
FROM extras
ON CONFLICT (site_id, extra_id) DO NOTHING;

-- 4. Supprimer les colonnes site-spécifiques d'extras
--    (les FK enfants ne référencent que extras.id, pas site_id)
ALTER TABLE extras DROP COLUMN IF EXISTS site_id;
ALTER TABLE extras DROP COLUMN IF EXISTS matricule_silae;
ALTER TABLE extras DROP COLUMN IF EXISTS is_blocked;

-- 5. Index partiel unique sur email pour la déduplication lors du sync Silae
CREATE UNIQUE INDEX IF NOT EXISTS extras_email_unique
  ON extras(email) WHERE email IS NOT NULL;
