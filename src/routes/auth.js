import { Router } from 'express';
import pool from '../models/db.js';
import { generateManagerToken } from '../utils/jwt.js';
import { requireManagerAuth } from '../middleware/auth.js';
import { assertRequired } from '../utils/validators.js';
import { ValidationError } from '../errors/index.js';
import logger from '../logger.js';

const router = Router();

router.post('/login', async (req, res, next) => {
  try {
    assertRequired(req.body, ['email', 'password']);
    const { email, password } = req.body;
    const { rows } = await pool.query(
      'SELECT id, site_id, email, password_hash, role FROM managers WHERE email = $1',
      [email]
    );
    if (rows.length === 0) {
      throw new ValidationError('Email ou mot de passe invalide');
    }
    const manager = rows[0];
    const { createHash } = await import('node:crypto');
    const hash = createHash('sha256').update(password).digest('hex');
    if (hash !== manager.password_hash) {
      throw new ValidationError('Email ou mot de passe invalide');
    }
    const token = generateManagerToken({ manager_id: manager.id, site_id: manager.site_id, role: manager.role });
    logger.info({ message: 'Manager login', manager_id: manager.id });
    res.json({ ok: true, data: { token } });
  } catch (err) {
    next(err);
  }
});

router.get('/me', requireManagerAuth, (req, res) => {
  res.json({ ok: true, data: req.manager });
});

export default router;
