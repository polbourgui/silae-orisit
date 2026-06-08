-- Migration initiale — schéma multi-tenant silae-orisit

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE sites (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nom        TEXT NOT NULL,
  siret      VARCHAR(14) NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE managers (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id       UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role          VARCHAR(20) NOT NULL DEFAULT 'manager',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE extras (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id         UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  matricule_silae TEXT NOT NULL,
  nom             TEXT NOT NULL,
  prenom          TEXT NOT NULL,
  email           TEXT,
  telephone       TEXT,
  token_version   INT NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (site_id, matricule_silae)
);

CREATE TABLE postes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id     UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  code_emploi TEXT NOT NULL,
  libelle     TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (site_id, code_emploi)
);

CREATE TABLE semaines (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id   UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  iso_week  VARCHAR(8) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (site_id, iso_week)
);

CREATE TABLE creneaux (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  semaine_id  UUID NOT NULL REFERENCES semaines(id) ON DELETE CASCADE,
  slot_label  VARCHAR(100) NOT NULL,
  heure_debut TIMESTAMPTZ NOT NULL,
  heure_fin   TIMESTAMPTZ NOT NULL,
  poste_id    UUID REFERENCES postes(id) ON DELETE SET NULL
);

CREATE TABLE disponibilites (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  extra_id    UUID NOT NULL REFERENCES extras(id) ON DELETE CASCADE,
  semaine_id  UUID NOT NULL REFERENCES semaines(id) ON DELETE CASCADE,
  site_id     UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  creneau_id  UUID NOT NULL REFERENCES creneaux(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (extra_id, creneau_id)
);

CREATE TABLE plannings (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  semaine_id   UUID NOT NULL REFERENCES semaines(id) ON DELETE CASCADE,
  site_id      UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  published_at TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE affectations (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  planning_id UUID NOT NULL REFERENCES plannings(id) ON DELETE CASCADE,
  extra_id    UUID NOT NULL REFERENCES extras(id) ON DELETE CASCADE,
  creneau_id  UUID NOT NULL REFERENCES creneaux(id) ON DELETE CASCADE,
  site_id     UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (extra_id, creneau_id)
);

CREATE TABLE contrats (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  planning_id      UUID NOT NULL REFERENCES plannings(id) ON DELETE CASCADE,
  extra_id         UUID NOT NULL REFERENCES extras(id) ON DELETE CASCADE,
  creneau_id       UUID NOT NULL REFERENCES creneaux(id) ON DELETE CASCADE,
  site_id          UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  silae_status     VARCHAR(20) NOT NULL DEFAULT 'draft',
  silae_payload    JSONB,
  silae_response   JSONB,
  silae_called_at  TIMESTAMPTZ,
  has_signed       BOOLEAN NOT NULL DEFAULT false,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_extras_site_id ON extras(site_id);
CREATE INDEX idx_semaines_site_id ON semaines(site_id);
CREATE INDEX idx_disponibilites_semaine ON disponibilites(semaine_id, site_id);
CREATE INDEX idx_affectations_planning ON affectations(planning_id, site_id);
CREATE INDEX idx_contrats_planning ON contrats(planning_id, site_id);
CREATE INDEX idx_contrats_extra ON contrats(extra_id, site_id);
