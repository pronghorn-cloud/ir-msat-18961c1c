<template>
  <div class="dashboard">
    <div class="page-header">
      <h1>MSAT Analytics Dashboard</h1>
      <p>Welcome back, {{ user?.first_name }} {{ user?.last_name }}</p>
    </div>

    <!-- Filters -->
    <div class="filter-bar">
      <div class="filter-group">
        <label for="filter-settlement">Settlement</label>
        <select id="filter-settlement" class="form-select" v-model="filterSettlement" @change="loadAll">
          <option value="">All Settlements</option>
          <option v-for="s in settlements" :key="s" :value="s">{{ s }}</option>
        </select>
      </div>
      <div class="filter-group">
        <label for="filter-from">From</label>
        <input id="filter-from" type="date" class="form-input" v-model="filterFrom" @change="loadAll" />
      </div>
      <div class="filter-group">
        <label for="filter-to">To</label>
        <input id="filter-to" type="date" class="form-input" v-model="filterTo" @change="loadAll" />
      </div>
      <div class="filter-group filter-actions">
        <goa-button type="tertiary" size="compact" @_click="resetFilters">Reset Filters</goa-button>
      </div>
    </div>

    <!-- Summary Cards -->
    <div class="dashboard-cards">
      <div class="stat-card" v-for="stat in stats" :key="stat.label">
        <div class="stat-value">{{ stat.value }}</div>
        <div class="stat-label">{{ stat.label }}</div>
        <div class="stat-sub" v-if="stat.sub">{{ stat.sub }}</div>
      </div>
    </div>

    <!-- Charts Row 1: Appeals by Year + Appeals by Issue Type -->
    <div class="charts-row">
      <div class="chart-card chart-wide">
        <h3>Appeals Filed by Year</h3>
        <div class="chart-container">
          <Bar v-if="yearChartData" :data="yearChartData" :options="barOptions" />
          <p v-else class="chart-loading">Loading...</p>
        </div>
      </div>
      <div class="chart-card chart-narrow">
        <h3>Appeals by Issue Type</h3>
        <div class="chart-container">
          <Doughnut v-if="issueChartData" :data="issueChartData" :options="doughnutOptions" />
          <p v-else class="chart-loading">Loading...</p>
        </div>
      </div>
    </div>

    <!-- Charts Row 2: Appeals by Settlement -->
    <div class="charts-row">
      <div class="chart-card chart-full">
        <h3>Appeals by Settlement</h3>
        <div class="chart-container chart-container-short">
          <Bar v-if="settlementChartData" :data="settlementChartData" :options="hBarOptions" />
          <p v-else class="chart-loading">Loading...</p>
        </div>
      </div>
    </div>

    <!-- Quick Actions -->
    <div class="quick-actions">
      <h2>Quick Actions</h2>
      <div class="action-grid">
        <goa-button type="primary" @_click="navigate('/appeals')">
          View Appeals
        </goa-button>
        <goa-button type="secondary" @_click="navigate('/clients')">
          View Clients
        </goa-button>
        <goa-button type="secondary" @_click="navigate('/organizations')">
          View Organizations
        </goa-button>
        <goa-button type="secondary" @_click="navigate('/lap')">
          LAP Module
        </goa-button>
        <goa-button type="secondary" @_click="navigate('/annual-report')">
          Annual Report
        </goa-button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { authState } from '@/services/auth.js';
import api from '@/services/api.js';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend
} from 'chart.js';
import { Bar, Doughnut } from 'vue-chartjs';

ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, Title, Tooltip, Legend);

const router = useRouter();
const user = ref(authState.user);

// Filters
const settlements = ref([]);
const filterSettlement = ref('');
const filterFrom = ref('');
const filterTo = ref('');

// Summary cards
const stats = ref([
  { label: 'Active Appeals', value: '...' },
  { label: 'Filed This FY', value: '...' },
  { label: 'Orders Issued This FY', value: '...' },
  { label: 'Avg Resolution (days)', value: '...' },
  { label: 'Active LAP Applications', value: '...' },
  { label: 'Awaiting Hearing', value: '...' }
]);

// Chart data refs
const yearChartData = ref(null);
const issueChartData = ref(null);
const settlementChartData = ref(null);

// Chart color palettes
const BLUE_PALETTE = [
  '#0070c4', '#0054a0', '#338fd4', '#66aee3', '#99cdf1',
  '#004080', '#1a8cd8', '#4da6e0', '#80c0e8', '#b3daf0'
];

const ISSUE_COLORS = [
  '#0070c4', '#e8573a', '#f2a71e', '#28a745', '#6f42c1',
  '#17a2b8', '#fd7e14', '#6c757d', '#dc3545', '#20c997'
];

const SETTLEMENT_COLORS = [
  '#0070c4', '#338fd4', '#0054a0', '#66aee3', '#004080',
  '#1a8cd8', '#4da6e0', '#99cdf1'
];

// Chart options
const barOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { display: false },
    tooltip: { mode: 'index', intersect: false }
  },
  scales: {
    y: { beginAtZero: true, ticks: { precision: 0 } }
  }
};

const hBarOptions = {
  responsive: true,
  maintainAspectRatio: false,
  indexAxis: 'y',
  plugins: {
    legend: { display: false },
    tooltip: { mode: 'index', intersect: false }
  },
  scales: {
    x: { beginAtZero: true, ticks: { precision: 0 } }
  }
};

const doughnutOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { position: 'right', labels: { boxWidth: 12, padding: 8, font: { size: 11 } } },
    tooltip: {
      callbacks: {
        label: (ctx) => {
          const total = ctx.dataset.data.reduce((a, b) => a + b, 0);
          const pct = total > 0 ? Math.round(ctx.parsed * 100 / total) : 0;
          return `${ctx.label}: ${ctx.parsed} (${pct}%)`;
        }
      }
    }
  }
};

const navigate = (path) => {
  router.push(path);
};

function buildQueryString() {
  const params = new URLSearchParams();
  if (filterSettlement.value) params.set('settlement', filterSettlement.value);
  if (filterFrom.value) params.set('date_from', filterFrom.value);
  if (filterTo.value) params.set('date_to', filterTo.value);
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

async function loadSummary() {
  try {
    const response = await api.get(`/analytics/summary${buildQueryString()}`);
    if (response.success) {
      const d = response.data;
      stats.value = [
        { label: 'Active Appeals', value: d.active_appeals.toLocaleString() },
        { label: 'Filed This FY', value: d.filed_this_fy.toLocaleString(), sub: `FY ${d.fiscal_year}` },
        { label: 'Orders Issued This FY', value: d.orders_this_fy.toLocaleString(), sub: `FY ${d.fiscal_year}` },
        { label: 'Avg Resolution (days)', value: d.avg_resolution_days.toLocaleString() },
        { label: 'Active LAP Applications', value: d.active_lap.toLocaleString() },
        { label: 'Awaiting Hearing', value: d.awaiting_hearing.toLocaleString() }
      ];
    }
  } catch {
    // Keep placeholder
  }
}

async function loadAppealsByYear() {
  try {
    const response = await api.get(`/analytics/appeals-by-year${buildQueryString()}`);
    if (response.success && response.data.length > 0) {
      // Show last 15 years max
      const recent = response.data.slice(-15);
      yearChartData.value = {
        labels: recent.map(r => r.year.toString()),
        datasets: [{
          data: recent.map(r => r.count),
          backgroundColor: BLUE_PALETTE[0],
          borderRadius: 3
        }]
      };
    }
  } catch {
    // Skip chart
  }
}

async function loadAppealsByIssue() {
  try {
    const response = await api.get(`/analytics/appeals-by-issue${buildQueryString()}`);
    if (response.success && response.data.length > 0) {
      // Show top 8, group rest as "Other"
      const top = response.data.slice(0, 8);
      const rest = response.data.slice(8);
      const otherCount = rest.reduce((sum, r) => sum + r.count, 0);
      const labels = top.map(r => r.issue_type);
      const values = top.map(r => r.count);
      if (otherCount > 0) {
        labels.push('Other');
        values.push(otherCount);
      }
      issueChartData.value = {
        labels,
        datasets: [{
          data: values,
          backgroundColor: ISSUE_COLORS.slice(0, labels.length)
        }]
      };
    }
  } catch {
    // Skip chart
  }
}

async function loadAppealsBySettlement() {
  try {
    const qs = buildQueryString();
    // Remove settlement filter for this chart (it shows all settlements)
    const params = new URLSearchParams();
    if (filterFrom.value) params.set('date_from', filterFrom.value);
    if (filterTo.value) params.set('date_to', filterTo.value);
    const settlementQs = params.toString() ? `?${params.toString()}` : '';
    const response = await api.get(`/analytics/appeals-by-settlement${settlementQs}`);
    if (response.success && response.data.length > 0) {
      settlementChartData.value = {
        labels: response.data.map(r => r.settlement),
        datasets: [{
          data: response.data.map(r => r.count),
          backgroundColor: SETTLEMENT_COLORS.slice(0, response.data.length),
          borderRadius: 3
        }]
      };
    }
  } catch {
    // Skip chart
  }
}

async function loadSettlements() {
  try {
    const response = await api.get('/analytics/settlements');
    if (response.success) {
      settlements.value = response.data;
    }
  } catch {
    // Skip
  }
}

function resetFilters() {
  filterSettlement.value = '';
  filterFrom.value = '';
  filterTo.value = '';
  loadAll();
}

async function loadAll() {
  // Reset chart data to trigger re-render
  yearChartData.value = null;
  issueChartData.value = null;
  settlementChartData.value = null;

  await Promise.all([
    loadSummary(),
    loadAppealsByYear(),
    loadAppealsByIssue(),
    loadAppealsBySettlement()
  ]);
}

onMounted(() => {
  loadSettlements();
  loadAll();
});
</script>

<style scoped>
.dashboard {
  padding: var(--goa-space-m) 0;
}

.page-header {
  margin-bottom: var(--goa-space-l);
}

.page-header h1 {
  font-size: var(--goa-font-size-8, 1.75rem);
  margin-bottom: var(--goa-space-xs);
}

.page-header p {
  color: var(--goa-color-text-secondary, #666);
}

/* Filters */
.filter-bar {
  display: flex;
  gap: var(--goa-space-m);
  align-items: flex-end;
  flex-wrap: wrap;
  margin-bottom: var(--goa-space-l);
  padding: var(--goa-space-m);
  background: var(--goa-color-greyscale-100, #f1f1f1);
  border-radius: var(--goa-border-radius-m, 4px);
}

.filter-group {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.filter-group label {
  font-size: var(--goa-font-size-3, 0.8125rem);
  font-weight: var(--goa-font-weight-bold, 700);
  color: var(--goa-color-text-secondary, #666);
}

.form-select, .form-input {
  padding: 6px 10px;
  border: 1px solid var(--goa-color-greyscale-400, #999);
  border-radius: var(--goa-border-radius-m, 4px);
  font-size: var(--goa-font-size-4, 0.875rem);
  min-width: 160px;
}

.filter-actions {
  justify-content: flex-end;
}

/* Summary Cards */
.dashboard-cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(170px, 1fr));
  gap: var(--goa-space-m);
  margin-bottom: var(--goa-space-xl);
}

.stat-card {
  background: white;
  border: 1px solid var(--goa-color-greyscale-200, #dcdcdc);
  border-radius: var(--goa-border-radius-m, 4px);
  padding: var(--goa-space-l);
  text-align: center;
}

.stat-value {
  font-size: var(--goa-font-size-9, 2rem);
  font-weight: var(--goa-font-weight-bold, 700);
  color: var(--goa-color-interactive-default, #0070c4);
}

.stat-label {
  font-size: var(--goa-font-size-4, 0.875rem);
  color: var(--goa-color-text-secondary, #666);
  margin-top: var(--goa-space-xs);
}

.stat-sub {
  font-size: var(--goa-font-size-2, 0.75rem);
  color: var(--goa-color-text-secondary, #999);
  margin-top: 2px;
}

/* Charts */
.charts-row {
  display: flex;
  gap: var(--goa-space-m);
  margin-bottom: var(--goa-space-l);
  flex-wrap: wrap;
}

.chart-card {
  background: white;
  border: 1px solid var(--goa-color-greyscale-200, #dcdcdc);
  border-radius: var(--goa-border-radius-m, 4px);
  padding: var(--goa-space-l);
}

.chart-card h3 {
  font-size: var(--goa-font-size-5, 1rem);
  margin-bottom: var(--goa-space-m);
}

.chart-wide {
  flex: 2;
  min-width: 400px;
}

.chart-narrow {
  flex: 1;
  min-width: 300px;
}

.chart-full {
  flex: 1 1 100%;
}

.chart-container {
  height: 300px;
  position: relative;
}

.chart-container-short {
  height: 250px;
}

.chart-loading {
  color: var(--goa-color-text-secondary, #666);
  text-align: center;
  padding-top: 100px;
}

/* Quick Actions */
.quick-actions {
  margin-top: var(--goa-space-l);
}

.quick-actions h2 {
  font-size: var(--goa-font-size-6, 1.25rem);
  margin-bottom: var(--goa-space-m);
}

.action-grid {
  display: flex;
  gap: var(--goa-space-m);
  flex-wrap: wrap;
}

@media (max-width: 768px) {
  .charts-row {
    flex-direction: column;
  }
  .chart-wide, .chart-narrow {
    min-width: 100%;
  }
  .dashboard-cards {
    grid-template-columns: repeat(2, 1fr);
  }
}
</style>
