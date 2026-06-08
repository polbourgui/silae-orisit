-- Rendre code_emploi optionnel (postes internes sans code Silae)
ALTER TABLE postes ALTER COLUMN code_emploi DROP NOT NULL;
ALTER TABLE postes ALTER COLUMN code_emploi SET DEFAULT NULL;

-- Unicité sur (site_id, libelle) plutôt que code_emploi
ALTER TABLE postes ADD CONSTRAINT IF NOT EXISTS postes_site_libelle_unique UNIQUE (site_id, libelle);

-- Liaison extras ↔ postes (compétences)
CREATE TABLE IF NOT EXISTS extras_postes (
  extra_id UUID NOT NULL REFERENCES extras(id) ON DELETE CASCADE,
  poste_id UUID NOT NULL REFERENCES postes(id) ON DELETE CASCADE,
  site_id  UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  PRIMARY KEY (extra_id, poste_id)
);
