const REST_MINUTES_REQUIRED = 11 * 60;

/**
 * Parses "HH:MM" into minutes since midnight
 * @param {string} timeStr
 * @returns {number}
 */
function timeToMinutes(timeStr) {
  const [h, m] = timeStr.split(':').map(Number);
  return h * 60 + m;
}

/**
 * Checks if an extra already has a creneau overlapping the 11h rest rule
 * @param {object[]} assignedCreneaux
 * @param {object} creneau
 * @returns {boolean}
 */
function violatesRestRule(assignedCreneaux, creneau) {
  const newStart = timeToMinutes(creneau.heure_debut);
  const newEnd = timeToMinutes(creneau.heure_fin);
  for (const c of assignedCreneaux) {
    const existStart = timeToMinutes(c.heure_debut);
    const existEnd = timeToMinutes(c.heure_fin);
    const gapAfter = newStart - existEnd;
    const gapBefore = existStart - newEnd;
    const hasEnoughRest = gapAfter >= REST_MINUTES_REQUIRED || gapBefore >= REST_MINUTES_REQUIRED;
    if (!hasEnoughRest) return true;
  }
  return false;
}

/**
 * Greedy scheduler: assigns extras to creneaux.
 * Rules: no double booking, only available extras, 11h rest between shifts.
 * Priority: ascending nb heures already assigned.
 *
 * @param {Array<{ id: string }>} extras
 * @param {Array<{ id: string, heure_debut: string, heure_fin: string }>} creneaux
 * @param {Array<{ extra_id: string, creneau_id: string }>} disponibilites
 * @returns {Array<{ extra_id: string, creneau_id: string }>}
 */
export function greedyScheduler(extras, creneaux, disponibilites) {
  const hoursAssigned = new Map(extras.map((e) => [e.id, 0]));
  const assignedPerExtra = new Map(extras.map((e) => [e.id, []]));
  const bookedCreneaux = new Set();
  const result = [];

  const availableExtrasForCreneau = (creneauId) => {
    const dispoExtraIds = new Set(
      disponibilites.filter((d) => d.creneau_id === creneauId).map((d) => d.extra_id)
    );
    return extras
      .filter((e) => dispoExtraIds.has(e.id))
      .sort((a, b) => (hoursAssigned.get(a.id) ?? 0) - (hoursAssigned.get(b.id) ?? 0));
  };

  for (const creneau of creneaux) {
    const candidates = availableExtrasForCreneau(creneau.id);
    for (const extra of candidates) {
      const alreadyBooked = assignedPerExtra.get(extra.id).some((c) => c.id === creneau.id);
      if (alreadyBooked) continue;
      if (violatesRestRule(assignedPerExtra.get(extra.id), creneau)) continue;
      const durationH = (timeToMinutes(creneau.heure_fin) - timeToMinutes(creneau.heure_debut)) / 60;
      hoursAssigned.set(extra.id, (hoursAssigned.get(extra.id) ?? 0) + durationH);
      assignedPerExtra.get(extra.id).push(creneau);
      bookedCreneaux.add(creneau.id);
      result.push({ extra_id: extra.id, creneau_id: creneau.id });
      break;
    }
  }
  return result;
}
