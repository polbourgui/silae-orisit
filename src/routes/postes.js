import { Router } from 'express';
import { requireManagerAuth } from '../middleware/auth.js';
import siteScope from '../middleware/siteScope.js';
import {
  findPostesBySite, createPoste, deletePoste,
  findPostesByExtra, setPostesForExtra,
} from '../models/postesModel.js';
import { validateUUID, assertRequired } from '../utils/validators.js';
import { NotFoundError, ValidationError } from '../errors/index.js';

const router = Router();
router.use(requireManagerAuth, siteScope);

router.get('/', async (req, res, next) => {
  try {
    res.json({ ok: true, data: await findPostesBySite(req.siteId) });
  } catch (err) { next(err); }
});

router.post('/', async (req, res, next) => {
  try {
    assertRequired(req.body, ['libelle']);
    const { libelle, code_emploi } = req.body;
    if (!libelle.trim()) throw new ValidationError('libelle requis');
    const poste = await createPoste(req.siteId, libelle, code_emploi);
    res.status(201).json({ ok: true, data: poste });
  } catch (err) { next(err); }
});

router.delete('/:id', async (req, res, next) => {
  try {
    if (!validateUUID(req.params.id)) throw new ValidationError('UUID invalide');
    const deleted = await deletePoste(req.params.id, req.siteId);
    if (!deleted) throw new NotFoundError('Poste introuvable');
    res.json({ ok: true });
  } catch (err) { next(err); }
});

router.get('/extra/:extraId', async (req, res, next) => {
  try {
    if (!validateUUID(req.params.extraId)) throw new ValidationError('UUID invalide');
    res.json({ ok: true, data: await findPostesByExtra(req.params.extraId, req.siteId) });
  } catch (err) { next(err); }
});

router.put('/extra/:extraId', async (req, res, next) => {
  try {
    if (!validateUUID(req.params.extraId)) throw new ValidationError('UUID invalide');
    const { poste_ids } = req.body;
    if (!Array.isArray(poste_ids) || poste_ids.some(id => !validateUUID(id))) {
      throw new ValidationError('poste_ids doit être un tableau de UUIDs valides');
    }
    await setPostesForExtra(req.params.extraId, req.siteId, poste_ids);
    res.json({ ok: true });
  } catch (err) { next(err); }
});

export default router;
