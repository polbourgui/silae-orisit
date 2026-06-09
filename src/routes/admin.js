import { Router } from 'express';
import bcrypt from 'bcrypt';
import pool from '../models/db.js';
import { createSite } from '../models/sitesModel.js';
import { requireManagerAuth, requireRole } from '../middleware/auth.js';
import { validateUUID, assertRequired } from '../utils/validators.js';
import { NotFoundError, ValidationError } from '../errors/index.js';
import logger from '../logger.js';

const router = Router();
router.use(requireManagerAuth, requireRole('superadmin'));

const SIRET_RE = /^\d{14}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function assertSiret(siret) {
  if (!SIRET_RE.test(siret)) throw new ValidationError('Le SIRET doit comporter exactement 14 chiffres');
}

function assertManagerFields({ email, password }) {
  if (!EMAIL_RE.test(email)) throw new ValidationError('Email invalide');
  if (typeof password !== 'string' || password.length < 8) {
    throw new ValidationError('Le mot de passe doit comporter au moins 8 caractères');
  }
}

// Liste des sites avec compteurs (managers, extras)
router.get('/sites', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT s.id, s.nom, s.siret, s.created_at,
              COUNT(DISTINCT m.id) AS nb_managers,
              COUNT(DISTINCT e.id) AS nb_extras
       FROM sites s
       LEFT JOIN managers m ON m.site_id = s.id
       LEFT JOIN extras e ON e.site_id = s.id
       GROUP BY s.id
       ORDER BY s.nom`
    );
    res.json({ ok: true, data: rows });
  } catch (err) {
    next(err);
  }
});

// Création d'un site, avec premier manager optionnel
router.post('/sites', async (req, res, next) => {
  try {
    assertRequired(req.body, ['nom', 'siret']);
    assertSiret(req.body.siret);
    const { manager } = req.body;
    if (manager) {
      assertRequired(manager, ['email', 'password']);
      assertManagerFields(manager);
      const { rows } = await pool.query('SELECT id FROM managers WHERE email = $1', [manager.email]);
      if (rows.length > 0) throw new ValidationError(`Un manager existe déjà avec l'email ${manager.email}`);
    }
    const site = await createSite(req.body.nom, req.body.siret);
    if (manager) {
      const hash = await bcrypt.hash(manager.password, 12);
      await pool.query(
        'INSERT INTO managers (site_id, email, password_hash, role) VALUES ($1, $2, $3, $4)',
        [site.id, manager.email, hash, 'manager']
      );
    }
    logger.info({ message: 'Site créé via admin', site_id: site.id, by: req.manager.manager_id });
    res.status(201).json({ ok: true, data: site });
  } catch (err) {
    next(err);
  }
});

// Modification nom / siret
router.patch('/sites/:id', async (req, res, next) => {
  try {
    if (!validateUUID(req.params.id)) throw new ValidationError('UUID invalide');
    assertRequired(req.body, ['nom', 'siret']);
    assertSiret(req.body.siret);
    const { rows } = await pool.query(
      'UPDATE sites SET nom = $1, siret = $2 WHERE id = $3 RETURNING id, nom, siret, created_at',
      [req.body.nom.trim(), req.body.siret.trim(), req.params.id]
    );
    if (rows.length === 0) throw new NotFoundError('Site introuvable');
    res.json({ ok: true, data: rows[0] });
  } catch (err) {
    next(err);
  }
});

// Managers d'un site
router.get('/sites/:id/managers', async (req, res, next) => {
  try {
    if (!validateUUID(req.params.id)) throw new ValidationError('UUID invalide');
    const { rows } = await pool.query(
      'SELECT id, email, role, created_at FROM managers WHERE site_id = $1 ORDER BY email',
      [req.params.id]
    );
    res.json({ ok: true, data: rows });
  } catch (err) {
    next(err);
  }
});

// Ajout d'un manager à un site
router.post('/sites/:id/managers', async (req, res, next) => {
  try {
    if (!validateUUID(req.params.id)) throw new ValidationError('UUID invalide');
    assertRequired(req.body, ['email', 'password']);
    assertManagerFields(req.body);
    const { rows: site } = await pool.query('SELECT id FROM sites WHERE id = $1', [req.params.id]);
    if (site.length === 0) throw new NotFoundError('Site introuvable');
    const { rows: existing } = await pool.query('SELECT id FROM managers WHERE email = $1', [req.body.email]);
    if (existing.length > 0) throw new ValidationError(`Un manager existe déjà avec l'email ${req.body.email}`);
    const hash = await bcrypt.hash(req.body.password, 12);
    const { rows } = await pool.query(
      `INSERT INTO managers (site_id, email, password_hash, role)
       VALUES ($1, $2, $3, 'manager')
       RETURNING id, email, role, created_at`,
      [req.params.id, req.body.email, hash]
    );
    logger.info({ message: 'Manager créé via admin', manager_id: rows[0].id, site_id: req.params.id, by: req.manager.manager_id });
    res.status(201).json({ ok: true, data: rows[0] });
  } catch (err) {
    next(err);
  }
});

// Suppression d'un manager (pas soi-même)
router.delete('/managers/:id', async (req, res, next) => {
  try {
    if (!validateUUID(req.params.id)) throw new ValidationError('UUID invalide');
    if (req.params.id === req.manager.manager_id) {
      throw new ValidationError('Impossible de supprimer son propre compte');
    }
    const { rowCount } = await pool.query('DELETE FROM managers WHERE id = $1', [req.params.id]);
    if (rowCount === 0) throw new NotFoundError('Manager introuvable');
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

export default router;
