import { verifyToken, JWT_SECRET, JWT_MAGIC_LINK_SECRET } from '../utils/jwt.js';
import { InvalidTokenError, ForbiddenError } from '../errors/index.js';
import pool from '../models/db.js';
import logger from '../logger.js';

/**
 * Verifies JWT from Authorization Bearer header.
 * Attaches req.manager = { manager_id, site_id, role }
 */
export function requireManagerAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next(new InvalidTokenError('Authorization header manquant'));
  }
  const token = authHeader.slice(7);
  try {
    const payload = verifyToken(token, JWT_SECRET);
    req.manager = {
      manager_id: payload.manager_id,
      site_id: payload.site_id,
      role: payload.role,
    };
    return next();
  } catch (err) {
    return next(err);
  }
}

/**
 * Returns middleware that requires a specific manager role.
 * Must run after requireManagerAuth.
 * @param {string} role
 */
export function requireRole(role) {
  return (req, res, next) => {
    if (req.manager?.role !== role) {
      return next(new ForbiddenError('Accès réservé'));
    }
    return next();
  };
}

/**
 * Returns middleware that verifies a magic link JWT from query param `token`.
 * Checks token_version against DB, attaches req.extra.
 * @param {'dispo'|'contrat'} expectedType
 */
export function requireMagicLink(expectedType) {
  return async (req, res, next) => {
    const rawToken = req.query.token || req.params.token;
    if (!rawToken) {
      return next(new InvalidTokenError('Token magic link manquant'));
    }
    let payload;
    try {
      payload = verifyToken(rawToken, JWT_MAGIC_LINK_SECRET);
    } catch (err) {
      return next(err);
    }
    if (payload.type !== expectedType) {
      return next(new ForbiddenError(`Type de token invalide : attendu ${expectedType}`));
    }
    try {
      const { rows } = await pool.query(`
        SELECT e.id, e.token_version, e.nom, e.prenom, e.email
        FROM extras e
        JOIN site_extras se ON se.extra_id = e.id AND se.site_id = $2
        WHERE e.id = $1
      `, [payload.extra_id, payload.site_id]);
      if (rows.length === 0) {
        return next(new InvalidTokenError('Extra introuvable'));
      }
      const extra = rows[0];
      if (extra.token_version !== payload.token_version) {
        return next(new InvalidTokenError('Token révoqué — un lien plus récent a été émis'));
      }
      req.extra = { ...extra, site_id: payload.site_id };
      if (payload.semaines) req.semaines = payload.semaines;
      else if (payload.semaine) req.semaines = [payload.semaine]; // compat tokens anciens
      if (payload.contrat_id) req.contratId = payload.contrat_id;
      return next();
    } catch (err) {
      logger.error({ err, route: req.path, message: 'Erreur vérification magic link' });
      return next(err);
    }
  };
}
