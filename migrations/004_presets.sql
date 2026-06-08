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
);
