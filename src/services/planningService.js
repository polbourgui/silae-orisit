const REST_MINUTES_REQUIRED = 11 * 60;
const JOURS_ORDER = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];

function timeToMinutes(timeStr) {
  const [h, m] = timeStr.split(':').map(Number);
  return h * 60 + m;
}

// Retourne les minutes absolues depuis lundi 00:00, en tenant compte des shifts de nuit
function absoluteMinutes(jour, heureDebut, heureFin) {
  const dayOffset = (JOURS_ORDER.indexOf(jour) ?? 0) * 24 * 60;
  const start = dayOffset + timeToMinutes(heureDebut);
  let end = dayOffset + timeToMinutes(heureFin);
  if (end <= start) end += 24 * 60; // shift de nuit (ex. 22:30 → 06:00)
  return { start, end };
}

function violatesRestRule(assignedCreneaux, creneau) {
  const { start: newStart, end: newEnd } = absoluteMinutes(creneau.jour, creneau.heure_debut, creneau.heure_fin);
  for (const c of assignedCreneaux) {
    const { start: existStart, end: existEnd } = absoluteMinutes(c.jour, c.heure_debut, c.heure_fin);
    // Chevauchement direct → violation immédiate
    if (newStart < existEnd && existStart < newEnd) return true;
    // Pour deux shifts non-chevauchants, un seul gap est positif (l'autre est négatif).
    // Il suffit qu'un seul côté soit >= 11h : le positif est le vrai gap entre les deux.
    const gapAfter  = newStart - existEnd;
    const gapBefore = existStart - newEnd;
    const hasEnoughRest = gapAfter >= REST_MINUTES_REQUIRED || gapBefore >= REST_MINUTES_REQUIRED;
    if (!hasEnoughRest) return true;
  }
  return false;
}

/**
 * Vérifie si l'ajout d'un extra à un créneau crée un conflit avec ses affectations existantes.
 * @param {object} newCreneau - Le créneau à affecter
 * @param {object[]} assignedCreneaux - Les créneaux déjà affectés à cet extra cette semaine
 * @returns {{ type: 'overlap'|'rest', message: string }|null}
 */
export function checkAffectationConflict(newCreneau, assignedCreneaux) {
  const { start: newStart, end: newEnd } = absoluteMinutes(newCreneau.jour, newCreneau.heure_debut, newCreneau.heure_fin);
  for (const c of assignedCreneaux) {
    const { start: existStart, end: existEnd } = absoluteMinutes(c.jour, c.heure_debut, c.heure_fin);
    const overlaps = newStart < existEnd && existStart < newEnd;
    if (overlaps) {
      return { type: 'overlap', message: `Cet extra est déjà affecté à un créneau qui chevauche cet horaire (${c.heure_debut}–${c.heure_fin} ${c.jour})` };
    }
    const gapAfter  = newStart - existEnd;
    const gapBefore = existStart - newEnd;
    const hasEnoughRest = gapAfter >= REST_MINUTES_REQUIRED || gapBefore >= REST_MINUTES_REQUIRED;
    if (!hasEnoughRest) {
      const gapMin = Math.max(gapAfter, gapBefore);
      const gapH   = Math.floor(Math.abs(gapMin) / 60);
      const gapM   = Math.abs(gapMin) % 60;
      const gapStr = gapM ? `${gapH}h${String(gapM).padStart(2,'0')}` : `${gapH}h`;
      return { type: 'rest', message: `Temps de repos insuffisant avec le créneau ${c.heure_debut}–${c.heure_fin} ${c.jour} (${gapStr} au lieu de 11h minimum)` };
    }
  }
  return null;
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
  const result = [];

  // Extras ayant soumis au moins une dispo (ont répondu)
  const extrasHavingResponded = new Set(disponibilites.map((d) => d.extra_id));

  // Score de tri : poste correspondant = -1000 (priorité maximale), puis heures croissantes
  const sortScore = (extra, creneauPosteId) => {
    const hasMatchingPoste = creneauPosteId && (extra.poste_ids ?? []).includes(creneauPosteId);
    return (hasMatchingPoste ? -1000 : 0) + (hoursAssigned.get(extra.id) ?? 0);
  };

  // Priorité : 1) dispo explicite, 2) pas répondu, 3) non dispo (exclus)
  const candidatesForCreneau = (creneauId, creneauPosteId) => {
    const dispoIds = new Set(
      disponibilites.filter((d) => d.creneau_id === creneauId).map((d) => d.extra_id)
    );
    const dispo     = extras.filter((e) => dispoIds.has(e.id));
    const noReponse = extras.filter((e) => !extrasHavingResponded.has(e.id));
    const byScore   = (a, b) => sortScore(a, creneauPosteId) - sortScore(b, creneauPosteId);
    return [...dispo.sort(byScore), ...noReponse.sort(byScore)];
  };

  for (const creneau of creneaux) {
    const nb = creneau.nb_postes ?? 1;
    let assigned = 0;
    const candidates = candidatesForCreneau(creneau.id, creneau.poste_id);
    for (const extra of candidates) {
      if (assigned >= nb) break;
      if (assignedPerExtra.get(extra.id).some((c) => c.id === creneau.id)) continue;
      if (violatesRestRule(assignedPerExtra.get(extra.id), creneau)) continue;
      let durationMins = timeToMinutes(creneau.heure_fin) - timeToMinutes(creneau.heure_debut);
      if (durationMins <= 0) durationMins += 24 * 60;
      const durationH = durationMins / 60;
      hoursAssigned.set(extra.id, (hoursAssigned.get(extra.id) ?? 0) + durationH);
      assignedPerExtra.get(extra.id).push(creneau);
      result.push({ extra_id: extra.id, creneau_id: creneau.id });
      assigned++;
    }
  }
  return result;
}
