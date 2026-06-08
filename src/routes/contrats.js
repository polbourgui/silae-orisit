import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { requireManagerAuth, requireMagicLink } from '../middleware/auth.js';
import siteScope from '../middleware/siteScope.js';
import {
  findContratsByPlanning,
  findContratById,
} from '../models/contratsModel.js';
import { generateContratPDF } from '../services/pdfService.js';
import { NotFoundError } from '../errors/index.js';

const router = Router();
const magicLinkLimiter = rateLimit({ windowMs: 60_000, max: 10 });

router.get('/planning/:planningId', requireManagerAuth, siteScope, async (req, res, next) => {
  try {
    const contrats = await findContratsByPlanning(req.params.planningId, req.siteId);
    res.json({ ok: true, data: contrats });
  } catch (err) {
    next(err);
  }
});

router.get('/:contratId/status', requireManagerAuth, siteScope, async (req, res, next) => {
  try {
    const contrat = await findContratById(req.params.contratId, req.siteId);
    if (!contrat) throw new NotFoundError('Contrat introuvable');
    res.json({ ok: true, data: { status: contrat.silae_status, hasSigned: contrat.has_signed } });
  } catch (err) {
    next(err);
  }
});

router.get('/:token/view', magicLinkLimiter, requireMagicLink('contrat'), async (req, res, next) => {
  try {
    const contrat = await findContratById(req.contratId, req.extra.site_id);
    if (!contrat) throw new NotFoundError('Contrat introuvable');
    res.json({ ok: true, data: contrat });
  } catch (err) {
    next(err);
  }
});

router.get('/:contratId/pdf', requireManagerAuth, siteScope, async (req, res, next) => {
  try {
    const contrat = await findContratById(req.params.contratId, req.siteId);
    if (!contrat) throw new NotFoundError('Contrat introuvable');
    const pdfBuffer = await generateContratPDF(contrat, contrat.extra, contrat.site);
    res.set({ 'Content-Type': 'application/pdf', 'Content-Disposition': 'attachment; filename=contrat.pdf' });
    res.send(pdfBuffer);
  } catch (err) {
    next(err);
  }
});

export default router;
