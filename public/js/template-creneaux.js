export const TEMPLATE_CRENEAUX = `
  <template v-if="activeView === 'creneaux'">
  <div class="page-header">
    <div>
      <h2>Créneaux de la semaine</h2>
      <p>Définissez les créneaux disponibles pour les extras, puis lancez l'algorithme de planning.</p>
    </div>
  </div>

  <div class="week-nav">
    <button @click="prevWeek">‹</button>
    <div>
      <div class="week-label">{{ weekLabel }}</div>
      <div class="week-bounds">{{ boundsLabel }}</div>
    </div>
    <button @click="nextWeek">›</button>
    <div class="spacer"></div>
    <span v-if="loading" style="color:#94a3b8;font-size:13px">Chargement…</span>
    <span v-else style="font-size:13px;color:#64748b">{{ creneaux.length }} créneau(x) · {{ totalHeures }}h total</span>
  </div>

  <div class="stats-bar">
    <div class="stat">
      <div class="value">{{ creneaux.length }}</div>
      <div class="label">Créneaux définis</div>
    </div>
    <div class="stat">
      <div class="value">{{ new Set(creneaux.map(c => c.jour)).size }}</div>
      <div class="label">Jours couverts</div>
    </div>
    <div class="stat">
      <div class="value">{{ totalHeures }}h</div>
      <div class="label">Heures à pourvoir</div>
    </div>
  </div>

  <div class="columns">
    <div class="card">
      <div class="card-header"><h3>Créneaux</h3></div>
      <div v-if="loading" class="empty-state" style="padding:32px">Chargement…</div>
      <div v-else-if="creneaux.length === 0" class="empty-state">
        <div class="icon">📅</div>
        <p>Aucun créneau pour cette semaine.</p>
        <p style="margin-top:4px;font-size:12px">Utilisez le formulaire pour en ajouter.</p>
      </div>
      <table v-else>
        <thead><tr>
          <th>Jour</th><th>Libellé</th><th>Horaires</th><th>Durée</th><th>Poste</th><th>Salle</th>
          <th style="text-align:center" title="Nombre de postes">Qté</th><th>Notes</th><th></th>
        </tr></thead>
        <tbody>
          <template v-for="row in tableRows" :key="row.isSeparator ? 'sep-'+row.jour : row.id">
            <tr v-if="row.isSeparator" class="day-separator"><td colspan="9"><span :class="['jour-badge','jour-'+row.jour]" style="margin-right:8px">{{ JOURS_COURT[row.jour] }}</span>{{ row.dateLabel }}</td></tr>
            <tr v-else>
              <td><span :class="['jour-badge','jour-'+row.jour]">{{ JOURS_COURT[row.jour] }}</span></td>
              <td>{{ row.slot_label }}</td>
              <td class="time-range">{{ row.heure_debut }} → {{ row.heure_fin }}</td>
              <td style="color:#64748b">{{ duration(row.heure_debut, row.heure_fin) }}</td>
              <td style="color:#475569;font-size:12px">{{ posteLabel(row.poste_id) }}</td>
              <td style="font-size:12px">
                <span v-if="row.point_de_vente_id"
                  style="background:#f0fdf4;color:#166534;border:1px solid #bbf7d0;border-radius:4px;padding:1px 7px;font-weight:500;white-space:nowrap">
                  {{ pdvLabel(row.point_de_vente_id) }}
                </span>
                <span v-else style="color:#cbd5e1">—</span>
              </td>
              <td style="text-align:center;font-size:12px;font-weight:600;color:#334155">{{ row.nb_postes ?? 1 }}</td>
              <td style="max-width:180px">
                <span v-if="row.notes" style="font-size:11px;color:#92400e;background:#fffbeb;border:1px solid #fde68a;border-radius:4px;padding:1px 6px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;display:inline-block;max-width:170px" :title="row.notes">
                  📋 {{ row.notes }}
                </span>
              </td>
              <td style="white-space:nowrap">
                <button class="btn-icon" @click="openEdit(row)" title="Modifier" style="margin-right:4px">✏</button>
                <button class="btn-icon" @click="deleteCreneau(row.id)" title="Supprimer">✕</button>
              </td>
            </tr>
          </template>
        </tbody>
      </table>

  <!-- Modal édition -->
  <div v-if="editModal" class="modal-overlay" @click.self="editModal = null">
    <div class="modal" style="max-width:480px">
      <div class="modal-header">
        <h3>Modifier le créneau</h3>
        <button class="modal-close" @click="editModal = null">✕</button>
      </div>
      <div class="modal-body" style="padding:20px;display:flex;flex-direction:column;gap:14px">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
          <div class="form-group">
            <label>Début</label>
            <input type="time" v-model="editForm.heure_debut" />
          </div>
          <div class="form-group">
            <label>Fin</label>
            <input type="time" v-model="editForm.heure_fin" />
          </div>
        </div>
        <div class="form-group">
          <label>Libellé</label>
          <input type="text" v-model="editForm.slot_label" placeholder="ex: Service midi" />
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
          <div class="form-group">
            <label>Poste requis</label>
            <select v-model="editForm.poste_id">
              <option value="">— Aucun —</option>
              <option v-for="p in postes" :key="p.id" :value="p.id">{{ p.libelle }}</option>
            </select>
          </div>
          <div class="form-group">
            <label>Nombre de postes</label>
            <input type="number" v-model.number="editForm.nb_postes" min="1" max="20" style="text-align:center" />
          </div>
        </div>
        <div class="form-group">
          <label>Salle / point de vente <span style="font-weight:400;color:#94a3b8">(optionnel)</span></label>
          <select v-model="editForm.point_de_vente_id">
            <option value="">— Aucune salle —</option>
            <option v-for="s in pointsDeVente" :key="s.id" :value="s.id">{{ s.nom }}</option>
          </select>
        </div>
        <div class="form-group">
          <label>Notes pour le staff <span style="font-weight:400;color:#94a3b8">(facultatif)</span></label>
          <textarea v-model="editForm.notes" rows="2"
            placeholder="ex : Privatisation — tenue noire propre exigée"
            style="resize:vertical;font-size:13px;padding:8px 10px;border:1px solid #e2e8f0;border-radius:6px;width:100%"></textarea>
        </div>
        <div style="display:flex;justify-content:flex-end;gap:8px">
          <button class="btn-sm" style="background:#f1f5f9;color:#334155;border:1px solid #e2e8f0" @click="editModal = null">Annuler</button>
          <button class="btn-sm btn-primary" :disabled="editSaving" @click="saveEdit">
            {{ editSaving ? 'Enregistrement…' : 'Enregistrer' }}
          </button>
        </div>
      </div>
    </div>
  </div>
    </div>

    <div style="display:flex;flex-direction:column;gap:16px">
      <div class="card">
        <div class="card-header"><h3>Ajouter un créneau</h3></div>
        <div class="card-body">

          <div class="form-section">
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
              <h4 style="margin:0">Présets rapides</h4>
              <button class="btn-sm" style="background:none;border:1px solid #e2e8f0;color:#64748b;font-size:11px"
                @click="presetsEditOpen = !presetsEditOpen">
                {{ presetsEditOpen ? '✕ Fermer' : '✎ Modifier' }}
              </button>
            </div>
            <div class="presets">
              <button v-for="p in presets" :key="p.id ?? p.label" class="preset-btn" @click="applyPreset(p)">{{ p.label }}</button>
            </div>
            <div v-if="presetsEditOpen" style="margin-top:12px;border:1px solid #e2e8f0;border-radius:8px;padding:12px;background:#f8fafc">
              <div style="font-size:12px;font-weight:600;color:#64748b;margin-bottom:8px">Présets enregistrés</div>
              <div v-for="p in presets" :key="p.id ?? p.label"
                style="display:flex;align-items:center;gap:8px;padding:5px 0;border-bottom:1px solid #f1f5f9">
                <span style="flex:1;font-size:13px">{{ p.label }}</span>
                <span style="font-size:11px;color:#94a3b8;font-family:monospace">{{ p.heure_debut }}–{{ p.heure_fin }}</span>
                <button class="btn-sm" style="background:#fef2f2;color:#dc2626;border:1px solid #fecaca;padding:2px 8px"
                  @click="removePreset(p.id)">✕</button>
              </div>
              <div style="margin-top:10px;display:grid;grid-template-columns:1fr 1fr;gap:6px">
                <input v-model="presetForm.label" placeholder="Nom (ex: Brunch)" type="text"
                  style="border:1px solid #e2e8f0;border-radius:6px;padding:6px 8px;font-size:12px;grid-column:1/-1" />
                <input v-model="presetForm.heure_debut" placeholder="Début 09:00" type="text"
                  style="border:1px solid #e2e8f0;border-radius:6px;padding:6px 8px;font-size:12px" />
                <input v-model="presetForm.heure_fin" placeholder="Fin 14:00" type="text"
                  style="border:1px solid #e2e8f0;border-radius:6px;padding:6px 8px;font-size:12px" />
              </div>
              <button class="btn-primary" style="margin-top:8px;width:100%;border-radius:6px;padding:7px;font-size:13px"
                :disabled="presetSaving || !presetForm.label.trim() || !presetForm.heure_debut || !presetForm.heure_fin"
                @click="addPreset">+ Ajouter ce préset</button>
            </div>
          </div>

          <div class="form-section">
            <h4>Jours *</h4>
            <div class="jours-picker">
              <span v-for="j in JOURS" :key="j"
                :class="['jour-toggle', { selected: form.jours.includes(j) }]"
                @click="toggleJour(j)">{{ JOURS_COURT[j] }}</span>
            </div>
            <div v-if="formErrors.jours" class="error-msg" style="margin-top:4px">{{ formErrors.jours }}</div>
            <div style="font-size:11px;color:#94a3b8;margin-top:6px">
              {{ form.jours.length > 1 ? form.jours.length + ' créneaux seront créés' : '' }}
            </div>
          </div>

          <div class="form-section">
            <h4>Détails</h4>
            <div class="form-group" style="margin-bottom:10px">
              <label>Libellé *</label>
              <input v-model="form.slot_label" :class="{ error: formErrors.slot_label }"
                placeholder="ex: Service midi" @keydown.enter="addCreneau" />
              <span v-if="formErrors.slot_label" class="error-msg">{{ formErrors.slot_label }}</span>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label>Début *</label>
                <input type="time" v-model="form.heure_debut" :class="{ error: formErrors.heure_debut }" />
                <span v-if="formErrors.heure_debut" class="error-msg">{{ formErrors.heure_debut }}</span>
              </div>
              <div class="form-group">
                <label>Fin *</label>
                <input type="time" v-model="form.heure_fin" :class="{ error: formErrors.heure_fin }" />
                <span v-if="formErrors.heure_fin" class="error-msg">{{ formErrors.heure_fin }}</span>
              </div>
            </div>
            <div class="form-row" style="margin-bottom:10px">
              <div class="form-group" style="flex:2">
                <label>Poste (optionnel)</label>
                <select v-model="form.poste_id">
                  <option value="">— Sans poste —</option>
                  <option v-for="p in postes" :key="p.id" :value="p.id">{{ p.libelle }}</option>
                </select>
              </div>
              <div class="form-group" style="flex:1">
                <label>Nb postes</label>
                <input type="number" v-model.number="form.nb_postes" min="1" max="20" style="text-align:center" />
              </div>
            </div>
            <div class="form-group" style="margin-bottom:14px">
              <label>Salle (optionnel)</label>
              <select v-model="form.point_de_vente_id">
                <option value="">— Aucune salle —</option>
                <option v-for="s in pointsDeVente" :key="s.id" :value="s.id">{{ s.nom }}</option>
              </select>
            </div>
            <button class="btn btn-primary btn-full" @click="addCreneau" :disabled="saving">
              <span v-if="saving" class="spinner"></span>
              <span v-else>+ {{ form.jours.length > 1 ? 'Ajouter ' + form.jours.length + ' créneaux' : 'Ajouter le créneau' }}</span>
            </button>
          </div>

        </div>
      </div>

      <div class="card">
        <div class="card-header"><h3>Import CSV</h3></div>
        <div class="card-body">
          <div v-if="!csvParsed">
            <p style="font-size:12px;color:#64748b;margin-bottom:10px">Format : <code>jour;Libellé;08:00;12:00</code></p>
            <label class="import-zone"
              @dragover.prevent="$event.currentTarget.classList.add('drag-over')"
              @dragleave="$event.currentTarget.classList.remove('drag-over')"
              @drop.prevent="(e) => { e.currentTarget.classList.remove('drag-over'); onDrop(e); }">
              <input type="file" accept=".csv,.txt" @change="onFileChange" />
              <div style="font-size:24px;margin-bottom:6px">📂</div>
              <div>Glissez un fichier CSV ici</div>
              <div style="font-size:11px;margin-top:4px;color:#94a3b8">ou cliquez pour parcourir</div>
            </label>
          </div>
          <div v-else>
            <div class="alert alert-info">{{ csvRows.length }} ligne(s) détectée(s)</div>
            <table style="margin-bottom:12px">
              <thead><tr><th>Jour</th><th>Libellé</th><th>Début</th><th>Fin</th></tr></thead>
              <tbody>
                <tr v-for="(r,i) in csvRows" :key="i">
                  <td><span :class="['jour-badge','jour-'+r.jour]">{{ JOURS_COURT[r.jour] ?? r.jour }}</span></td>
                  <td>{{ r.slot_label }}</td><td>{{ r.heure_debut }}</td><td>{{ r.heure_fin }}</td>
                </tr>
              </tbody>
            </table>
            <div class="form-row">
              <button class="btn btn-secondary btn-sm" @click="cancelImport">Annuler</button>
              <button class="btn btn-success btn-sm" @click="confirmImport" :disabled="saving" style="flex:1;justify-content:center">
                <span v-if="saving" class="spinner"></span>
                <span v-else>Importer {{ csvRows.length }} créneaux</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
  </template>
`;
