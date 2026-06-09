/**
 * Returns the current ISO week string, e.g. '2026-W24'
 * @returns {string}
 */
export function getCurrentISOWeek() {
  return getISOWeekString(new Date());
}

/**
 * @param {Date} date
 * @returns {string}
 */
function getISOWeekString(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}

/**
 * Returns start (Monday 00:00) and end (Sunday 23:59:59) for an ISO week string
 * @param {string} isoWeek e.g. '2026-W24'
 * @returns {{ start: Date, end: Date }}
 */
export function getWeekBounds(isoWeek) {
  const [yearStr, weekStr] = isoWeek.split('-W');
  const year = parseInt(yearStr, 10);
  const week = parseInt(weekStr, 10);
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const startOfWeek1 = new Date(jan4);
  startOfWeek1.setUTCDate(jan4.getUTCDate() - ((jan4.getUTCDay() || 7) - 1));
  const start = new Date(startOfWeek1);
  start.setUTCDate(startOfWeek1.getUTCDate() + (week - 1) * 7);
  const end = new Date(start);
  end.setUTCDate(start.getUTCDate() + 6);
  end.setUTCHours(23, 59, 59, 999);
  return { start, end };
}

/**
 * Offsets an ISO week string by n weeks.
 * @param {string} isoWeek e.g. '2026-W24'
 * @param {number} n
 * @returns {string}
 */
export function offsetISOWeek(isoWeek, n) {
  const { start } = getWeekBounds(isoWeek);
  const d = new Date(start);
  d.setUTCDate(d.getUTCDate() + n * 7);
  return getISOWeekString(d);
}

/**
 * Returns all ISO weeks from debut to fin inclusive (max 6).
 * @param {string} debut e.g. '2026-W24'
 * @param {string} fin   e.g. '2026-W27'
 * @returns {string[]}
 */
export function buildWeekRange(debut, fin) {
  const weeks = [];
  let current = debut;
  while (current <= fin && weeks.length < 6) {
    weeks.push(current);
    current = offsetISOWeek(current, 1);
  }
  return weeks;
}

/**
 * Deadline is Thursday 18h of the given ISO week
 * @param {string} semaine e.g. '2026-W24'
 * @returns {boolean}
 */
export function isDeadlinePassed(semaine) {
  const { start } = getWeekBounds(semaine);
  const thursday = new Date(start);
  thursday.setUTCDate(start.getUTCDate() + 3);
  thursday.setUTCHours(18, 0, 0, 0);
  return new Date() > thursday;
}
