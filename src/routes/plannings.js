import { Router } from 'express';
import { requireManagerAuth } from '../middleware/auth.js';
import siteScope from '../middleware/siteScope.js';
import { findOrCreateSemaine } from '../models/semainModel.js';
import {
  findPlanningBySemaine, createPlanning, publishPlanning,
  findAffectations, createAffectation, upsertAffectation, clearAffectations,
} from '../models/planningsModel.js';
import { findCreneauxBySemaine } from '../models/creneauxModel.js';
import { findExtrasBySite } from '../models/extrasModel.js';
import { findDisponibilites } from '../models/disponibilitesModel.js';
import { greedyScheduler } from '../services/planningService.js';
import { validateUUID, assertRequired } from '../utils/validators.js';
import { NotFoundError, ValidationError, ForbiddenError } from '../errors/index.js';
import logger from '../logger.js';

const router = Router();
router.use(requireManagerAuth, siteScope);

// Charge tout ce dont la vue planning a besoin en un seul appel
router.get('/week/:isoWeek', async (req, res, next) => {
  try {
    const semaine   = await findOrCreateSemaine(req.siteId, req.params.isoWeek);
    const creneaux  = await findCreneauxBySemaine(semaine.id);
    const extras    = await findExtrasBySite(req.siteId);
    const dispos    = await findDisponibilites(semaine.id, req.siteId);
    const planning  = await findPlanningBySemaine(semaine.id, req.siteId);
    const affectations = planning ? await findAffectations(planning.id, req.siteId) : [];

    // Index dispo : Set de creneau_id par extra_id
    const dispoIndex = {};
    for (const d of dispos) {
      if (!dispoIndex[d.extra_id]) dispoIndex[d.extra_id] = new Set();
      dispoIndex[d.extra_id].add(d.creneau_id);
    }

    // Enrichir extras avec leurs dispos pour la semaine
    const extrasWithDispos = extras.map(e => ({
      ...e,
      dispo_creneau_ids: [...(dispoIndex[e.id] ?? [])],
    }));

    res.json({ ok: true, data: { semaine, creneaux, extras: extrasWithDispos, planning, affectations } });
  } catch (err) {
    next(err);
  }
});

// Lance l'algo greedy et remplace les affectations existantes
router.post('/week/:isoWeek/propose', async (req, res, next) => {
  try {
    const semaine  = await findOrCreateSemaine(req.siteId, req.params.isoWeek);
    const creneaux = await findCreneauxBySemaine(semaine.id);
    const extras   = await findExtrasBySite(req.siteId);
    const dispos   = await findDisponibilites(semaine.id, req.siteId);

    if (!creneaux.length) throw new ValidationError('Aucun créneau défini pour cette semaine');

    let planning = await findPlanningBySemaine(semaine.id, req.siteId);
    if (planning?.published_at) throw new ForbiddenError('Planning déjà publié');
    if (!planning) planning = await createPlanning(semaine.id, req.siteId);

    await clearAffectations(planning.id, req.siteId);

    const proposals = greedyScheduler(extras, creneaux, dispos);
    for (const { extra_id, creneau_id } of proposals) {
      await createAffectation(planning.id, extra_id, creneau_id, req.siteId);
    }

    const affectations = await findAffectations(planning.id, req.siteId);
    logger.info({ msg: 'Planning proposé', planningId: planning.id, count: proposals.length });
    res.json({ ok: true, data: { planning, affectations, count: proposals.length } });
  } catch (err) {
    next(err);
  }
});

// Modifie l'extra affecté à un créneau (extra_id: null = désaffecter)
router.put('/week/:isoWeek/affectation/:creneauId', async (req, res, next) => {
  try {
    if (!validateUUID(req.params.creneauId)) throw new ValidationError('UUID invalide');
    const { extra_id } = req.body;
    if (extra_id && !validateUUID(extra_id)) throw new ValidationError('extra_id invalide');

    const semaine = await findOrCreateSemaine(req.siteId, req.params.isoWeek);
    let planning  = await findPlanningBySemaine(semaine.id, req.siteId);
    if (!planning) planning = await createPlanning(semaine.id, req.siteId);
    if (planning.published_at) throw new ForbiddenError('Planning déjà publié');

    const aff = await upsertAffectation(planning.id, req.params.creneauId, extra_id ?? null, req.siteId);
    res.json({ ok: true, data: aff });
  } catch (err) {
    next(err);
  }
});

router.put('/:id/publish', async (req, res, next) => {
  try {
    if (!validateUUID(req.params.id)) throw new ValidationError('UUID invalide');
    const planning = await publishPlanning(req.params.id, req.siteId);
    if (!planning) throw new NotFoundError('Planning introuvable');
    logger.info({ msg: 'Planning publié', planningId: planning.id });
    res.json({ ok: true, data: planning });
  } catch (err) {
    next(err);
  }
});

export default router;
