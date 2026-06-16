import { ref } from '/vendor/vue.esm-browser.js';
import { apiFetch } from './manager-utils.js';

export function usePointsDeVente({ showAlert, allPointsDeVente }) {
  const pdvLoading    = ref(false);
  const newPdvNom     = ref('');
  const newPdvCouleur = ref('#6366f1');
  const pdvSaving     = ref(false);
  const pdvEditId     = ref(null);
  const pdvEditNom    = ref('');
  const pdvEditCouleur = ref('#6366f1');

  async function loadPointsDeVente() {
    pdvLoading.value = true;
    try { allPointsDeVente.value = await apiFetch('/points-de-vente'); }
    catch (err) { showAlert('error', err.message); }
    finally { pdvLoading.value = false; }
  }

  async function addPointDeVente() {
    if (!newPdvNom.value.trim()) return;
    pdvSaving.value = true;
    try {
      const pdv = await apiFetch('/points-de-vente', {
        method: 'POST',
        body: JSON.stringify({ nom: newPdvNom.value, couleur: newPdvCouleur.value }),
      });
      allPointsDeVente.value = [...allPointsDeVente.value, pdv];
      newPdvNom.value = '';
      newPdvCouleur.value = '#6366f1';
    } catch (err) { showAlert('error', err.message); }
    finally { pdvSaving.value = false; }
  }

  async function saveEditPdv() {
    if (!pdvEditId.value || !pdvEditNom.value.trim()) return;
    pdvSaving.value = true;
    try {
      const pdv = await apiFetch(\`/points-de-vente/\${pdvEditId.value}\`, {
        method: 'PATCH',
        body: JSON.stringify({ nom: pdvEditNom.value, couleur: pdvEditCouleur.value }),
      });
      allPointsDeVente.value = allPointsDeVente.value.map(p => p.id === pdv.id ? pdv : p);
      pdvEditId.value = null;
      pdvEditNom.value = '';
      pdvEditCouleur.value = '#6366f1';
    } catch (err) { showAlert('error', err.message); }
    finally { pdvSaving.value = false; }
  }

  async function removePointDeVente(id) {
    if (!confirm('Supprimer cette salle ? Les créneaux associés seront dissociés.')) return;
    try {
      await apiFetch(\`/points-de-vente/\${id}\`, { method: 'DELETE' });
      allPointsDeVente.value = allPointsDeVente.value.filter(p => p.id !== id);
    } catch (err) { showAlert('error', err.message); }
  }

  function startEditPdv(pdv) {
    pdvEditId.value = pdv.id;
    pdvEditNom.value = pdv.nom;
    pdvEditCouleur.value = pdv.couleur ?? '#6366f1';
  }

  function cancelEditPdv() {
    pdvEditId.value = null;
    pdvEditNom.value = '';
    pdvEditCouleur.value = '#6366f1';
  }

  return {
    pdvLoading, newPdvNom, newPdvCouleur, pdvSaving,
    pdvEditId, pdvEditNom, pdvEditCouleur,
    loadPointsDeVente, addPointDeVente, saveEditPdv, removePointDeVente,
    startEditPdv, cancelEditPdv,
  };
}

export const TEMPLATE_POINTS_DE_VENTE = \`
  <template v-if="activeView === 'salles'">
  <div class="page-header">
    <div>
      <h2>Salles &amp; points de vente</h2>
      <p>Gérez les salles de votre établissement. Chaque créneau peut être rattaché à une salle spécifique.</p>
    </div>
  </div>

  <div style="display:flex;gap:8px;margin-bottom:20px;align-items:center">
    <input type="color" v-model="newPdvCouleur"
      style="width:40px;height:38px;border:1px solid #e2e8f0;border-radius:8px;padding:2px 4px;cursor:pointer;flex-shrink:0" />
    <input v-model="newPdvNom" type="text" placeholder="Nouvelle salle (ex: Bar, Terrasse, Salle VIP…)"
      style="flex:1;border:1px solid #e2e8f0;border-radius:8px;padding:9px 12px;font-size:14px"
      @keyup.enter="addPointDeVente" />
    <button class="btn-primary" style="border-radius:8px;padding:9px 16px;font-size:14px;flex-shrink:0"
      :disabled="pdvSaving || !newPdvNom.trim()" @click="addPointDeVente">+ Ajouter</button>
  </div>

  <div v-if="pdvLoading" style="color:#94a3b8;font-size:13px">Chargement…</div>
  <div v-else-if="allPointsDeVente.length === 0" class="empty-state">
    <div class="icon">🏪</div>
    <p>Aucune salle définie pour cet établissement.</p>
    <p style="margin-top:4px;font-size:12px;color:#94a3b8">
      Ajoutez vos salles ci-dessus pour les rattacher à vos créneaux.
    </p>
  </div>
  <div v-else style="display:flex;flex-direction:column;gap:6px">
    <div v-for="pdv in allPointsDeVente" :key="pdv.id"
      style="display:flex;align-items:center;gap:12px;background:#fff;border:1px solid #e2e8f0;border-radius:8px;padding:12px 16px">
      <template v-if="pdvEditId === pdv.id">
        <input type="color" v-model="pdvEditCouleur"
          style="width:36px;height:36px;border:1px solid #e2e8f0;border-radius:6px;padding:2px 3px;cursor:pointer;flex-shrink:0" />
        <input v-model="pdvEditNom" type="text" autofocus
          style="flex:1;border:1px solid #93c5fd;border-radius:6px;padding:7px 10px;font-size:14px;font-weight:500;outline:none"
          @keyup.enter="saveEditPdv" @keyup.escape="cancelEditPdv" />
        <button class="btn-sm btn-primary" :disabled="pdvSaving || !pdvEditNom.trim()" @click="saveEditPdv">✓ Sauvegarder</button>
        <button class="btn-sm" style="background:#f1f5f9;color:#334155;border:1px solid #e2e8f0" @click="cancelEditPdv">Annuler</button>
      </template>
      <template v-else>
        <span :style="{ width: '14px', height: '14px', borderRadius: '50%', background: pdv.couleur||'#6366f1', flexShrink: '0', display: 'inline-block', border: '2px solid white', boxShadow: '0 0 0 1px '+(pdv.couleur||'#6366f1')+'55' }"></span>
        <span :style="{ fontSize: '13px', fontWeight: '700', background: (pdv.couleur||'#6366f1')+'18', color: pdv.couleur||'#6366f1', border: '1px solid '+(pdv.couleur||'#6366f1')+'44', borderRadius: '6px', padding: '3px 10px', whiteSpace: 'nowrap' }">{{ pdv.nom }}</span>
        <span style="flex:1"></span>
        <button class="btn-sm" style="background:#f8fafc;color:#64748b;border:1px solid #e2e8f0" @click="startEditPdv(pdv)">✏ Modifier</button>
        <button class="btn-sm" style="background:#fef2f2;color:#dc2626;border:1px solid #fecaca" @click="removePointDeVente(pdv.id)">Supprimer</button>
      </template>
    </div>
  </div>
  </template>
\`;
