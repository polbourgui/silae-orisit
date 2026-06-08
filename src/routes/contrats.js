import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { requireManagerAuth } from '../middleware/auth.js';
import { requireMagicLink } from '../middleware/auth.js';
import siteScope from '../middleware/siteScope.js';
import {
  findContratsByPlanning, findContratById,
} from '../models/contratsModel.js';
import { findExtraById } from '../models/extrasModel.js';
import { generateContratPDF } from '../services/pdfService.js';
import { validateUUID } from '../utils/validators.js';
import { NotFoundError, ValidationError } from '../errors/index.js';
import pool from '../models/db.js';

const router = Router();
const magicLinkLimiter = rateLimit({ windowMs: 60_000, max: 10, standardHeaders: true, legacyHeaders: false });

router.get('/planning/:planningId', requireManagerAuth, siteScope, async (req, res, next) => {
  try {
    if (!validateUUID(req.params.planningId)) throw new ValidationError('UUID invalide');
    const contrats = await findContratsByPlanning(req.params.planningId, req.siteId);
    res.json({ ok: true, data: contrats });
  } catch (err) {
    next(err);
  }
});

router.get('/:contratId/status', requireManagerAuth, siteScope, async (req, res, next) => {
  try {
    if (!validateUUID(req.params.contratId)) throw new ValidationError('UUID invalide');
    const contrat = await findContratById(req.params.contratId, req.siteId);
    if (!contrat) throw new NotFoundError('Contrat introuvable');
    res.json({ ok: true, data: { silae_status: contrat.silae_status, has_signed: contrat.has_signed } });
  } catch (err) {
    next(err);
  }
});

router.get('/:token', magicLinkLimiter, requireMagicLink('contrat'), async (req, res, next) => {
  try {
    const contrat = await findContratById(req.contratId, req.extra.site_id);
    if (!contrat) throw new NotFoundError('Contrat introuvable');
    res.json({ ok: true, data: { contrat, extra: req.extra } });
  } catch (err) {
    next(err);
  }
});

router.get('/:contratId/pdf', requireManagerAuth, siteScope, async (req, res, next) => {
  try {
    if (!validateUUID(req.params.contratId)) throw new ValidationError('UUID invalide');
    const contrat = await findContratById(req.params.contratId, req.siteId);
    if (!contrat) throw new NotFoundError('Contrat introuvable');
    const extra = await findExtraById(contrat.extra_id, req.siteId);
    const { rows } = await pool.query('SELECT id, nom, siret FROM sites WHERE id = $1', [req.siteId]);
    const site = rows[0];
    const pdfBuffer = await generateContratPDF(contrat, extra, site);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="contrat-${contrat.id}.pdf"`);
    res.send(pdfBuffer);
  } catch (err) {
    next(err);
  }
});

export default router;
