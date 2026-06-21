import { Router } from 'express';
import { requireManagerAuth } from '../middleware/auth.js';
import siteScope from '../middleware/siteScope.js';
import {
  findPointsDeVenteBySite, createPointDeVente, updatePointDeVente, deletePointDeVente,
} from '../models/pointsDeVenteModel.js';
import { validateUUID, assertRequired } from '../utils/validators.js';
import { NotFoundError, ValidationError } from '../errors/index.js';

const router = Router();
router.use(requireManagerAuth, siteScope);

router.get('/', async (req, res, next) => {
  try {
    res.json({ ok: true, data: await findPointsDeVenteBySite(req.siteId) });
  } catch (err) { next(err); }
});

router.post('/', async (req, res, next) => {
  try {
    assertRequired(req.body, ['nom']);
    if (!req.body.nom.trim()) throw new ValidationError('nom requis');
    const couleur = /^#[0-9a-fA-F]{6}$/.test(req.body.couleur ?? '') ? req.body.couleur : '#6366f1';
    const pdv = await createPointDeVente(req.siteId, req.body.nom, couleur);
    res.status(201).json({ ok: true, data: pdv });
  } catch (err) { next(err); }
});

router.patch('/:id', async (req, res, next) => {
  try {
    if (!validateUUID(req.params.id)) throw new ValidationError('UUID invalide');
    assertRequired(req.body, ['nom']);
    if (!req.body.nom.trim()) throw new ValidationError('nom requis');
    const couleur = /^#[0-9a-fA-F]{6}$/.test(req.body.couleur ?? '') ? req.body.couleur : '#6366f1';
    const pdv = await updatePointDeVente(req.params.id, req.siteId, req.body.nom, couleur);
    if (!pdv) throw new NotFoundError('Point de vente introuvable');
    res.json({ ok: true, data: pdv });
  } catch (err) { next(err); }
});

router.delete('/:id', async (req, res, next) => {
  try {
    if (!validateUUID(req.params.id)) throw new ValidationError('UUID invalide');
    const deleted = await deletePointDeVente(req.params.id, req.siteId);
    if (!deleted) throw new NotFoundError('Point de vente introuvable');
    res.json({ ok: true });
  } catch (err) { next(err); }
});

export default router;
