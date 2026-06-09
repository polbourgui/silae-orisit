import { ref, computed, watch } from '/vendor/vue.esm-browser.js';
import { apiFetch } from './manager-utils.js';

export function usePlanning({ currentWeek, showAlert, allPostes, activeView }) {
  const pPlanning     = ref(null);
  const pAffectations = ref([]);
  const pExtras       = ref([]);
  const pCreneaux     = ref([]);
  const pLoading      = ref(false);
  const pSaving       = ref(false);
  const pSearchState  = ref({});

  const pIsPublished = computed(() => !!pPlanning.value?.published_at);
  const pNbPourvus   = computed(() => pAffectations.value.length);
  const pNbTotal     = computed(() => pCreneaux.value.reduce((s, c) => s + (c.nb_postes ?? 1), 0));

  const pTableRows = computed(() => {
    const rows = [];
    let lastJour = null;
    for (const c of pCreneaux.value) {
      if (c.jour !== lastJour) { rows.push({ isSep: true, jour: c.jour }); lastJour = c.jour; }
      const nb   = c.nb_postes ?? 1;
      const affs = pAffectations.value.filter(a => a.creneau_id === c.id);
      const poste = c.poste_id ? allPostes.value.find(p => p.id === c.poste_id) : null;
      for (let i = 0; i < nb; i++) {
        const aff   = affs[i] ?? null;
        const extra = aff ? pExtras.value.find(e => e.id === aff.extra_id) : null;
        rows.push({ isSep: false, ...c, slotKey: `${c.id}::${i}`, slotIndex: i, nb, aff, extra, poste });
      }
    }
    return rows;
  });

  async function loadPlanning() {
    pLoading.value = true;
    try {
      const data = await apiFetch(`/plannings/week/${currentWeek.value}`);
      pCreneaux.value     = data.creneaux;
      pExtras.value       = data.extras;
      pPlanning.value     = data.planning;
      pAffectations.value = data.affectations;
      const state = {};
      for (const c of data.creneaux) {
        const nb = c.nb_postes ?? 1;
        for (let i = 0; i < nb; i++) state[`${c.id}::${i}`] = { query: '', open: false, activeIdx: 0, dropRect: null };
      }
      pSearchState.value = state;
    } catch (err) { showAlert('error', err.message); }
    finally { pLoading.value = false; }
  }

  async function proposeAlgo() {
    pSaving.value = true;
    try {
      const data = await apiFetch(`/plannings/week/${currentWeek.value}/propose`, { method: 'POST' });
      pPlanning.value     = data.planning;
      pAffectations.value = data.affectations;
      showAlert('success', `${data.count} affectation(s) proposée(s) par l'algorithme`);
    } catch (err) { showAlert('error', err.message); }
    finally { pSaving.value = false; }
  }

  async function publishPlanning() {
    if (!pPlanning.value) return;
    if (!confirm('Publier le planning ? Les extras recevront un lien pour signer leur contrat.')) return;
    pSaving.value = true;
    try {
      const data = await apiFetch(`/plannings/${pPlanning.value.id}/publish`, { method: 'PUT' });
      pPlanning.value = data;
      showAlert('success', 'Planning publié — envoi des contrats en cours');
    } catch (err) { showAlert('error', err.message); }
    finally { pSaving.value = false; }
  }

  // Détecte les conflits horaires côté client (même logique que le backend)
  function detectConflict(targetCreneau, assignedCreneaux) {
    const JOURS = ['lundi','mardi','mercredi','jeudi','vendredi','samedi','dimanche'];
    const REST = 11 * 60;
    function toAbs(jour, debut, fin) {
      const base = JOURS.indexOf(jour) * 24 * 60;
      const [dh, dm] = debut.split(':').map(Number);
      const [fh, fm] = fin.split(':').map(Number);
      const start = base + dh * 60 + dm;
      let end = base + fh * 60 + fm;
      if (end <= start) end += 24 * 60;
      return { start, end };
    }
    const { start: ns, end: ne } = toAbs(targetCreneau.jour, targetCreneau.heure_debut, targetCreneau.heure_fin);
    for (const c of assignedCreneaux) {
      const { start: es, end: ee } = toAbs(c.jour, c.heure_debut, c.heure_fin);
      if (ns < ee && es < ne) return { type: 'overlap', label: 'chevauchement' };
      const gap = Math.max(ns - ee, es - ne);
      if (gap < REST) {
        const h = Math.floor(gap / 60), m = gap % 60;
        return { type: 'rest', label: `repos ${h}h${m ? String(m).padStart(2,'0') : ''} / 11h` };
      }
    }
    return null;
  }

  function filteredExtras(slotKey) {
    const [creneauId] = slotKey.split('::');
    const state = pSearchState.value[slotKey];
    if (!state) return [];
    const q = state.query.toLowerCase().trim();
    const creneau = pCreneaux.value.find(c => c.id === creneauId);
    const creneauPosteId = creneau?.poste_id ?? null;
    const alreadyAssigned = new Set(pAffectations.value.filter(a => a.creneau_id === creneauId).map(a => a.extra_id));
    return pExtras.value
      .filter(e => !alreadyAssigned.has(e.id))
      .map(e => {
        const assignedCreneaux = pAffectations.value
          .filter(a => a.extra_id === e.id)
          .map(a => pCreneaux.value.find(c => c.id === a.creneau_id))
          .filter(Boolean);
        const conflict = creneau ? detectConflict(creneau, assignedCreneaux) : null;
        return {
          ...e,
          hasDispo:       e.dispo_creneau_ids.includes(creneauId),
          hasFilledDispo: e.dispo_creneau_ids.length > 0,
          hasPoste:       creneauPosteId ? (e.poste_ids ?? []).includes(creneauPosteId) : true,
          conflict,
        };
      })
      .filter(e => q ? `${e.prenom} ${e.nom}`.toLowerCase().includes(q) : e.hasDispo || !e.hasFilledDispo)
      .sort((a, b) => {
        const score = e => (e.conflict ? 50 : 0) + (e.hasDispo ? 0 : (e.hasFilledDispo ? 99 : 2)) + (e.hasPoste ? 0 : 1);
        return score(a) - score(b);
      });
  }

  function openSearch(slotKey, event) {
    if (pIsPublished.value) return;
    const s = pSearchState.value[slotKey];
    if (!s) return;
    const rect = event?.target?.closest?.('.assignee-field')?.getBoundingClientRect?.() ?? event?.target?.getBoundingClientRect?.();
    s.open = true; s.activeIdx = 0;
    if (rect) {
      const DROP_H = 240;
      const spaceBelow = window.innerHeight - rect.bottom;
      const flipUp = spaceBelow < DROP_H && rect.top > DROP_H;
      s.dropRect = {
        left: rect.left, width: rect.width,
        ...(flipUp
          ? { bottom: window.innerHeight - rect.top + window.scrollY, top: 'auto' }
          : { top: rect.bottom + window.scrollY, bottom: 'auto' }),
      };
    } else { s.dropRect = null; }
  }

  function closeSearch(slotKey) {
    const s = pSearchState.value[slotKey];
    if (s) setTimeout(() => { s.open = false; }, 150);
  }

  async function selectExtra(slotKey, extraId) {
    const [creneauId] = slotKey.split('::');
    const s = pSearchState.value[slotKey];
    if (s) { s.open = false; s.query = ''; }
    try {
      await apiFetch(`/plannings/week/${currentWeek.value}/affectation/${creneauId}`, {
        method: 'PUT', body: JSON.stringify({ extra_id: extraId }),
      });
      pAffectations.value = [...pAffectations.value, { creneau_id: creneauId, extra_id: extraId }];
    } catch (err) { showAlert('error', err.message); }
  }

  async function clearExtra(slotKey) {
    const [creneauId] = slotKey.split('::');
    const row = pTableRows.value.find(r => !r.isSep && r.slotKey === slotKey);
    if (!row?.extra) return;
    try {
      await apiFetch(`/plannings/week/${currentWeek.value}/affectation/${creneauId}/${row.extra.id}`, { method: 'DELETE' });
      pAffectations.value = pAffectations.value.filter(a => !(a.creneau_id === creneauId && a.extra_id === row.extra.id));
    } catch (err) { showAlert('error', err.message); }
  }

  function dropStyle(slotKey) {
    const r = pSearchState.value[slotKey]?.dropRect;
    if (!r) return {};
    return {
      position: 'fixed',
      left: r.left + 'px',
      width: r.width + 'px',
      top: r.top !== 'auto' ? r.top + 'px' : 'auto',
      bottom: (r.bottom !== undefined && r.bottom !== 'auto') ? r.bottom + 'px' : 'auto',
      zIndex: 200,
    };
  }

  watch(currentWeek, () => { if (activeView.value === 'planning') loadPlanning(); });

  return {
    pPlanning, pIsPublished, pLoading, pSaving,
    pCreneaux, pExtras, pAffectations,
    pTableRows, pNbPourvus, pNbTotal, pSearchState,
    loadPlanning, proposeAlgo, publishPlanning,
    filteredExtras, openSearch, closeSearch, selectExtra, clearExtra, dropStyle,
  };
}
