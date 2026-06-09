import { ref, computed } from '/vendor/vue.esm-browser.js';
import { apiFetch, isoWeekFromDate, weekBoundsLabel, offsetWeek } from './manager-utils.js';

export function useExtras({ showAlert, allPostes }) {
  const eExtras         = ref([]);
  const eLoading        = ref(false);
  const eLinkModal      = ref(null);
  const eLinkWeek       = ref(isoWeekFromDate(new Date()));
  const eLinkPeriode    = ref('semaine'); // 'semaine' | 'mois'
  const eLinkWeekLabel  = computed(() => eLinkWeek.value.replace('-W', ' — Semaine '));
  const eLinkWeekBounds = computed(() => {
    if (eLinkPeriode.value === 'semaine') return weekBoundsLabel(eLinkWeek.value);
    const fin = offsetWeek(eLinkWeek.value, 3);
    const debutLabel = weekBoundsLabel(eLinkWeek.value).split(' → ')[0];
    const finLabel   = weekBoundsLabel(fin).split(' → ')[1];
    return `${debutLabel} → ${finLabel}`;
  });
  const eLinkPeriodeLabel = computed(() => {
    if (eLinkPeriode.value === 'semaine') return eLinkWeekLabel.value;
    const fin = offsetWeek(eLinkWeek.value, 3);
    return `${eLinkWeekLabel.value} → Semaine ${fin.split('-W')[1]}`;
  });
  const eFilterPoste    = ref('');
  const eFilteredExtras = computed(() => {
    if (!eFilterPoste.value) return eExtras.value;
    return eExtras.value.filter(e => (e.poste_ids ?? []).includes(eFilterPoste.value));
  });
  const eSending        = ref({});

  const eSelected       = ref(new Set());
  const eBulkPostesOpen = ref(false);
  const eBulkPosteIds   = ref(new Set());
  const eBulkSaving     = ref(false);
  const eExtraPostes    = ref({});
  const ePostesSaving   = ref({});

  const eAllSelected   = computed(() => eFilteredExtras.value.length > 0 && eFilteredExtras.value.every(e => eSelected.value.has(e.id)));
  const eSelectedExtras = computed(() => eExtras.value.filter(e => eSelected.value.has(e.id)));

  function eToggleAll() {
    const visibleIds = eFilteredExtras.value.map(e => e.id);
    const allChecked = visibleIds.every(id => eSelected.value.has(id));
    const s = new Set(eSelected.value);
    if (allChecked) visibleIds.forEach(id => s.delete(id));
    else visibleIds.forEach(id => s.add(id));
    eSelected.value = s;
  }

  function eToggle(id) {
    const s = new Set(eSelected.value);
    if (s.has(id)) s.delete(id); else s.add(id);
    eSelected.value = s;
  }

  async function loadExtras() {
    eLoading.value = true;
    try { eExtras.value = await apiFetch('/extras'); }
    catch (err) { showAlert('error', err.message); }
    finally { eLoading.value = false; }
  }

  async function sendDispoLink(extra) {
    eSending.value = { ...eSending.value, [extra.id]: true };
    try {
      const body = eLinkPeriode.value === 'mois'
        ? { semaine_debut: eLinkWeek.value, semaine_fin: offsetWeek(eLinkWeek.value, 3) }
        : { semaine: eLinkWeek.value };
      const data = await apiFetch(`/extras/${extra.id}/send-dispo-link`, {
        method: 'POST', body: JSON.stringify(body),
      });
      eLinkModal.value = { extra, semaine: eLinkWeek.value, url: data.url, sent: data.sent };
    } catch (err) { showAlert('error', err.message); }
    finally { eSending.value = { ...eSending.value, [extra.id]: false }; }
  }

  async function eSendBulk() {
    for (const id of [...eSelected.value]) {
      const extra = eExtras.value.find(e => e.id === id);
      if (extra) await sendDispoLink(extra);
    }
  }

  function eOpenBulkPostes() {
    const selected = eSelectedExtras.value;
    if (!selected.length) return;
    const first = eExtraPostes.value[selected[0].id] ?? new Set();
    eBulkPosteIds.value = new Set([...first].filter(pid =>
      selected.every(e => (eExtraPostes.value[e.id] ?? new Set()).has(pid))
    ));
    eBulkPostesOpen.value = true;
  }

  async function eSaveBulkPostes() {
    eBulkSaving.value = true;
    try {
      for (const extraId of [...eSelected.value]) {
        await apiFetch(`/postes/extra/${extraId}`, { method: 'PUT', body: JSON.stringify({ poste_ids: [...eBulkPosteIds.value] }) });
        eExtraPostes.value = { ...eExtraPostes.value, [extraId]: new Set(eBulkPosteIds.value) };
      }
      eBulkPostesOpen.value = false;
      showAlert('success', `Compétences mises à jour pour ${eSelected.value.size} extra(s)`);
    } catch (err) { showAlert('error', err.message); }
    finally { eBulkSaving.value = false; }
  }

  async function eSaveBulkBlocked(blocked) {
    eBulkSaving.value = true;
    try {
      const ids = [...eSelected.value];
      for (const id of ids) {
        await apiFetch(`/extras/${id}/blocked`, { method: 'PUT', body: JSON.stringify({ blocked }) });
      }
      await loadExtras();
      eSelected.value = new Set();
      showAlert('success', `${ids.length} extra(s) ${blocked ? 'bloqué(s)' : 'débloqué(s)'}`);
    } catch (err) { showAlert('error', err.message); }
    finally { eBulkSaving.value = false; }
  }

  async function loadExtraPostes(extraId) {
    try {
      const data = await apiFetch(`/postes/extra/${extraId}`);
      eExtraPostes.value = { ...eExtraPostes.value, [extraId]: new Set(data.map(p => p.id)) };
    } catch (err) { showAlert('error', err.message); }
  }

  async function toggleExtraPoste(extraId, posteId) {
    const current = eExtraPostes.value[extraId] ?? new Set();
    const updated = new Set(current);
    if (updated.has(posteId)) updated.delete(posteId); else updated.add(posteId);
    eExtraPostes.value   = { ...eExtraPostes.value, [extraId]: updated };
    ePostesSaving.value  = { ...ePostesSaving.value, [extraId]: true };
    try {
      await apiFetch(`/postes/extra/${extraId}`, { method: 'PUT', body: JSON.stringify({ poste_ids: [...updated] }) });
    } catch (err) { showAlert('error', err.message); }
    finally { ePostesSaving.value = { ...ePostesSaving.value, [extraId]: false }; }
  }

  return {
    eExtras, eFilteredExtras, eFilterPoste,
    eLoading, eLinkModal, eLinkWeek, eLinkPeriode, eLinkPeriodeLabel, eLinkWeekLabel, eLinkWeekBounds, eSending,
    eLinkPrevWeek: () => { eLinkWeek.value = offsetWeek(eLinkWeek.value, -1); },
    eLinkNextWeek: () => { eLinkWeek.value = offsetWeek(eLinkWeek.value, +1); },
    eSelected, eAllSelected, eToggleAll, eToggle, eSelectedExtras,
    eBulkPostesOpen, eBulkPosteIds, eBulkSaving,
    eExtraPostes, ePostesSaving,
    loadExtras, sendDispoLink, eSendBulk, eOpenBulkPostes, eSaveBulkPostes, eSaveBulkBlocked,
    loadExtraPostes, toggleExtraPoste,
  };
}
