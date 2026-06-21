export const TEMPLATE_REPORTING = `
  <template v-if="activeView === 'reporting'">
  <div class="page-header">
    <div>
      <h2>Reporting activité</h2>
      <p>Suivi des heures planifiées par type d'activité sur une période donnée.</p>
    </div>
  </div>

  <!-- Filtres période -->
  <div class="card" style="margin-bottom:16px">
    <div class="card-body" style="display:flex;align-items:flex-end;gap:16px;flex-wrap:wrap">
      <div class="form-group" style="margin:0;min-width:140px">
        <label style="font-size:12px;font-weight:600;color:#64748b;display:block;margin-bottom:4px">Semaine de début</label>
        <input type="week" v-model="filterFrom" style="padding:6px 10px;border:1px solid #e2e8f0;border-radius:6px;font-size:13px" />
      </div>
      <div class="form-group" style="margin:0;min-width:140px">
        <label style="font-size:12px;font-weight:600;color:#64748b;display:block;margin-bottom:4px">Semaine de fin</label>
        <input type="week" v-model="filterTo" style="padding:6px 10px;border:1px solid #e2e8f0;border-radius:6px;font-size:13px" />
      </div>
      <button class="btn btn-primary" @click="loadReporting" :disabled="loading" style="height:34px;padding:0 18px">
        <span v-if="loading" class="spinner"></span>
        <span v-else>Actualiser</span>
      </button>
      <div style="flex:1"></div>
      <button class="btn" @click="exportCSV"
        style="height:34px;padding:0 16px;background:#f8fafc;border:1px solid #e2e8f0;color:#334155;font-size:13px"
        title="Télécharger les données en CSV (compatible Excel)">
        ⬇ Export CSV
      </button>
    </div>
  </div>

  <div v-if="loading" style="text-align:center;padding:48px;color:#94a3b8">Chargement…</div>
  <template v-else-if="parActivite.length === 0 && !loading">
    <div class="empty-state" style="padding:48px">
      <div class="icon">📊</div>
      <p>Aucune donnée pour cette période.</p>
      <p style="font-size:12px;margin-top:4px">Vérifiez que des créneaux existent sur les semaines sélectionnées.</p>
    </div>
  </template>
  <template v-else>

    <!-- Résumé global -->
    <div class="stats-bar" style="margin-bottom:16px">
      <div class="stat">
        <div class="value">{{ totalHeures }}h</div>
        <div class="label">Heures totales planifiées</div>
      </div>
      <div class="stat" v-for="row in parActivite" :key="row.type_activite">
        <div class="value" :style="{ color: ACTIVITE_COLORS[row.type_activite] }">{{ row.total_heures }}h</div>
        <div class="label">{{ ACTIVITE_LABELS[row.type_activite] }}</div>
      </div>
    </div>

    <div class="columns">

      <!-- Tableau récap par activité -->
      <div class="card">
        <div class="card-header"><h3>Répartition par type d'activité</h3></div>
        <table>
          <thead><tr>
            <th>Type d'activité</th>
            <th style="text-align:right">Nb créneaux</th>
            <th style="text-align:right">Nb postes total</th>
            <th style="text-align:right">Heures totales</th>
            <th style="text-align:right">% du total</th>
          </tr></thead>
          <tbody>
            <tr v-for="row in parActivite" :key="row.type_activite">
              <td>
                <span :style="ACTIVITE_STYLES[row.type_activite] ?? 'background:#f8fafc;color:#475569;border:1px solid #e2e8f0;border-radius:4px;padding:1px 7px;font-size:11px;font-weight:600'">
                  {{ ACTIVITE_LABELS[row.type_activite] ?? row.type_activite }}
                </span>
              </td>
              <td style="text-align:right;color:#475569">{{ row.nb_creneaux }}</td>
              <td style="text-align:right;color:#475569">{{ row.nb_postes_total }}</td>
              <td style="text-align:right;font-weight:600">{{ row.total_heures }}h</td>
              <td style="text-align:right;color:#64748b">
                {{ totalHeures > 0 ? Math.round(row.total_heures / totalHeures * 100) : 0 }}%
              </td>
            </tr>
            <tr style="border-top:2px solid #e2e8f0;font-weight:600">
              <td>Total</td>
              <td style="text-align:right">{{ parActivite.reduce((s,r)=>s+r.nb_creneaux,0) }}</td>
              <td style="text-align:right">{{ parActivite.reduce((s,r)=>s+r.nb_postes_total,0) }}</td>
              <td style="text-align:right">{{ totalHeures }}h</td>
              <td style="text-align:right">100%</td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Barres visuelles -->
      <div class="card" style="min-width:220px;max-width:300px">
        <div class="card-header"><h3>Répartition visuelle</h3></div>
        <div style="padding:16px;display:flex;flex-direction:column;gap:12px">
          <div v-for="row in parActivite" :key="'bar-'+row.type_activite">
            <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:4px">
              <span style="font-weight:600" :style="{ color: ACTIVITE_COLORS[row.type_activite] }">{{ ACTIVITE_LABELS[row.type_activite] }}</span>
              <span style="color:#64748b">{{ row.total_heures }}h</span>
            </div>
            <div style="background:#f1f5f9;border-radius:4px;height:8px;overflow:hidden">
              <div :style="{
                width: (totalHeures > 0 ? Math.round(row.total_heures / totalHeures * 100) : 0) + '%',
                background: ACTIVITE_COLORS[row.type_activite],
                height: '100%',
                borderRadius: '4px',
                transition: 'width 0.4s ease'
              }"></div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Évolution par semaine -->
    <div class="card" style="margin-top:16px" v-if="tableParSemaine.length > 0">
      <div class="card-header"><h3>Évolution semaine par semaine</h3></div>
      <div style="overflow-x:auto">
        <table>
          <thead><tr>
            <th>Semaine</th>
            <th v-for="a in ACTIVITE_OPTIONS" :key="a.value" style="text-align:right">{{ a.label }}</th>
            <th style="text-align:right;border-left:1px solid #e2e8f0">Total</th>
          </tr></thead>
          <tbody>
            <tr v-for="row in tableParSemaine" :key="row.iso_week">
              <td style="font-family:monospace;font-size:12px;white-space:nowrap">{{ row.iso_week }}</td>
              <td v-for="a in ACTIVITE_OPTIONS" :key="a.value" style="text-align:right;color:#475569">
                <span v-if="row[a.value] > 0" :style="{ color: ACTIVITE_COLORS[a.value], fontWeight: '600' }">{{ row[a.value].toFixed(1) }}h</span>
                <span v-else style="color:#e2e8f0">—</span>
              </td>
              <td style="text-align:right;font-weight:600;border-left:1px solid #e2e8f0">{{ row.total }}h</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

  </template>
  </template>
`;
