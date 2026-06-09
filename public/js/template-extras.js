export const TEMPLATE_EXTRAS = `
  <template v-if="activeView === 'extras'">
  <div class="page-header">
    <div>
      <h2>Extras</h2>
      <p>Envoyez les liens de disponibilités à vos extras pour la semaine de votre choix.</p>
    </div>
    <button class="btn-primary" @click="loadExtras" :disabled="eLoading">
      {{ eLoading ? 'Chargement…' : '↺ Actualiser' }}
    </button>
  </div>

  <div class="week-nav" style="margin-bottom:12px">
    <button @click="eLinkPrevWeek">‹</button>
    <div>
      <div class="week-label">{{ eLinkPeriodeLabel }}</div>
      <div class="week-bounds">{{ eLinkWeekBounds }}</div>
    </div>
    <button @click="eLinkNextWeek">›</button>
    <div class="spacer"></div>
    <div style="display:flex;gap:4px;background:#f1f5f9;border-radius:8px;padding:3px">
      <button @click="eLinkPeriode = 'semaine'"
        :style="eLinkPeriode === 'semaine' ? 'background:#fff;box-shadow:0 1px 3px rgba(0,0,0,.1);color:#1e40af;font-weight:600' : 'color:#64748b'"
        style="border:none;border-radius:6px;padding:4px 10px;font-size:12px;cursor:pointer">
        Semaine
      </button>
      <button @click="eLinkPeriode = 'mois'"
        :style="eLinkPeriode === 'mois' ? 'background:#fff;box-shadow:0 1px 3px rgba(0,0,0,.1);color:#1e40af;font-weight:600' : 'color:#64748b'"
        style="border:none;border-radius:6px;padding:4px 10px;font-size:12px;cursor:pointer">
        Mois (4 sem.)
      </button>
    </div>
  </div>
  <p style="font-size:12px;color:#94a3b8;margin-bottom:16px">Les liens restent valables jusqu'à la publication du planning — l'extra peut modifier ses disponibilités à tout moment.</p>

  <div v-if="eSelected.size > 0" style="display:flex;align-items:center;gap:10px;background:#f0f9ff;border:1px solid #bae6fd;border-radius:10px;padding:10px 16px;margin-bottom:14px">
    <span style="font-size:13px;font-weight:600;color:#0369a1">{{ eSelected.size }} extra(s) sélectionné(s)</span>
    <div style="flex:1"></div>
    <button class="btn-sm btn-primary" :disabled="eBulkSaving" @click="eSendBulk">🔗 Envoyer liens</button>
    <button class="btn-sm" style="background:#f1f5f9;color:#334155;border:1px solid #e2e8f0" :disabled="eBulkSaving" @click="eOpenBulkPostes">Compétences</button>
    <button class="btn-sm" style="background:#fef2f2;color:#dc2626;border:1px solid #fecaca" :disabled="eBulkSaving" @click="eSaveBulkBlocked(true)">🚫 Bloquer</button>
    <button class="btn-sm" style="background:#f0fdf4;color:#16a34a;border:1px solid #bbf7d0" :disabled="eBulkSaving" @click="eSaveBulkBlocked(false)">✓ Débloquer</button>
    <button class="btn-sm" style="background:#f1f5f9;color:#64748b;border:1px solid #e2e8f0" @click="eSelected = new Set()">✕</button>
  </div>

  <div v-if="eLoading" style="text-align:center;padding:40px;color:#94a3b8">Chargement…</div>
  <div v-else-if="eExtras.length === 0" class="empty-state">
    <div class="icon">👤</div>
    <p>Aucun extra enregistré.</p>
  </div>
  <table v-else class="data-table">
    <thead><tr>
      <th style="width:36px;padding-right:0">
        <input type="checkbox" :checked="eAllSelected" @change="eToggleAll" style="cursor:pointer" />
      </th>
      <th>Extra</th><th>Compétences</th><th style="text-align:right">Lien disponibilités</th>
    </tr></thead>
    <tbody>
      <tr v-for="e in eExtras" :key="e.id" @vue:mounted="loadExtraPostes(e.id)"
          :style="e.is_blocked ? 'opacity:.5' : ''">
        <td style="padding-right:0">
          <input type="checkbox" :checked="eSelected.has(e.id)" @change="eToggle(e.id)" style="cursor:pointer" />
        </td>
        <td>
          <div style="display:flex;align-items:center;gap:10px">
            <div :style="{width:'32px',height:'32px',borderRadius:'50%',background:avatarColor(e.id),display:'flex',alignItems:'center',justifyContent:'center',color:'#fff',fontSize:'12px',fontWeight:700}">
              {{ initials(e.nom, e.prenom) }}
            </div>
            <div>
              <div style="font-weight:600;font-size:14px">{{ e.prenom }} {{ e.nom }}
                <span v-if="e.is_blocked" style="font-size:10px;background:#fee2e2;color:#dc2626;border-radius:4px;padding:1px 5px;margin-left:4px">bloqué</span>
              </div>
              <div style="font-size:11px;color:#94a3b8">{{ e.email }}</div>
            </div>
          </div>
        </td>
        <td>
          <div v-if="!eExtraPostes[e.id]" style="font-size:12px;color:#94a3b8">…</div>
          <div v-else style="display:flex;flex-wrap:wrap;gap:4px">
            <span v-for="p in allPostes" :key="p.id"
              :class="['poste-chip', eExtraPostes[e.id].has(p.id) ? 'active' : '']"
              :style="ePostesSaving[e.id] ? 'opacity:.5;pointer-events:none' : ''"
              @click="toggleExtraPoste(e.id, p.id)">
              {{ p.libelle }}
            </span>
          </div>
        </td>
        <td style="text-align:right">
          <button class="btn-sm btn-primary" :disabled="eSending[e.id]" @click="sendDispoLink(e)">
            {{ eSending[e.id] ? '…' : '🔗 Envoyer lien' }}
          </button>
        </td>
      </tr>
    </tbody>
  </table>

  <div v-if="eBulkPostesOpen" class="modal-overlay" @click.self="eBulkPostesOpen = false">
    <div class="modal" style="max-width:480px">
      <div class="modal-header">
        <h3>Compétences — {{ eSelected.size }} extra(s)</h3>
        <button class="modal-close" @click="eBulkPostesOpen = false">✕</button>
      </div>
      <div class="modal-body" style="padding:20px">
        <p style="font-size:13px;color:#64748b;margin-bottom:14px">Sélectionnez les compétences à appliquer à tous les extras sélectionnés.</p>
        <div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:20px">
          <span v-for="p in allPostes" :key="p.id"
            :class="['poste-chip', eBulkPosteIds.has(p.id) ? 'active' : '']"
            style="font-size:13px;padding:6px 12px;cursor:pointer"
            @click="eBulkPosteIds.has(p.id) ? eBulkPosteIds.delete(p.id) : eBulkPosteIds.add(p.id); eBulkPosteIds = new Set(eBulkPosteIds)">
            {{ p.libelle }}
          </span>
        </div>
        <div style="display:flex;justify-content:flex-end;gap:8px">
          <button class="btn-sm" style="background:#f1f5f9;color:#334155;border:1px solid #e2e8f0" @click="eBulkPostesOpen = false">Annuler</button>
          <button class="btn-sm btn-primary" :disabled="eBulkSaving" @click="eSaveBulkPostes">
            {{ eBulkSaving ? 'Enregistrement…' : 'Enregistrer' }}
          </button>
        </div>
      </div>
    </div>
  </div>

  <div v-if="eLinkModal" class="modal-overlay" @click.self="eLinkModal = null">
    <div class="modal" style="max-width:520px">
      <div class="modal-header">
        <h3>Lien de disponibilités</h3>
        <button class="modal-close" @click="eLinkModal = null">✕</button>
      </div>
      <div class="modal-body" style="padding:20px">
        <p style="margin-bottom:12px;font-size:14px">
          <strong>{{ eLinkModal.extra.prenom }} {{ eLinkModal.extra.nom }}</strong>
          — semaine {{ eLinkModal.semaine }}
        </p>
        <div v-if="eLinkModal.sent" style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:12px;font-size:13px;color:#166534;margin-bottom:12px">
          ✓ Email envoyé à {{ eLinkModal.extra.email }}
        </div>
        <div v-else style="background:#fefce8;border:1px solid #fde68a;border-radius:8px;padding:10px;font-size:12px;color:#92400e;margin-bottom:12px">
          Mode dev — copiez et envoyez ce lien manuellement
        </div>
        <div style="display:flex;gap:8px;align-items:center">
          <input readonly :value="eLinkModal.url"
            style="flex:1;border:1px solid #e2e8f0;border-radius:6px;padding:8px 10px;font-size:12px;font-family:monospace;background:#f8fafc;color:#334155"
            @click="$event.target.select()" />
          <button class="btn-sm btn-primary" @click="navigator.clipboard.writeText(eLinkModal.url).then(()=>showAlert('success','Lien copié !'))">
            Copier
          </button>
        </div>
        <a :href="eLinkModal.url" target="_blank"
          style="display:block;margin-top:10px;font-size:12px;color:#2563eb;text-decoration:none">
          → Ouvrir dans un nouvel onglet
        </a>
      </div>
    </div>
  </div>
  </template>
`;
