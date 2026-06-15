export const TEMPLATE_PLANNING = `
  <template v-if="activeView === 'planning'">
  <div class="page-header">
    <div>
      <h2>Planning de la semaine</h2>
      <p>Proposez un planning automatique puis ajustez les affectations manuellement.</p>
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
    <span v-if="pLoading" style="color:#94a3b8;font-size:13px">Chargement…</span>
  </div>

  <div class="card">
    <div class="planning-toolbar">
      <button class="btn btn-secondary" @click="proposeAlgo" :disabled="pSaving || pIsPublished">
        <span v-if="pSaving" class="spinner" style="border-top-color:#475569"></span>
        <span v-else>⚡ Proposer</span>
      </button>
      <div style="flex:1"></div>
      <span class="status-pill" :class="pIsPublished ? 'pill-pub' : 'pill-draft'">
        {{ pIsPublished ? 'Publié' : 'Brouillon' }}
      </span>
      <button class="btn btn-primary" @click="publishPlanning"
        :disabled="pSaving || pIsPublished || pNbPourvus === 0">
        Publier →
      </button>
    </div>

    <div class="planning-stats">
      <div class="stat-item"><strong>{{ pNbPourvus }}</strong> / {{ pNbTotal }} postes pourvus</div>
      <div class="stat-item" style="color:#dc2626" v-if="pNbTotal - pNbPourvus > 0">
        ⚠ <strong>{{ pNbTotal - pNbPourvus }}</strong> non pourvu(s)
      </div>
      <div class="stat-item" style="color:#16a34a" v-else-if="pNbTotal > 0">
        ✓ Tous les postes sont pourvus
      </div>
    </div>

    <div class="view-tabs">
      <button :class="['view-tab', planningDisplayMode === 'liste' ? 'view-tab-active' : '']"
        @click="planningDisplayMode = 'liste'">≡ Vue liste</button>
      <button :class="['view-tab', planningDisplayMode === 'grille' ? 'view-tab-active' : '']"
        @click="planningDisplayMode = 'grille'">⊞ Vue tableau</button>
    </div>

    <div v-if="pLoading" class="empty-state" style="padding:40px">Chargement…</div>
    <div v-else-if="pCreneaux.length === 0" class="empty-state">
      <div class="icon">📅</div>
      <p>Aucun créneau défini pour cette semaine.</p>
      <p style="margin-top:4px;font-size:12px">
        <a href="#" @click.prevent="activeView='creneaux'" style="color:#1e40af">Créer des créneaux</a> d'abord.
      </p>
    </div>
    <template v-else>

      <!-- ── Vue liste ── -->
      <template v-if="planningDisplayMode === 'liste'">
        <template v-for="row in pTableRows" :key="row.isSep ? 'sep-'+row.jour : row.slotKey">

          <div v-if="row.isSep" class="planning-day-header">
            {{ row.jour.charAt(0).toUpperCase() + row.jour.slice(1) }}
          </div>

          <div v-else class="planning-row" :style="row.slotIndex > 0 ? 'padding-top:4px;padding-bottom:4px;opacity:.92' : ''">
            <div style="font-variant-numeric:tabular-nums;font-size:12px;font-weight:600;color:#334155;white-space:nowrap;min-width:90px">
              <template v-if="row.slotIndex === 0">{{ row.heure_debut }} → {{ row.heure_fin }}</template>
            </div>
            <div style="display:flex;align-items:center;gap:8px;min-width:0">
              <template v-if="row.slotIndex === 0">
                <div style="display:flex;flex-direction:column;min-width:0">
                  <div style="display:flex;align-items:center;gap:6px">
                    <span style="font-size:13px;color:#475569;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">{{ row.slot_label }}</span>
                    <span v-if="row.poste" style="flex-shrink:0;font-size:11px;font-weight:600;background:#eff6ff;color:#2563eb;border-radius:4px;padding:1px 7px;white-space:nowrap">
                      {{ row.poste.libelle }}
                    </span>
                    <span v-if="row.nb > 1" style="flex-shrink:0;font-size:10px;color:#94a3b8;background:#f1f5f9;border-radius:10px;padding:1px 6px">
                      {{ row.nb }} postes
                    </span>
                  </div>
                  <div v-if="row.notes" style="font-size:11px;color:#92400e;background:#fffbeb;border:1px solid #fde68a;border-radius:4px;padding:2px 7px;margin-top:3px;display:inline-block;max-width:340px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">
                    📋 {{ row.notes }}
                  </div>
                </div>
              </template>
              <span v-else style="font-size:11px;color:#94a3b8;padding-left:4px">poste {{ row.slotIndex + 1 }}/{{ row.nb }}</span>
            </div>

            <div v-if="pSearchState[row.slotKey]" :style="{ position: 'relative', zIndex: pSearchState[row.slotKey].open ? 50 : 'auto' }">
              <div :class="['assignee-field', row.extra ? 'is-filled' : '', pSearchState[row.slotKey].open ? 'is-focused' : '']">
                <div v-if="row.extra" class="avatar" :style="{ background: avatarColor(row.extra.id) }">
                  {{ initials(row.extra.nom, row.extra.prenom) }}
                </div>
                <input v-if="!pIsPublished" type="text"
                  :placeholder="row.extra ? row.extra.prenom + ' ' + row.extra.nom : 'Rechercher un extra…'"
                  :style="row.extra ? 'color:#15803d;font-weight:500' : ''"
                  :value="pSearchState[row.slotKey].query"
                  @input="pSearchState[row.slotKey].query = $event.target.value"
                  @focus="openSearch(row.slotKey, $event)"
                  @blur="closeSearch(row.slotKey)"
                />
                <span v-else style="flex:1;color:#15803d;font-weight:500">
                  {{ row.extra ? row.extra.prenom + ' ' + row.extra.nom : '—' }}
                </span>
                <span v-if="row.extra && !pIsPublished" class="clear-btn" @mousedown.prevent="clearExtra(row.slotKey)">✕</span>
              </div>

              <Teleport to="body">
                <div v-if="pSearchState[row.slotKey].open" class="suggestions" :style="dropStyle(row.slotKey)">
                  <div v-if="filteredExtras(row.slotKey).length === 0" style="padding:10px 12px;color:#94a3b8;font-size:12px">
                    Aucun résultat
                  </div>
                  <div v-for="(e, idx) in filteredExtras(row.slotKey)" :key="e.id"
                    :class="['suggestion-item', idx === pSearchState[row.slotKey].activeIdx ? 'active' : '']"
                    @mousedown.prevent="selectExtra(row.slotKey, e.id)">
                    <div class="av" :style="{ background: avatarColor(e.id) }">{{ initials(e.nom, e.prenom) }}</div>
                    <span class="extra-name" :style="e.conflict ? 'opacity:.5' : ''">{{ e.prenom }} {{ e.nom }}</span>
                    <span v-if="e.conflict"
                      :style="e.conflict.type === 'overlap' ? 'background:#fef2f2;color:#dc2626;border:1px solid #fecaca' : 'background:#fff7ed;color:#ea580c;border:1px solid #fed7aa'"
                      style="font-size:10px;font-weight:600;border-radius:4px;padding:1px 6px;white-space:nowrap;flex-shrink:0">
                      ⚠ {{ e.conflict.label }}
                    </span>
                    <template v-else>
                      <span v-if="row.poste_id" class="dispo-tag" :class="e.hasPoste ? 'dispo-yes' : 'dispo-no'" style="opacity:.8">
                        {{ e.hasPoste ? '★ compétent' : '☆ non qualifié' }}
                      </span>
                      <span class="dispo-tag" :class="e.hasDispo ? 'dispo-yes' : e.hasFilledDispo ? 'dispo-no' : 'dispo-none'">
                        {{ e.hasDispo ? '✓ dispo' : e.hasFilledDispo ? 'non dispo' : 'pas répondu' }}
                      </span>
                    </template>
                  </div>
                </div>
              </Teleport>
            </div>
            <div v-else style="flex:1"></div>

            <div style="text-align:center">
              <span v-if="row.extra" style="color:#16a34a;font-size:16px">✓</span>
              <span v-else style="color:#e2e8f0;font-size:16px">○</span>
            </div>
          </div>

        </template>
      </template>

      <!-- ── Vue tableau ── -->
      <div v-else class="ptab-container">
        <table class="ptab-table">
          <thead>
            <tr>
              <th class="ptab-th-label">Créneau</th>
              <th v-for="day in pTableauData.days" :key="day" class="ptab-th-day">
                {{ day.charAt(0).toUpperCase() + day.slice(1) }}
              </th>
            </tr>
          </thead>
          <tbody>
            <template v-for="row in pTableauData.rows" :key="row.key">
              <tr v-for="si in row.maxNb" :key="si"
                :class="si === 1 ? 'ptab-tr-first' : 'ptab-tr-sub'">

                <!-- Créneau info: rowspan sur toutes les sous-lignes -->
                <td v-if="si === 1" :rowspan="row.maxNb" class="ptab-td-label">
                  <div class="ptab-time">{{ row.heure_debut.slice(0,5) }} → {{ row.heure_fin.slice(0,5) }}</div>
                  <div v-if="row.slot_label" class="ptab-slot-label">{{ row.slot_label }}</div>
                  <div v-if="row.maxNb > 1" class="ptab-nb-postes">{{ row.maxNb }} postes</div>
                </td>

                <!-- Cellules par jour -->
                <td v-for="day in pTableauData.days" :key="day" class="ptab-td-slot"
                  :class="!row.cells[day] ? 'ptab-td-na' : ''">

                  <template v-if="row.cells[day] && row.cells[day].slots[si - 1]">
                    <div :style="{ position: 'relative', zIndex: pSearchState[row.cells[day].slots[si-1].slotKey]?.open ? 50 : 'auto' }">
                      <div :class="['assignee-field', 'ptab-assignee',
                        row.cells[day].slots[si-1].extra ? 'is-filled' : '',
                        pSearchState[row.cells[day].slots[si-1].slotKey]?.open ? 'is-focused' : '']">
                        <div v-if="row.cells[day].slots[si-1].extra" class="avatar"
                          :style="{ background: avatarColor(row.cells[day].slots[si-1].extra.id) }">
                          {{ initials(row.cells[day].slots[si-1].extra.nom, row.cells[day].slots[si-1].extra.prenom) }}
                        </div>
                        <input v-if="!pIsPublished" type="text"
                          :placeholder="row.cells[day].slots[si-1].extra
                            ? row.cells[day].slots[si-1].extra.prenom + ' ' + row.cells[day].slots[si-1].extra.nom
                            : 'Extra…'"
                          :style="row.cells[day].slots[si-1].extra ? 'color:#15803d;font-weight:500' : ''"
                          :value="pSearchState[row.cells[day].slots[si-1].slotKey]?.query"
                          @input="pSearchState[row.cells[day].slots[si-1].slotKey].query = $event.target.value"
                          @focus="openSearch(row.cells[day].slots[si-1].slotKey, $event)"
                          @blur="closeSearch(row.cells[day].slots[si-1].slotKey)"
                        />
                        <span v-else style="flex:1;font-size:12px;color:#15803d;font-weight:500">
                          {{ row.cells[day].slots[si-1].extra
                            ? row.cells[day].slots[si-1].extra.prenom + ' ' + row.cells[day].slots[si-1].extra.nom
                            : '—' }}
                        </span>
                        <span v-if="row.cells[day].slots[si-1].extra && !pIsPublished"
                          class="clear-btn"
                          @mousedown.prevent="clearExtra(row.cells[day].slots[si-1].slotKey)">✕</span>
                      </div>

                      <Teleport to="body">
                        <div v-if="pSearchState[row.cells[day].slots[si-1].slotKey]?.open"
                          class="suggestions"
                          :style="dropStyle(row.cells[day].slots[si-1].slotKey)">
                          <div v-if="filteredExtras(row.cells[day].slots[si-1].slotKey).length === 0"
                            style="padding:10px 12px;color:#94a3b8;font-size:12px">
                            Aucun résultat
                          </div>
                          <div v-for="(e, idx) in filteredExtras(row.cells[day].slots[si-1].slotKey)"
                            :key="e.id"
                            :class="['suggestion-item', idx === pSearchState[row.cells[day].slots[si-1].slotKey].activeIdx ? 'active' : '']"
                            @mousedown.prevent="selectExtra(row.cells[day].slots[si-1].slotKey, e.id)">
                            <div class="av" :style="{ background: avatarColor(e.id) }">{{ initials(e.nom, e.prenom) }}</div>
                            <span class="extra-name" :style="e.conflict ? 'opacity:.5' : ''">{{ e.prenom }} {{ e.nom }}</span>
                            <span v-if="e.conflict"
                              :style="e.conflict.type === 'overlap' ? 'background:#fef2f2;color:#dc2626;border:1px solid #fecaca' : 'background:#fff7ed;color:#ea580c;border:1px solid #fed7aa'"
                              style="font-size:10px;font-weight:600;border-radius:4px;padding:1px 6px;white-space:nowrap;flex-shrink:0">
                              ⚠ {{ e.conflict.label }}
                            </span>
                            <template v-else>
                              <span v-if="row.cells[day].creneau.poste_id" class="dispo-tag"
                                :class="e.hasPoste ? 'dispo-yes' : 'dispo-no'" style="opacity:.8">
                                {{ e.hasPoste ? '★ compétent' : '☆ non qualifié' }}
                              </span>
                              <span class="dispo-tag"
                                :class="e.hasDispo ? 'dispo-yes' : e.hasFilledDispo ? 'dispo-no' : 'dispo-none'">
                                {{ e.hasDispo ? '✓ dispo' : e.hasFilledDispo ? 'non dispo' : 'pas répondu' }}
                              </span>
                            </template>
                          </div>
                        </div>
                      </Teleport>
                    </div>
                  </template>

                  <template v-else-if="!row.cells[day]">
                    <span class="ptab-na-dash">—</span>
                  </template>

                </td>
              </tr>
            </template>
          </tbody>
        </table>
      </div>

    </template>
  </div>
  </template>
`;
