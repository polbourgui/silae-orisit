import { Router } from 'express';
import { requireManagerAuth } from '../middleware/auth.js';
import siteScope from '../middleware/siteScope.js';
import { findExtrasBySite, findExtraById } from '../models/extrasModel.js';
import { syncExtrasFromSilae } from '../services/silaeService.js';
import { validateUUID } from '../utils/validators.js';
import { NotFoundError, ValidationError } from '../errors/index.js';

const router = Router();

router.use(requireManagerAuth, siteScope);

router.get('/', async (req, res, next) => {
  try {
    const extras = await findExtrasBySite(req.siteId);
    res.json({ ok: true, data: extras });
  } catch (err) {
    next(err);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    if (!validateUUID(req.params.id)) throw new ValidationError('UUID invalide');
    const extra = await findExtraById(req.params.id, req.siteId);
    if (!extra) throw new NotFoundError('Extra introuvable');
    res.json({ ok: true, data: extra });
  } catch (err) {
    next(err);
  }
});

router.post('/sync', async (req, res, next) => {
  try {
    const synced = await syncExtrasFromSilae(req.siteId);
    res.json({ ok: true, data: { count: synced.length } });
  } catch (err) {
    next(err);
  }
});

export default router;
