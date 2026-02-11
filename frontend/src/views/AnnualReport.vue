<template>
  <div class="annual-report">
    <div class="page-header">
      <div class="header-row">
        <div>
          <h1>Annual Report Generator</h1>
          <p>Generate statistics for the MSAT Annual Report tabled with the Alberta Legislature</p>
        </div>
        <router-link to="/dashboard" class="back-link">
          <goa-button type="tertiary" size="compact">Back to Dashboard</goa-button>
        </router-link>
      </div>
    </div>

    <!-- Fiscal Year Selector -->
    <div class="fy-selector">
      <label for="fy-select">Fiscal Year (April 1 – March 31)</label>
      <select id="fy-select" class="form-select" v-model="selectedFY" @change="loadReport">
        <option v-for="fy in fiscalYears" :key="fy.value" :value="fy.value">{{ fy.label }}</option>
      </select>
      <goa-button type="secondary" size="compact" @_click="exportCSV">Export to CSV</goa-button>
    </div>

    <div v-if="loading" class="loading-msg">Loading report data...</div>

    <div v-if="report" class="report-content">
      <!-- Summary Statistics -->
      <section class="report-section">
        <h2>Summary Statistics — FY {{ report.fiscal_year }}</h2>
        <div class="summary-grid">
          <div class="summary-item">
            <span class="summary-value">{{ report.summary.appeals_filed }}</span>
            <span class="summary-label">Appeals Filed</span>
          </div>
          <div class="summary-item">
            <span class="summary-value">{{ report.summary.appeals_resolved }}</span>
            <span class="summary-label">Appeals Resolved</span>
          </div>
          <div class="summary-item">
            <span class="summary-value">{{ report.summary.orders_issued }}</span>
            <span class="summary-label">Orders Issued</span>
          </div>
          <div class="summary-item">
            <span class="summary-value">{{ report.summary.avg_resolution_days }}</span>
            <span class="summary-label">Avg Resolution (days)</span>
          </div>
          <div class="summary-item">
            <span class="summary-value">{{ report.summary.active_appeals }}</span>
            <span class="summary-label">Currently Active</span>
          </div>
        </div>
      </section>

      <!-- Appeals by Settlement -->
      <section class="report-section">
        <h2>Appeals by Settlement</h2>
        <table class="report-table">
          <thead>
            <tr>
              <th>Settlement</th>
              <th>Filed</th>
              <th>Resolved</th>
              <th>Currently Active</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in report.by_settlement" :key="row.settlement">
              <td>{{ row.settlement }}</td>
              <td>{{ row.filed }}</td>
              <td>{{ row.resolved }}</td>
              <td>{{ row.active }}</td>
            </tr>
          </tbody>
          <tfoot>
            <tr>
              <td><strong>Total</strong></td>
              <td><strong>{{ totals.settlement_filed }}</strong></td>
              <td><strong>{{ totals.settlement_resolved }}</strong></td>
              <td><strong>{{ totals.settlement_active }}</strong></td>
            </tr>
          </tfoot>
        </table>
      </section>

      <!-- Appeals by Issue Type -->
      <section class="report-section">
        <h2>Appeals by Issue Type</h2>
        <table class="report-table">
          <thead>
            <tr>
              <th>Issue Type</th>
              <th>Count</th>
              <th>Percentage</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in report.by_issue_type" :key="row.issue_type">
              <td>{{ row.issue_type }}</td>
              <td>{{ row.count }}</td>
              <td>{{ row.percentage }}%</td>
            </tr>
          </tbody>
        </table>
      </section>

      <!-- Mediation / Conciliation -->
      <section class="report-section">
        <h2>Mediation / Conciliation</h2>
        <div class="summary-grid">
          <div class="summary-item">
            <span class="summary-value">{{ report.mediation.cases_in_mediation }}</span>
            <span class="summary-label">Cases in Mediation</span>
          </div>
          <div class="summary-item">
            <span class="summary-value">{{ report.mediation.resolved_via_mediation }}</span>
            <span class="summary-label">Resolved via Mediation</span>
          </div>
          <div class="summary-item">
            <span class="summary-value">{{ report.mediation.mediation_rate_percent }}%</span>
            <span class="summary-label">Mediation Success Rate</span>
          </div>
        </div>
      </section>

      <!-- Orders Issued -->
      <section class="report-section">
        <h2>Orders Issued</h2>
        <p class="orders-stat">
          <strong>{{ report.summary.orders_issued }}</strong> orders were issued during FY {{ report.fiscal_year }}.
        </p>
      </section>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import api from '@/services/api.js';

const fiscalYears = ref([]);
const selectedFY = ref(null);
const report = ref(null);
const loading = ref(false);

const totals = computed(() => {
  if (!report.value) return {};
  const s = report.value.by_settlement;
  return {
    settlement_filed: s.reduce((sum, r) => sum + r.filed, 0),
    settlement_resolved: s.reduce((sum, r) => sum + r.resolved, 0),
    settlement_active: s.reduce((sum, r) => sum + r.active, 0)
  };
});

async function loadFiscalYears() {
  try {
    const response = await api.get('/analytics/fiscal-years');
    if (response.success) {
      fiscalYears.value = response.data;
      if (response.data.length > 0) {
        selectedFY.value = response.data[0].value;
      }
    }
  } catch {
    // Skip
  }
}

async function loadReport() {
  if (!selectedFY.value) return;
  loading.value = true;
  report.value = null;
  try {
    const response = await api.get(`/analytics/annual-report?fy=${selectedFY.value}`);
    if (response.success) {
      report.value = response.data;
    }
  } catch {
    // Skip
  } finally {
    loading.value = false;
  }
}

function exportCSV() {
  if (!report.value) return;
  const r = report.value;
  const lines = [];

  // Header
  lines.push(`MSAT Annual Report — Fiscal Year ${r.fiscal_year}`);
  lines.push(`Generated: ${new Date().toISOString().split('T')[0]}`);
  lines.push('');

  // Summary
  lines.push('SUMMARY STATISTICS');
  lines.push('Metric,Value');
  lines.push(`Appeals Filed,${r.summary.appeals_filed}`);
  lines.push(`Appeals Resolved,${r.summary.appeals_resolved}`);
  lines.push(`Orders Issued,${r.summary.orders_issued}`);
  lines.push(`Avg Resolution Days,${r.summary.avg_resolution_days}`);
  lines.push(`Currently Active Appeals,${r.summary.active_appeals}`);
  lines.push('');

  // By Settlement
  lines.push('APPEALS BY SETTLEMENT');
  lines.push('Settlement,Filed,Resolved,Active');
  r.by_settlement.forEach(row => {
    lines.push(`${row.settlement},${row.filed},${row.resolved},${row.active}`);
  });
  lines.push('');

  // By Issue Type
  lines.push('APPEALS BY ISSUE TYPE');
  lines.push('Issue Type,Count,Percentage');
  r.by_issue_type.forEach(row => {
    lines.push(`"${row.issue_type}",${row.count},${row.percentage}%`);
  });
  lines.push('');

  // Mediation
  lines.push('MEDIATION / CONCILIATION');
  lines.push('Metric,Value');
  lines.push(`Cases in Mediation,${r.mediation.cases_in_mediation}`);
  lines.push(`Resolved via Mediation,${r.mediation.resolved_via_mediation}`);
  lines.push(`Mediation Success Rate,${r.mediation.mediation_rate_percent}%`);

  const csv = lines.join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `MSAT_Annual_Report_FY${r.fiscal_year.replace('/', '-')}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

onMounted(async () => {
  await loadFiscalYears();
  await loadReport();
});
</script>

<style scoped>
.annual-report {
  padding: var(--goa-space-m) 0;
}

.page-header {
  margin-bottom: var(--goa-space-l);
}

.header-row {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  flex-wrap: wrap;
  gap: var(--goa-space-m);
}

.page-header h1 {
  font-size: var(--goa-font-size-8, 1.75rem);
  margin-bottom: var(--goa-space-xs);
}

.page-header p {
  color: var(--goa-color-text-secondary, #666);
}

.back-link {
  text-decoration: none;
}

/* FY Selector */
.fy-selector {
  display: flex;
  align-items: flex-end;
  gap: var(--goa-space-m);
  margin-bottom: var(--goa-space-xl);
  padding: var(--goa-space-m);
  background: var(--goa-color-greyscale-100, #f1f1f1);
  border-radius: var(--goa-border-radius-m, 4px);
  flex-wrap: wrap;
}

.fy-selector label {
  font-size: var(--goa-font-size-4, 0.875rem);
  font-weight: var(--goa-font-weight-bold, 700);
  color: var(--goa-color-text-secondary, #666);
  align-self: center;
}

.form-select {
  padding: 6px 10px;
  border: 1px solid var(--goa-color-greyscale-400, #999);
  border-radius: var(--goa-border-radius-m, 4px);
  font-size: var(--goa-font-size-4, 0.875rem);
  min-width: 160px;
}

.loading-msg {
  color: var(--goa-color-text-secondary, #666);
  padding: var(--goa-space-xl);
  text-align: center;
}

/* Report content */
.report-section {
  margin-bottom: var(--goa-space-xl);
}

.report-section h2 {
  font-size: var(--goa-font-size-6, 1.25rem);
  margin-bottom: var(--goa-space-m);
  padding-bottom: var(--goa-space-xs);
  border-bottom: 2px solid var(--goa-color-interactive-default, #0070c4);
}

/* Summary grid */
.summary-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: var(--goa-space-m);
}

.summary-item {
  background: white;
  border: 1px solid var(--goa-color-greyscale-200, #dcdcdc);
  border-radius: var(--goa-border-radius-m, 4px);
  padding: var(--goa-space-l);
  text-align: center;
}

.summary-value {
  display: block;
  font-size: var(--goa-font-size-9, 2rem);
  font-weight: var(--goa-font-weight-bold, 700);
  color: var(--goa-color-interactive-default, #0070c4);
}

.summary-label {
  display: block;
  font-size: var(--goa-font-size-4, 0.875rem);
  color: var(--goa-color-text-secondary, #666);
  margin-top: var(--goa-space-xs);
}

/* Tables */
.report-table {
  width: 100%;
  border-collapse: collapse;
  background: white;
}

.report-table th,
.report-table td {
  padding: var(--goa-space-s) var(--goa-space-m);
  text-align: left;
  border-bottom: 1px solid var(--goa-color-greyscale-200, #dcdcdc);
}

.report-table th {
  background: var(--goa-color-greyscale-100, #f1f1f1);
  font-weight: var(--goa-font-weight-bold, 700);
  font-size: var(--goa-font-size-4, 0.875rem);
}

.report-table td {
  font-size: var(--goa-font-size-4, 0.875rem);
}

.report-table tfoot td {
  border-top: 2px solid var(--goa-color-greyscale-400, #999);
  font-weight: var(--goa-font-weight-bold, 700);
}

.orders-stat {
  font-size: var(--goa-font-size-5, 1rem);
  padding: var(--goa-space-m);
  background: white;
  border: 1px solid var(--goa-color-greyscale-200, #dcdcdc);
  border-radius: var(--goa-border-radius-m, 4px);
}

.orders-stat strong {
  color: var(--goa-color-interactive-default, #0070c4);
  font-size: var(--goa-font-size-7, 1.5rem);
}
</style>
