import { Router } from 'express';
import bcrypt from 'bcrypt';
import rateLimit from 'express-rate-limit';
import pool from '../models/db.js';
import { generateManagerToken } from '../utils/jwt.js';
import { requireManagerAuth } from '../middleware/auth.js';
import { assertRequired } from '../utils/validators.js';
import { ValidationError } from '../errors/index.js';
import logger from '../logger.js';

const router = Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, error: 'Trop de tentatives de connexion, réessayez dans 15 minutes' },
});

router.post('/login', loginLimiter, async (req, res, next) => {
  try {
    assertRequired(req.body, ['email', 'password']);
    const { email, password } = req.body;
    const { rows } = await pool.query(
      'SELECT id, site_id, email, password_hash, role FROM managers WHERE email = $1',
      [email]
    );
    // Toujours comparer (temps constant) même si l'email n'existe pas — anti timing attack
    const dummyHash = '$2b$12$invaliddummyhashtopreventtimingattack000000000000000000';
    const manager = rows[0] ?? null;
    const valid = await bcrypt.compare(password, manager?.password_hash ?? dummyHash);
    if (!manager || !valid) {
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
