-- Migration 002: ajout colonne jour sur creneaux
-- Valeurs : lundi, mardi, mercredi, jeudi, vendredi, samedi, dimanche

ALTER TABLE creneaux ADD COLUMN IF NOT EXISTS jour VARCHAR(10) NOT NULL DEFAULT 'lundi';
