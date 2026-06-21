-- Migration 006: Points de vente (salles au sein d'un établissement)

CREATE TABLE IF NOT EXISTS points_de_vente (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  site_id     UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  nom         VARCHAR(100) NOT NULL,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (site_id, nom)
);

ALTER TABLE creneaux ADD COLUMN IF NOT EXISTS point_de_vente_id UUID REFERENCES points_de_vente(id) ON DELETE SET NULL;
