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
    message: `${req.method} ${req.path} → ${status}: ${err.message}`,
    name: err.name,
    stack: IS_PRODUCTION ? undefined : err.stack,
    status,
  });
  res.status(status).json({
    ok: false,
    error: IS_PRODUCTION && status === 500 ? 'Erreur interne du serveur' : err.message,
  });
}
