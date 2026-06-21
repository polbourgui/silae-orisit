import { ref, computed } from '/vendor/vue.esm-browser.js';
import { apiFetch, isoWeekFromDate, offsetWeek } from './manager-utils.js';

export const ACTIVITE_OPTIONS = [
  { value: 'restauration',  label: 'Restauration' },
  { value: 'programmation', label: 'Programmation' },
  { value: 'privatisation', label: 'Privatisation' },
  { value: 'autre',         label: 'Autre' },
];

export const ACTIVITE_LABELS = {
  restauration:  'Restauration',
  programmation: 'Programmation',
  privatisation: 'Privatisation',
  autre:         'Autre',
  non_defini:    'Non défini',
};

export const ACTIVITE_COLORS = {
  restauration:  '#f97316',
  programmation: '#8b5cf6',
  privatisation: '#0ea5e9',
  autre:         '#6b7280',
  non_defini:    '#94a3b8',
};

export const ACTIVITE_STYLES = {
  restauration:  'background:#fff7ed;color:#c2410c;border:1px solid #fed7aa;border-radius:4px;padding:1px 7px;font-size:11px;font-weight:600',
  programmation: 'background:#f5f3ff;color:#6d28d9;border:1px solid #ddd6fe;border-radius:4px;padding:1px 7px;font-size:11px;font-weight:600',
  privatisation: 'background:#f0f9ff;color:#0369a1;border:1px solid #bae6fd;border-radius:4px;padding:1px 7px;font-size:11px;font-weight:600',
  autre:         'background:#f8fafc;color:#475569;border:1px solid #e2e8f0;border-radius:4px;padding:1px 7px;font-size:11px;font-weight:600',
};

function currentAndPrevious12Weeks() {
  const now = isoWeekFromDate(new Date());
  return { from: offsetWeek(now, -11), to: now };
}

export function useReporting({ showAlert }) {
  const loading      = ref(false);
  const parActivite  = ref([]);
  const parSemaine   = ref([]);

  const defaults = currentAndPrevious12Weeks();
  const filterFrom = ref(defaults.from);
  const filterTo   = ref(defaults.to);

  const totalHeures = computed(() =>
    parActivite.value.reduce((s, r) => s + Number(r.total_heures), 0).toFixed(1)
  );

  const semaines = computed(() => [...new Set(parSemaine.value.map(r => r.iso_week))].sort());

  const tableParSemaine = computed(() => {
    const types = ACTIVITE_OPTIONS.map(a => a.value).concat(['non_defini']);
    return semaines.value.map(week => {
      const row = { iso_week: week };
      let total = 0;
      for (const t of types) {
        const found = parSemaine.value.find(r => r.iso_week === week && r.type_activite === t);
        row[t] = found ? Number(found.total_heures) : 0;
        total += row[t];
      }
      row.total = total.toFixed(1);
      return row;
    });
  });

  async function loadReporting() {
    loading.value = true;
    try {
      const data = await apiFetch(`/reporting/activite?isoWeekFrom=${filterFrom.value}&isoWeekTo=${filterTo.value}`);
      parActivite.value = data.parActivite;
      parSemaine.value  = data.parSemaine;
    } catch (err) {
      showAlert('error', err.message);
    } finally {
      loading.value = false;
    }
  }

  function exportCSV() {
    const url = `/reporting/activite/export.csv?isoWeekFrom=${filterFrom.value}&isoWeekTo=${filterTo.value}`;
    const token = localStorage.getItem('manager_token');
    // Construit un lien avec auth via fetch + blob
    fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.blob())
      .then(blob => {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `reporting_activite_${filterFrom.value}_${filterTo.value}.csv`;
        a.click();
        URL.revokeObjectURL(a.href);
      })
      .catch(() => showAlert('error', "Erreur lors de l'export CSV"));
  }

  return {
    loading, parActivite, parSemaine, filterFrom, filterTo,
    totalHeures, semaines, tableParSemaine,
    loadReporting, exportCSV,
    ACTIVITE_OPTIONS, ACTIVITE_LABELS, ACTIVITE_COLORS, ACTIVITE_STYLES,
  };
}
