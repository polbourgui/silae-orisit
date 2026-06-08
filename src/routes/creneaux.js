import { Router } from 'express';
import { requireManagerAuth } from '../middleware/auth.js';
import siteScope from '../middleware/siteScope.js';
import { findOrCreateSemaine } from '../models/semainModel.js';
import {
  findCreneauxBySemaine,
  createCreneau,
  createCreneauxBatch,
  deleteCreneau,
  JOURS,
} from '../models/creneauxModel.js';
import { validateUUID, assertRequired } from '../utils/validators.js';
import { NotFoundError, ValidationError } from '../errors/index.js';
import pool from '../models/db.js';

const router = Router();
router.use(requireManagerAuth, siteScope);

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

function validateCreneauFields({ jour, slot_label, heure_debut, heure_fin }) {
  if (!jour || !JOURS.includes(jour)) {
    throw new ValidationError(`jour doit être parmi : ${JOURS.join(', ')}`);
  }
  if (!slot_label || typeof slot_label !== 'string' || slot_label.trim().length === 0) {
    throw new ValidationError('slot_label requis');
  }
  if (!TIME_RE.test(heure_debut) || !TIME_RE.test(heure_fin)) {
    throw new ValidationError('heure_debut et heure_fin doivent être au format HH:MM');
  }
  if (heure_debut === heure_fin) {
    throw new ValidationError('heure_debut et heure_fin ne peuvent pas être identiques');
  }
}

router.get('/semaine/:isoWeek', async (req, res, next) => {
  try {
    const { isoWeek } = req.params;
    const semaine = await findOrCreateSemaine(req.siteId, isoWeek);
    const postes = await pool.query(
      'SELECT id, code_emploi, libelle FROM postes WHERE site_id = $1 ORDER BY libelle',
      [req.siteId]
    );
    const creneaux = await findCreneauxBySemaine(semaine.id);
    res.json({ ok: true, data: { semaine, creneaux, postes: postes.rows } });
  } catch (err) {
    next(err);
  }
});

router.post('/semaine/:isoWeek', async (req, res, next) => {
  try {
    assertRequired(req.body, ['jour', 'slot_label', 'heure_debut', 'heure_fin']);
    validateCreneauFields(req.body);
    const semaine = await findOrCreateSemaine(req.siteId, req.params.isoWeek);
    const nbPostes = req.body.nb_postes != null ? parseInt(req.body.nb_postes, 10) : 1;
    if (!Number.isInteger(nbPostes) || nbPostes < 1 || nbPostes > 20) throw new ValidationError('nb_postes doit être un entier entre 1 et 20');
    const creneau = await createCreneau({
      semaineId: semaine.id,
      jour: req.body.jour,
      slotLabel: req.body.slot_label.trim(),
      heureDebut: req.body.heure_debut,
      heureFin: req.body.heure_fin,
      posteId: req.body.poste_id ?? null,
      nbPostes,
    });
    res.status(201).json({ ok: true, data: creneau });
  } catch (err) {
    next(err);
  }
});

router.post('/semaine/:isoWeek/batch', async (req, res, next) => {
  try {
    assertRequired(req.body, ['creneaux']);
    const { creneaux } = req.body;
    if (!Array.isArray(creneaux) || creneaux.length === 0) {
      throw new ValidationError('creneaux doit être un tableau non vide');
    }
    if (creneaux.length > 50) {
      throw new ValidationError('Maximum 50 créneaux par import');
    }
    for (const c of creneaux) {
      validateCreneauFields(c);
    }
    const semaine = await findOrCreateSemaine(req.siteId, req.params.isoWeek);
    const inserted = await createCreneauxBatch(semaine.id, creneaux);
    res.status(201).json({ ok: true, data: { count: inserted.length, creneaux: inserted } });
  } catch (err) {
    next(err);
  }
});

router.delete('/semaine/:isoWeek/:creneauId', async (req, res, next) => {
  try {
    if (!validateUUID(req.params.creneauId)) throw new ValidationError('UUID invalide');
    const semaine = await findOrCreateSemaine(req.siteId, req.params.isoWeek);
    const deleted = await deleteCreneau(req.params.creneauId, semaine.id);
    if (!deleted) throw new NotFoundError('Créneau introuvable');
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

export default router;
