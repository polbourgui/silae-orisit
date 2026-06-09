export const JOURS = ['lundi','mardi','mercredi','jeudi','vendredi','samedi','dimanche'];
export const JOURS_COURT = { lundi:'Lun', mardi:'Mar', mercredi:'Mer', jeudi:'Jeu', vendredi:'Ven', samedi:'Sam', dimanche:'Dim' };

export function authHeader() {
  const t = localStorage.getItem('manager_token');
  return t ? { Authorization: `Bearer ${t}` } : {};
}

export async function apiFetch(path, opts = {}) {
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json', ...authHeader(), ...opts.headers },
    ...opts,
  });
  const json = await res.json();
  if (!json.ok) throw new Error(json.error ?? `Erreur ${res.status}`);
  return json.data;
}

export function isoWeekFromDate(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const y = d.getUTCFullYear();
  const ys = new Date(Date.UTC(y, 0, 1));
  const w = Math.ceil((((d - ys) / 86400000) + 1) / 7);
  return `${y}-W${String(w).padStart(2, '0')}`;
}

export function weekBoundsLabel(isoWeek) {
  const [y, wStr] = isoWeek.split('-W');
  const year = +y, week = +wStr;
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const start = new Date(jan4);
  start.setUTCDate(jan4.getUTCDate() - ((jan4.getUTCDay() || 7) - 1) + (week - 1) * 7);
  const end = new Date(start);
  end.setUTCDate(start.getUTCDate() + 6);
  const fmt = d => d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', timeZone: 'UTC' });
  return `${fmt(start)} → ${fmt(end)}`;
}

export function offsetWeek(isoWeek, delta) {
  const [y, wStr] = isoWeek.split('-W');
  const year = +y, week = +wStr;
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const mon = new Date(jan4);
  mon.setUTCDate(jan4.getUTCDate() - ((jan4.getUTCDay() || 7) - 1) + (week - 1) * 7);
  mon.setUTCDate(mon.getUTCDate() + delta * 7);
  return isoWeekFromDate(mon);
}

export function duration(debut, fin) {
  const [dh, dm] = debut.split(':').map(Number);
  const [fh, fm] = fin.split(':').map(Number);
  let total = (fh * 60 + fm) - (dh * 60 + dm);
  if (total <= 0) total += 24 * 60;
  const h = Math.floor(total / 60), m = total % 60;
  return m ? `${h}h${String(m).padStart(2,'0')}` : `${h}h`;
}

export function jourDate(isoWeek, jour) {
  const [y, wStr] = isoWeek.split('-W');
  const year = +y, week = +wStr;
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const mon = new Date(jan4);
  mon.setUTCDate(jan4.getUTCDate() - ((jan4.getUTCDay() || 7) - 1) + (week - 1) * 7);
  const idx = JOURS.indexOf(jour);
  const d = new Date(mon);
  d.setUTCDate(mon.getUTCDate() + idx);
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
}

export function groupByJour(creneaux, isoWeek) {
  const grouped = [];
  let currentJour = null;
  for (const c of creneaux) {
    if (c.jour !== currentJour) {
      const dateLabel = isoWeek ? jourDate(isoWeek, c.jour) : c.jour;
      grouped.push({ isSeparator: true, jour: c.jour, dateLabel });
      currentJour = c.jour;
    }
    grouped.push({ isSeparator: false, ...c });
  }
  return grouped;
}

export const AVATAR_COLORS = ['#1e40af','#0369a1','#0f766e','#15803d','#7e22ce','#be185d','#b45309','#c2410c'];
export function avatarColor(id) { return AVATAR_COLORS[(id?.charCodeAt(0) ?? 0) % AVATAR_COLORS.length]; }
export function initials(nom, prenom) { return `${prenom?.[0] ?? ''}${nom?.[0] ?? ''}`.toUpperCase(); }
