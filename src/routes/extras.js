import { Router } from 'express';
import pool from '../models/db.js';
import { requireManagerAuth } from '../middleware/auth.js';
import siteScope from '../middleware/siteScope.js';
import { findExtrasBySite, findExtraById, updateTokenVersion } from '../models/extrasModel.js';
import { syncExtrasFromSilae } from '../services/silaeService.js';
import { generateMagicLinkToken } from '../utils/jwt.js';
import { sendDispoLink } from '../services/mailService.js';
import { validateUUID, assertRequired } from '../utils/validators.js';
import { buildWeekRange } from '../utils/dates.js';
import { NotFoundError, ValidationError } from '../errors/index.js';
import logger from '../logger.js';

const APP_BASE_URL = process.env.APP_BASE_URL || 'http://localhost:3000';

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

router.put('/:id/blocked', async (req, res, next) => {
  try {
    if (!validateUUID(req.params.id)) throw new ValidationError('UUID invalide');
    const { blocked } = req.body;
    if (typeof blocked !== 'boolean') throw new ValidationError('blocked doit être un booléen');
    const { rows } = await pool.query(
      `UPDATE extras SET is_blocked = $1 WHERE id = $2 AND site_id = $3 RETURNING id, is_blocked`,
      [blocked, req.params.id, req.siteId]
    );
    if (!rows[0]) throw new NotFoundError('Extra introuvable');
    res.json({ ok: true, data: rows[0] });
  } catch (err) { next(err); }
});

// Génère (et envoie si RESEND configuré) un magic link dispo pour un extra
router.post('/:id/send-dispo-link', async (req, res, next) => {
  try {
    if (!validateUUID(req.params.id)) throw new ValidationError('UUID invalide');
    const { semaine, semaine_debut, semaine_fin } = req.body;
    const weekRe = /^\d{4}-W\d{2}$/;
    let semaines;
    if (semaine_debut && semaine_fin) {
      if (!weekRe.test(semaine_debut) || !weekRe.test(semaine_fin)) throw new ValidationError('Format semaine invalide (ex: 2026-W24)');
      semaines = buildWeekRange(semaine_debut, semaine_fin);
      if (semaines.length === 0) throw new ValidationError('Plage de semaines invalide');
    } else if (semaine) {
      if (!weekRe.test(semaine)) throw new ValidationError('Format semaine invalide (ex: 2026-W24)');
      semaines = [semaine];
    } else {
      throw new ValidationError('semaine ou semaine_debut + semaine_fin requis');
    }

    const extra = await findExtraById(req.params.id, req.siteId);
    if (!extra) throw new NotFoundError('Extra introuvable');

    const updated = await updateTokenVersion(extra.id);
    const token = generateMagicLinkToken({
      type: 'dispo',
      extraId: extra.id,
      siteId: req.siteId,
      semaines,
      tokenVersion: updated.token_version,
    });
    const url = `${APP_BASE_URL}/extra.html?token=${token}`;

    const isDev = !process.env.RESEND_API_KEY || process.env.RESEND_API_KEY.startsWith('dev');
    if (!isDev) {
      await sendDispoLink(extra, url);
      logger.info({ message: 'dispo link sent', extra_id: extra.id, semaine });
    }

    res.json({ ok: true, data: { url, sent: !isDev } });
  } catch (err) {
    next(err);
  }
});

export default router;
