import { Router } from 'express';
import { requireManagerAuth } from '../middleware/auth.js';
import siteScope from '../middleware/siteScope.js';
import pool from '../models/db.js';
import { validateUUID, assertRequired } from '../utils/validators.js';
import { NotFoundError, ValidationError } from '../errors/index.js';

const router = Router();
router.use(requireManagerAuth, siteScope);

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const COLS = 'id, site_id, label, slot_label, heure_debut, heure_fin, sort_order';

router.get('/', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT ${COLS} FROM presets WHERE site_id = $1 ORDER BY sort_order, label`,
      [req.siteId]
    );
    res.json({ ok: true, data: rows });
  } catch (err) { next(err); }
});

router.post('/', async (req, res, next) => {
  try {
    assertRequired(req.body, ['label', 'slot_label', 'heure_debut', 'heure_fin']);
    const { label, slot_label, heure_debut, heure_fin } = req.body;
    if (!label.trim() || !slot_label.trim()) throw new ValidationError('label et slot_label requis');
    if (!TIME_RE.test(heure_debut) || !TIME_RE.test(heure_fin)) throw new ValidationError('Heures au format HH:MM');
    if (heure_debut === heure_fin) throw new ValidationError('Heures identiques');
    const { rows: [maxRow] } = await pool.query(
      'SELECT COALESCE(MAX(sort_order),0)+1 AS next FROM presets WHERE site_id = $1', [req.siteId]
    );
    const { rows } = await pool.query(
      `INSERT INTO presets (site_id, label, slot_label, heure_debut, heure_fin, sort_order)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING ${COLS}`,
      [req.siteId, label.trim(), slot_label.trim(), heure_debut, heure_fin, maxRow.next]
    );
    res.status(201).json({ ok: true, data: rows[0] });
  } catch (err) { next(err); }
});

router.delete('/:id', async (req, res, next) => {
  try {
    if (!validateUUID(req.params.id)) throw new ValidationError('UUID invalide');
    const { rowCount } = await pool.query(
      'DELETE FROM presets WHERE id = $1 AND site_id = $2', [req.params.id, req.siteId]
    );
    if (!rowCount) throw new NotFoundError('Préset introuvable');
    res.json({ ok: true });
  } catch (err) { next(err); }
});

export default router;
