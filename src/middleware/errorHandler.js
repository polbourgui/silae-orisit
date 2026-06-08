import logger from '../logger.js';

const IS_PRODUCTION = process.env.NODE_ENV === 'production';

/**
 * Express error handler middleware (4 args required)
 * @param {Error} err
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
export default function errorHandler(err, req, res, next) {
  const status = err.statusCode ?? 500;
  logger.error({
    err: { name: err.name, message: err.message, stack: IS_PRODUCTION ? undefined : err.stack },
    route: req.path,
    method: req.method,
    status,
  });
  res.status(status).json({
    ok: false,
    error: IS_PRODUCTION && status === 500 ? 'Erreur interne du serveur' : err.message,
  });
}
