-- Rendre code_emploi optionnel (postes internes sans code Silae)
ALTER TABLE postes ALTER COLUMN code_emploi DROP NOT NULL;
ALTER TABLE postes ALTER COLUMN code_emploi SET DEFAULT NULL;

-- Unicité sur (site_id, libelle) plutôt que code_emploi
-- (ADD CONSTRAINT IF NOT EXISTS n'existe pas en PostgreSQL → DO block)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'postes_site_libelle_unique'
  ) THEN
    ALTER TABLE postes ADD CONSTRAINT postes_site_libelle_unique UNIQUE (site_id, libelle);
  END IF;
END $$;

-- Liaison extras ↔ postes (compétences)
CREATE TABLE IF NOT EXISTS extras_postes (
  extra_id UUID NOT NULL REFERENCES extras(id) ON DELETE CASCADE,
  poste_id UUID NOT NULL REFERENCES postes(id) ON DELETE CASCADE,
  site_id  UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  PRIMARY KEY (extra_id, poste_id)
);
