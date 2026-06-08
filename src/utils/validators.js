import { ValidationError } from '../errors/index.js';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * @param {*} val
 * @returns {boolean}
 */
export function validateUUID(val) {
  return typeof val === 'string' && UUID_REGEX.test(val);
}

/**
 * @param {object} obj
 * @param {string[]} fields
 * @throws {ValidationError}
 */
export function assertRequired(obj, fields) {
  const missing = fields.filter((f) => obj[f] === undefined || obj[f] === null || obj[f] === '');
  if (missing.length > 0) {
    throw new ValidationError(`Champs requis manquants : ${missing.join(', ')}`);
  }
}
