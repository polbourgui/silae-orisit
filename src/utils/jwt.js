import jwt from 'jsonwebtoken';
import 'dotenv/config';
import { InvalidTokenError } from '../errors/index.js';

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_MAGIC_LINK_SECRET = process.env.JWT_MAGIC_LINK_SECRET;

if (!JWT_SECRET || !JWT_MAGIC_LINK_SECRET) {
  throw new Error('JWT_SECRET and JWT_MAGIC_LINK_SECRET must be set in env');
}

/**
 * @param {{ manager_id: string, site_id: string, role: string }} manager
 * @returns {string}
 */
export function generateManagerToken(manager) {
  return jwt.sign(
    { manager_id: manager.manager_id, site_id: manager.site_id, role: manager.role },
    JWT_SECRET,
    { expiresIn: '8h' }
  );
}

/**
 * @param {{ type: string, extraId: string, siteId: string, semaine?: string, contratId?: string }} opts
 * @returns {string}
 */
export function generateMagicLinkToken({ type, extraId, siteId, semaine, contratId }) {
  const expiresIn = type === 'contrat' ? '7d' : '48h';
  const payload = {
    type,
    extra_id: extraId,
    site_id: siteId,
    ...(semaine ? { semaine } : {}),
    ...(contratId ? { contrat_id: contratId } : {}),
  };
  return jwt.sign(payload, JWT_MAGIC_LINK_SECRET, { expiresIn });
}

/**
 * @param {string} token
 * @param {string} secret
 * @returns {object}
 */
export function verifyToken(token, secret) {
  try {
    return jwt.verify(token, secret);
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      throw new InvalidTokenError('Token expiré');
    }
    throw new InvalidTokenError('Token invalide');
  }
}

export { JWT_SECRET, JWT_MAGIC_LINK_SECRET };
