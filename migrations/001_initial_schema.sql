-- Migration 001: Initial schema
-- Multi-tenant by site_id

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS sites (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nom        VARCHAR(255) NOT NULL,
  siret      VARCHAR(14) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS managers (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  site_id       UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  email         VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role          VARCHAR(50) NOT NULL DEFAULT 'manager',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS extras (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  site_id          UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  matricule_silae  VARCHAR(100) NOT NULL,
  nom              VARCHAR(255) NOT NULL,
  prenom           VARCHAR(255) NOT NULL,
  email            VARCHAR(255),
  telephone        VARCHAR(20),
  token_version    INTEGER NOT NULL DEFAULT 0,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (site_id, matricule_silae)
);

CREATE TABLE IF NOT EXISTS postes (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  site_id     UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  code_emploi VARCHAR(50) NOT NULL,
  libelle     VARCHAR(255) NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS semaines (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  site_id    UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  iso_week   VARCHAR(8) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (site_id, iso_week)
);

CREATE TABLE IF NOT EXISTS creneaux (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  semaine_id  UUID NOT NULL REFERENCES semaines(id) ON DELETE CASCADE,
  slot_label  VARCHAR(100),
  heure_debut TIME NOT NULL,
  heure_fin   TIME NOT NULL,
  poste_id    UUID REFERENCES postes(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS disponibilites (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  extra_id    UUID NOT NULL REFERENCES extras(id) ON DELETE CASCADE,
  semaine_id  UUID NOT NULL REFERENCES semaines(id) ON DELETE CASCADE,
  site_id     UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  creneau_id  UUID NOT NULL REFERENCES creneaux(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (extra_id, creneau_id)
);

CREATE TABLE IF NOT EXISTS plannings (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  semaine_id   UUID NOT NULL REFERENCES semaines(id) ON DELETE CASCADE,
  site_id      UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  published_at TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS affectations (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  planning_id UUID NOT NULL REFERENCES plannings(id) ON DELETE CASCADE,
  extra_id    UUID NOT NULL REFERENCES extras(id) ON DELETE CASCADE,
  creneau_id  UUID NOT NULL REFERENCES creneaux(id) ON DELETE CASCADE,
  site_id     UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (extra_id, creneau_id)
);

CREATE TABLE IF NOT EXISTS contrats (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  planning_id      UUID NOT NULL REFERENCES plannings(id) ON DELETE CASCADE,
  extra_id         UUID NOT NULL REFERENCES extras(id) ON DELETE CASCADE,
  creneau_id       UUID NOT NULL REFERENCES creneaux(id) ON DELETE CASCADE,
  site_id          UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  silae_status     VARCHAR(50) NOT NULL DEFAULT 'draft',
  silae_payload    JSONB,
  silae_response   JSONB,
  silae_called_at  TIMESTAMPTZ,
  has_signed       BOOLEAN NOT NULL DEFAULT FALSE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
