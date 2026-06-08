import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { requireManagerAuth } from '../middleware/auth.js';
import { requireMagicLink } from '../middleware/auth.js';
import siteScope from '../middleware/siteScope.js';
import { saveDisponibilites, findDisponibilites, findDisponibilitesExtra } from '../models/disponibilitesModel.js';
import { findOrCreateSemaine } from '../models/semainModel.js';
import { findCreneauxBySemaine } from '../models/creneauxModel.js';
import { validateUUID, assertRequired } from '../utils/validators.js';
import { ValidationError } from '../errors/index.js';

const router = Router();

const magicLinkLimiter = rateLimit({ windowMs: 60_000, max: 10, standardHeaders: true, legacyHeaders: false });

router.get('/:token', magicLinkLimiter, requireMagicLink('dispo'), async (req, res, next) => {
  try {
    const semaine = await findOrCreateSemaine(req.extra.site_id, req.semaine);
    const creneaux = await findCreneauxBySemaine(semaine.id);
    const dispos = await findDisponibilitesExtra(req.extra.id, semaine.id, req.extra.site_id);
    const checked_ids = dispos.map(d => d.creneau_id);
    res.json({ ok: true, data: { extra: req.extra, semaine, creneaux, checked_ids } });
  } catch (err) {
    next(err);
  }
});

router.post('/:token', magicLinkLimiter, requireMagicLink('dispo'), async (req, res, next) => {
  try {
    assertRequired(req.body, ['creneau_ids']);
    const { creneau_ids } = req.body;
    if (!Array.isArray(creneau_ids) || creneau_ids.some((id) => !validateUUID(id))) {
      throw new ValidationError('creneau_ids doit être un tableau de UUIDs valides');
    }
    const semaine = await findOrCreateSemaine(req.extra.site_id, req.semaine);
    const saved = await saveDisponibilites(req.extra.id, semaine.id, req.extra.site_id, creneau_ids);
    res.json({ ok: true, data: { count: saved.length } });
  } catch (err) {
    next(err);
  }
});

router.get('/semaine/:semaineId', requireManagerAuth, siteScope, async (req, res, next) => {
  try {
    if (!validateUUID(req.params.semaineId)) throw new ValidationError('UUID invalide');
    const dispos = await findDisponibilites(req.params.semaineId, req.siteId);
    res.json({ ok: true, data: dispos });
  } catch (err) {
    next(err);
  }
});

export default router;
