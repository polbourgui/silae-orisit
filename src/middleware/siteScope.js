import { ForbiddenError } from '../errors/index.js';

/**
 * Ensures site_id comes from JWT, never from client.
 * Must be used after requireManagerAuth.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
export default function siteScope(req, res, next) {
  const siteId = req.manager?.site_id;
  if (!siteId) {
    return next(new ForbiddenError('site_id introuvable dans le token'));
  }
  if (
    req.body?.site_id && req.body.site_id !== siteId
  ) {
    return next(new ForbiddenError('Accès cross-site refusé'));
  }
  if (
    req.params?.site_id && req.params.site_id !== siteId
  ) {
    return next(new ForbiddenError('Accès cross-site refusé'));
  }
  req.siteId = siteId;
  return next();
}
