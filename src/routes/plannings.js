import { Router } from 'express';
import { requireManagerAuth } from '../middleware/auth.js';
import siteScope from '../middleware/siteScope.js';
import {
  findPlanningBySemaine, createPlanning, publishPlanning,
  findAffectations, createAffectation,
} from '../models/planningsModel.js';
import { findDisponibilites } from '../models/disponibilitesModel.js';
import { findExtrasBySite } from '../models/extrasModel.js';
import { greedyScheduler } from '../services/planningService.js';
import { validateUUID, assertRequired } from '../utils/validators.js';
import { NotFoundError, ValidationError } from '../errors/index.js';
import pool from '../models/db.js';

const router = Router();
router.use(requireManagerAuth, siteScope);

router.get('/semaine/:semaineId', async (req, res, next) => {
  try {
    if (!validateUUID(req.params.semaineId)) throw new ValidationError('UUID invalide');
    const planning = await findPlanningBySemaine(req.params.semaineId, req.siteId);
    if (!planning) throw new NotFoundError('Planning introuvable');
    const affectations = await findAffectations(planning.id, req.siteId);
    res.json({ ok: true, data: { planning, affectations } });
  } catch (err) {
    next(err);
  }
});

router.post('/semaine/:semaineId/propose', async (req, res, next) => {
  try {
    if (!validateUUID(req.params.semaineId)) throw new ValidationError('UUID invalide');
    const semaineId = req.params.semaineId;
    const extras = await findExtrasBySite(req.siteId);
    const { rows: creneaux } = await pool.query(
      'SELECT id, heure_debut, heure_fin FROM creneaux WHERE semaine_id = $1',
      [semaineId]
    );
    const disponibilites = await findDisponibilites(semaineId, req.siteId);
    const proposals = greedyScheduler(extras, creneaux, disponibilites);
    let planning = await findPlanningBySemaine(semaineId, req.siteId);
    if (!planning) planning = await createPlanning(semaineId, req.siteId);
    for (const { extra_id, creneau_id } of proposals) {
      await createAffectation(planning.id, extra_id, creneau_id, req.siteId);
    }
    res.json({ ok: true, data: { planning_id: planning.id, count: proposals.length } });
  } catch (err) {
    next(err);
  }
});

router.put('/:id/publish', async (req, res, next) => {
  try {
    if (!validateUUID(req.params.id)) throw new ValidationError('UUID invalide');
    const planning = await publishPlanning(req.params.id, req.siteId);
    if (!planning) throw new NotFoundError('Planning introuvable');
    res.json({ ok: true, data: planning });
  } catch (err) {
    next(err);
  }
});

router.put('/:id/affectations', async (req, res, next) => {
  try {
    if (!validateUUID(req.params.id)) throw new ValidationError('UUID invalide');
    assertRequired(req.body, ['extra_id', 'creneau_id']);
    const { extra_id, creneau_id } = req.body;
    if (!validateUUID(extra_id) || !validateUUID(creneau_id)) throw new ValidationError('UUIDs invalides');
    const aff = await createAffectation(req.params.id, extra_id, creneau_id, req.siteId);
    res.json({ ok: true, data: aff });
  } catch (err) {
    next(err);
  }
});

export default router;
