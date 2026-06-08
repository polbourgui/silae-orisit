import { ref } from '/vendor/vue.esm-browser.js';
import { apiFetch } from './manager-utils.js';

export function usePostes({ showAlert, allPostes }) {
  const pLoading2    = ref(false);
  const newPosteLib  = ref('');
  const posteSaving  = ref(false);

  async function loadPostes() {
    pLoading2.value = true;
    try { allPostes.value = await apiFetch('/postes'); }
    catch (err) { showAlert('error', err.message); }
    finally { pLoading2.value = false; }
  }

  async function addPoste() {
    if (!newPosteLib.value.trim()) return;
    posteSaving.value = true;
    try {
      const p = await apiFetch('/postes', { method: 'POST', body: JSON.stringify({ libelle: newPosteLib.value }) });
      allPostes.value = [...allPostes.value, p].sort((a, b) => a.libelle.localeCompare(b.libelle));
      newPosteLib.value = '';
    } catch (err) { showAlert('error', err.message); }
    finally { posteSaving.value = false; }
  }

  async function removePoste(posteId) {
    try {
      await apiFetch(`/postes/${posteId}`, { method: 'DELETE' });
      allPostes.value = allPostes.value.filter(p => p.id !== posteId);
    } catch (err) { showAlert('error', err.message); }
  }

  return { pLoading2, newPosteLib, posteSaving, loadPostes, addPoste, removePoste };
}

export const TEMPLATE_POSTES = `
  <template v-if="activeView === 'postes'">
  <div class="page-header">
    <div>
      <h2>Postes</h2>
      <p>Définissez les compétences associables aux extras. Les créneaux peuvent exiger un poste spécifique, ce qui améliore les suggestions de planning.</p>
    </div>
  </div>

  <div style="display:flex;gap:8px;margin-bottom:20px">
    <input v-model="newPosteLib" type="text" placeholder="Nouveau poste (ex: Chef·fe de rang)"
      style="flex:1;border:1px solid #e2e8f0;border-radius:8px;padding:9px 12px;font-size:14px"
      @keyup.enter="addPoste" />
    <button class="btn-primary" style="border-radius:8px;padding:9px 16px;font-size:14px"
      :disabled="posteSaving || !newPosteLib.trim()" @click="addPoste">+ Ajouter</button>
  </div>

  <div v-if="pLoading2" style="color:#94a3b8;font-size:13px">Chargement…</div>
  <div v-else-if="allPostes.length === 0" class="empty-state">
    <div class="icon">🏷️</div>
    <p>Aucun poste défini. Ajoutez vos premières compétences ci-dessus.</p>
  </div>
  <div v-else style="display:flex;flex-direction:column;gap:6px">
    <div v-for="p in allPostes" :key="p.id"
      style="display:flex;align-items:center;gap:12px;background:#fff;border:1px solid #e2e8f0;border-radius:8px;padding:12px 16px">
      <span style="font-size:14px;font-weight:500;flex:1">{{ p.libelle }}</span>
      <span v-if="p.code_emploi" style="font-size:11px;color:#94a3b8;font-family:monospace">{{ p.code_emploi }}</span>
      <button class="btn-sm" style="background:#fef2f2;color:#dc2626;border:1px solid #fecaca" @click="removePoste(p.id)">
        Supprimer
      </button>
    </div>
  </div>
  </template>
`;
