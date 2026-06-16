import { ref, computed, watch, onMounted } from '/vendor/vue.esm-browser.js';
import { JOURS, apiFetch, weekBoundsLabel, offsetWeek, groupByJour } from './manager-utils.js';

export function useCreneaux({ currentWeek, showAlert }) {
  const creneaux        = ref([]);
  const postes          = ref([]);
  const pointsDeVente   = ref([]);
  const loading         = ref(false);
  const saving          = ref(false);
  const form            = ref({ slot_label: '', heure_debut: '', heure_fin: '', poste_id: '', point_de_vente_id: '', nb_postes: 1, jours: ['lundi'] });
  const formErrors  = ref({});
  const csvRows     = ref([]);
  const csvParsed   = ref(false);
  const presets         = ref([]);
  const presetsEditOpen = ref(false);
  const presetForm      = ref({ label: '', slot_label: '', heure_debut: '', heure_fin: '' });
  const presetSaving    = ref(false);

  const weekLabel   = computed(() => currentWeek.value.replace('-W', ' — Semaine '));
  const boundsLabel = computed(() => weekBoundsLabel(currentWeek.value));
  const tableRows   = computed(() => groupByJour(creneaux.value, currentWeek.value));
  const totalHeures = computed(() =>
    creneaux.value.reduce((sum, c) => {
      const [dh, dm] = c.heure_debut.split(':').map(Number);
      const [fh, fm] = c.heure_fin.split(':').map(Number);
      let mins = (fh * 60 + fm) - (dh * 60 + dm);
      if (mins <= 0) mins += 24 * 60;
      return sum + (mins / 60) * (c.nb_postes ?? 1);
    }, 0).toFixed(1)
  );

  async function loadWeek() {
    loading.value = true;
    try {
      const data = await apiFetch(`/creneaux/semaine/${currentWeek.value}`);
      creneaux.value      = data.creneaux;
      postes.value        = data.postes;
      pointsDeVente.value = data.pointsDeVente ?? [];
    } catch (err) { showAlert('error', err.message); }
    finally { loading.value = false; }
  }

  async function loadPresets() {
    try { presets.value = await apiFetch('/presets'); }
    catch (err) { showAlert('error', err.message); }
  }

  function toggleJour(jour) {
    const idx = form.value.jours.indexOf(jour);
    if (idx === -1) form.value.jours.push(jour);
    else if (form.value.jours.length > 1) form.value.jours.splice(idx, 1);
  }

  function validateForm(f) {
    const errors = {};
    if (!f.slot_label.trim()) errors.slot_label = 'Libellé requis';
    const re = /^([01]\d|2[0-3]):[0-5]\d$/;
    if (!re.test(f.heure_debut)) errors.heure_debut = 'Format HH:MM';
    if (!re.test(f.heure_fin))   errors.heure_fin   = 'Format HH:MM';
    if (!errors.heure_debut && !errors.heure_fin && f.heure_debut === f.heure_fin)
      errors.heure_fin = "Identique à l'heure de début";
    if (!f.jours.length) errors.jours = 'Sélectionnez au moins un jour';
    return errors;
  }

  async function addCreneau() {
    formErrors.value = validateForm(form.value);
    if (Object.keys(formErrors.value).length) return;
    saving.value = true;
    try {
      const toAdd = [...form.value.jours].sort((a, b) => JOURS.indexOf(a) - JOURS.indexOf(b));
      const created = [];
      for (const jour of toAdd) {
        const c = await apiFetch(`/creneaux/semaine/${currentWeek.value}`, {
          method: 'POST',
          body: JSON.stringify({
            jour,
            slot_label:  form.value.slot_label.trim(),
            heure_debut: form.value.heure_debut,
            heure_fin:   form.value.heure_fin,
            poste_id:            form.value.poste_id || null,
            point_de_vente_id:   form.value.point_de_vente_id || null,
            nb_postes:           form.value.nb_postes || 1,
          }),
        });
        created.push(c);
      }
      creneaux.value = [...creneaux.value, ...created].sort((a, b) =>
        JOURS.indexOf(a.jour) - JOURS.indexOf(b.jour) || a.heure_debut.localeCompare(b.heure_debut)
      );
      showAlert('success', toAdd.length > 1 ? `${toAdd.length} créneaux ajoutés` : 'Créneau ajouté');
      form.value.slot_label = ''; form.value.poste_id = ''; form.value.point_de_vente_id = '';
    } catch (err) { showAlert('error', err.message); }
    finally { saving.value = false; }
  }

  function applyPreset(p) {
    form.value.slot_label  = p.slot_label;
    form.value.heure_debut = p.heure_debut;
    form.value.heure_fin   = p.heure_fin;
    formErrors.value = {};
  }

  async function deleteCreneau(id) {
    if (!confirm('Supprimer ce créneau ?')) return;
    try {
      await apiFetch(`/creneaux/semaine/${currentWeek.value}/${id}`, { method: 'DELETE' });
      creneaux.value = creneaux.value.filter(c => c.id !== id);
      showAlert('success', 'Créneau supprimé');
    } catch (err) { showAlert('error', err.message); }
  }

  function parseCSV(text) {
    return text.trim().split('\n').filter(l => l.trim()).map(line => {
      const [jour, slot_label, heure_debut, heure_fin, poste_id] =
        line.split(';').map(s => s.trim().replace(/^"|"$/g, ''));
      return { jour: jour || 'lundi', slot_label, heure_debut, heure_fin, poste_id: poste_id || '' };
    }).filter(r => r.slot_label);
  }

  function onFileChange(e) {
    const f = e.target.files[0]; if (!f) return;
    const r = new FileReader();
    r.onload = ev => { csvRows.value = parseCSV(ev.target.result); csvParsed.value = true; };
    r.readAsText(f);
  }

  function onDrop(e) {
    const f = e.dataTransfer.files[0]; if (!f) return;
    const r = new FileReader();
    r.onload = ev => { csvRows.value = parseCSV(ev.target.result); csvParsed.value = true; };
    r.readAsText(f);
  }

  function cancelImport() { csvRows.value = []; csvParsed.value = false; }

  async function confirmImport() {
    saving.value = true;
    try {
      const result = await apiFetch(`/creneaux/semaine/${currentWeek.value}/batch`, {
        method: 'POST', body: JSON.stringify({ creneaux: csvRows.value }),
      });
      creneaux.value = [...creneaux.value, ...result.creneaux].sort((a, b) =>
        JOURS.indexOf(a.jour) - JOURS.indexOf(b.jour) || a.heure_debut.localeCompare(b.heure_debut)
      );
      showAlert('success', `${result.count} créneaux importés`);
      cancelImport();
    } catch (err) { showAlert('error', err.message); }
    finally { saving.value = false; }
  }

  async function addPreset() {
    const { label, slot_label, heure_debut, heure_fin } = presetForm.value;
    if (!label.trim() || !heure_debut || !heure_fin) return;
    presetSaving.value = true;
    try {
      const p = await apiFetch('/presets', { method: 'POST', body: JSON.stringify({
        label: label.trim(), slot_label: slot_label.trim() || label.trim(), heure_debut, heure_fin,
      })});
      presets.value = [...presets.value, p];
      presetForm.value = { label: '', slot_label: '', heure_debut: '', heure_fin: '' };
    } catch (err) { showAlert('error', err.message); }
    finally { presetSaving.value = false; }
  }

  async function removePreset(id) {
    try {
      await apiFetch(`/presets/${id}`, { method: 'DELETE' });
      presets.value = presets.value.filter(p => p.id !== id);
    } catch (err) { showAlert('error', err.message); }
  }

  function posteLabel(posteId) {
    return postes.value.find(p => p.id === posteId)?.libelle ?? '—';
  }

  function pdvLabel(pdvId) {
    return pointsDeVente.value.find(p => p.id === pdvId)?.nom ?? '—';
  }

  function pdvColor(pdvId) {
    return pointsDeVente.value.find(p => p.id === pdvId)?.couleur ?? '#6366f1';
  }

  // ── Édition inline ─────────────────────────────────────────────────────────
  const editModal  = ref(null);
  const editForm   = ref({});
  const editSaving = ref(false);

  function openEdit(creneau) {
    editForm.value = {
      slot_label:        creneau.slot_label,
      heure_debut:       creneau.heure_debut,
      heure_fin:         creneau.heure_fin,
      poste_id:          creneau.poste_id ?? '',
      point_de_vente_id: creneau.point_de_vente_id ?? '',
      nb_postes:         creneau.nb_postes ?? 1,
      notes:             creneau.notes ?? '',
      jour:              creneau.jour,
    };
    editModal.value = creneau;
  }

  async function saveEdit() {
    if (!editModal.value) return;
    editSaving.value = true;
    try {
      const updated = await apiFetch(
        `/creneaux/semaine/${currentWeek.value}/${editModal.value.id}`,
        { method: 'PATCH', body: JSON.stringify({
          ...editForm.value,
          poste_id:          editForm.value.poste_id || null,
          point_de_vente_id: editForm.value.point_de_vente_id || null,
        }) }
      );
      creneaux.value = creneaux.value.map(c => c.id === updated.id ? updated : c);
      editModal.value = null;
      showAlert('success', 'Créneau mis à jour');
    } catch (err) { showAlert('error', err.message); }
    finally { editSaving.value = false; }
  }

  watch(currentWeek, loadWeek);
  onMounted(() => { loadWeek(); loadPresets(); });

  return {
    creneaux, postes, pointsDeVente, loading, saving, form, formErrors, csvRows, csvParsed,
    weekLabel, boundsLabel, tableRows, totalHeures,
    toggleJour, addCreneau, applyPreset, deleteCreneau,
    onFileChange, onDrop, cancelImport, confirmImport, posteLabel, pdvLabel, pdvColor,
    presets, presetsEditOpen, presetForm, presetSaving, addPreset, removePreset,
    loadWeek, loadPresets,
    editModal, editForm, editSaving, openEdit, saveEdit,
  };
}
