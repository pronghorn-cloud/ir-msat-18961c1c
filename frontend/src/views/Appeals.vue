<template>
  <div class="appeals-page">
    <div class="page-header">
      <div class="header-row">
        <div>
          <h1>Appeals</h1>
          <p>Manage appeal cases</p>
        </div>
        <div class="header-actions">
          <goa-button type="secondary" size="compact" @_click="exportCSV" :disabled="appeals.length === 0">
            Export CSV
          </goa-button>
          <goa-button type="primary" @_click="$router.push('/appeals/new')">
            New Appeal
          </goa-button>
        </div>
      </div>
    </div>

    <!-- Filter Panel -->
    <div class="filter-panel">
      <div class="filter-header">
        <span class="filter-title">Filters</span>
        <goa-button type="tertiary" size="compact" @_click="clearFilters" v-if="hasActiveFilters">
          Clear Filters
        </goa-button>
      </div>

      <div class="filter-row">
        <div class="filter-item">
          <label>Search</label>
          <goa-input
            name="search"
            placeholder="File #, description, staff..."
            :value="filters.search"
            @_change="(e) => filters.search = e.detail.value"
            @keyup.enter="applyFilters"
          ></goa-input>
        </div>

        <div class="filter-item">
          <label>Status</label>
          <goa-dropdown name="status" width="100%" :value="filters.status" @_change="(e) => { filters.status = e.detail.value; applyFilters(); }">
            <goa-dropdown-item value="" label="All Statuses"></goa-dropdown-item>
            <goa-dropdown-item v-for="s in statuses" :key="s.name" :value="s.name" :label="s.name"></goa-dropdown-item>
          </goa-dropdown>
        </div>

        <div class="filter-item">
          <label>Stage</label>
          <goa-dropdown name="stage" width="100%" :value="filters.stage" @_change="(e) => { filters.stage = e.detail.value; applyFilters(); }">
            <goa-dropdown-item value="" label="All Stages"></goa-dropdown-item>
            <goa-dropdown-item v-for="st in stages" :key="st.code" :value="st.code" :label="st.code"></goa-dropdown-item>
          </goa-dropdown>
        </div>

        <div class="filter-item">
          <label>Settlement</label>
          <goa-dropdown name="settlement" width="100%" :value="filters.settlement" @_change="(e) => { filters.settlement = e.detail.value; applyFilters(); }">
            <goa-dropdown-item value="" label="All Settlements"></goa-dropdown-item>
            <goa-dropdown-item v-for="s in settlements" :key="s.id" :value="String(s.sort_order)" :label="s.name"></goa-dropdown-item>
          </goa-dropdown>
        </div>
      </div>

      <div class="filter-row">
        <div class="filter-item">
          <label>Issue Type</label>
          <goa-dropdown name="issue_type" width="100%" :value="filters.issue_type" @_change="(e) => { filters.issue_type = e.detail.value; applyFilters(); }">
            <goa-dropdown-item value="" label="All Issue Types"></goa-dropdown-item>
            <goa-dropdown-item v-for="it in issueTypes" :key="it.name" :value="it.name" :label="it.name"></goa-dropdown-item>
          </goa-dropdown>
        </div>

        <div class="filter-item">
          <label>Staff</label>
          <goa-dropdown name="staff" width="100%" :value="filters.staff" @_change="(e) => { filters.staff = e.detail.value; applyFilters(); }">
            <goa-dropdown-item value="" label="All Staff"></goa-dropdown-item>
            <goa-dropdown-item v-for="u in staffList" :key="u.id" :value="u.first_name + ' ' + u.last_name" :label="u.first_name + ' ' + u.last_name"></goa-dropdown-item>
          </goa-dropdown>
        </div>

        <div class="filter-item">
          <label>Date From</label>
          <goa-input type="date" name="date_from" :value="filters.date_from" @_change="(e) => { filters.date_from = e.detail.value; applyFilters(); }"></goa-input>
        </div>

        <div class="filter-item">
          <label>Date To</label>
          <goa-input type="date" name="date_to" :value="filters.date_to" @_change="(e) => { filters.date_to = e.detail.value; applyFilters(); }"></goa-input>
        </div>
      </div>

      <div class="filter-actions">
        <goa-button type="secondary" size="compact" @_click="applyFilters">
          Search
        </goa-button>
      </div>
    </div>

    <!-- Results summary -->
    <div class="results-summary" v-if="!loading">
      <span>{{ total }} appeal{{ total !== 1 ? 's' : '' }} found</span>
    </div>

    <div class="table-container">
      <table class="appeals-table">
        <thead>
          <tr>
            <th>File Number</th>
            <th>Contact Date</th>
            <th>Issue Type</th>
            <th>Status</th>
            <th>Stage</th>
            <th>Primary Staff</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="loading">
            <td colspan="7" class="center-text">Loading appeals...</td>
          </tr>
          <tr v-else-if="appeals.length === 0">
            <td colspan="7" class="center-text">No appeals found</td>
          </tr>
          <tr v-for="appeal in appeals" :key="appeal.id" class="clickable-row" @click="$router.push(`/appeals/${appeal.id}`)">
            <td class="file-number">{{ appeal.file_number }}</td>
            <td>{{ appeal.contact_date ? new Date(appeal.contact_date).toLocaleDateString() : '—' }}</td>
            <td>{{ appeal.issue_type || '—' }}</td>
            <td>
              <span class="status-badge" :class="'status-' + (appeal.status || '').toLowerCase().replace(/\s+/g, '-')">
                {{ appeal.status || '—' }}
              </span>
            </td>
            <td>{{ appeal.stage || '—' }}</td>
            <td>{{ appeal.primary_staff || '—' }}</td>
            <td>
              <goa-button type="tertiary" size="compact" @_click.stop="$router.push(`/appeals/${appeal.id}`)">
                View
              </goa-button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Pagination -->
    <div v-if="total > limit" class="pagination">
      <goa-button type="tertiary" size="compact" :disabled="offset === 0" @_click="prevPage">
        Previous
      </goa-button>
      <span class="page-info">Showing {{ offset + 1 }}–{{ Math.min(offset + limit, total) }} of {{ total }}</span>
      <goa-button type="tertiary" size="compact" :disabled="offset + limit >= total" @_click="nextPage">
        Next
      </goa-button>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue';
import api from '@/services/api.js';

const appeals = ref([]);
const loading = ref(true);
const total = ref(0);
const limit = ref(50);
const offset = ref(0);

// Lookup data for filter dropdowns
const statuses = ref([]);
const stages = ref([]);
const settlements = ref([]);
const issueTypes = ref([]);
const staffList = ref([]);

// Filter state
const filters = reactive({
  search: '',
  status: '',
  stage: '',
  settlement: '',
  issue_type: '',
  staff: '',
  date_from: '',
  date_to: ''
});

const hasActiveFilters = computed(() => {
  return filters.search || filters.status || filters.stage || filters.settlement ||
         filters.issue_type || filters.staff || filters.date_from || filters.date_to;
});

async function loadLookups() {
  try {
    const [settlementsRes, issueTypesRes, statusesRes, stagesRes, staffRes] = await Promise.all([
      api.get('/lookups/settlements'),
      api.get('/lookups/issue-types'),
      api.get('/lookups/appeal-statuses'),
      api.get('/lookups/appeal-stages'),
      api.get('/lookups/staff')
    ]);
    if (settlementsRes.success) settlements.value = settlementsRes.data;
    if (issueTypesRes.success) issueTypes.value = issueTypesRes.data;
    if (statusesRes.success) statuses.value = statusesRes.data;
    if (stagesRes.success) stages.value = stagesRes.data;
    if (staffRes.success) staffList.value = staffRes.data;
  } catch {
    // Lookups fail silently — filters just won't have options
  }
}

function buildQueryString() {
  const params = new URLSearchParams();
  params.set('limit', limit.value);
  params.set('offset', offset.value);
  if (filters.search) params.set('search', filters.search);
  if (filters.status) params.set('status', filters.status);
  if (filters.stage) params.set('stage', filters.stage);
  if (filters.settlement) params.set('settlement', filters.settlement);
  if (filters.issue_type) params.set('issue_type', filters.issue_type);
  if (filters.staff) params.set('staff', filters.staff);
  if (filters.date_from) params.set('date_from', filters.date_from);
  if (filters.date_to) params.set('date_to', filters.date_to);
  return params.toString();
}

async function loadAppeals() {
  loading.value = true;
  try {
    const response = await api.get(`/appeals?${buildQueryString()}`);
    if (response.success) {
      appeals.value = response.data;
      total.value = response.total;
    }
  } catch {
    appeals.value = [];
  } finally {
    loading.value = false;
  }
}

function applyFilters() {
  offset.value = 0;
  loadAppeals();
}

function clearFilters() {
  filters.search = '';
  filters.status = '';
  filters.stage = '';
  filters.settlement = '';
  filters.issue_type = '';
  filters.staff = '';
  filters.date_from = '';
  filters.date_to = '';
  offset.value = 0;
  loadAppeals();
}

function prevPage() {
  offset.value = Math.max(0, offset.value - limit.value);
  loadAppeals();
}

function nextPage() {
  offset.value = offset.value + limit.value;
  loadAppeals();
}

function exportCSV() {
  if (appeals.value.length === 0) return;
  const lines = ['File Number,Contact Date,Issue Type,Status,Stage,Primary Staff'];
  appeals.value.forEach(a => {
    const date = a.contact_date ? new Date(a.contact_date).toLocaleDateString() : '';
    lines.push([
      `"${(a.file_number || '').replace(/"/g, '""')}"`,
      date,
      `"${(a.issue_type || '').replace(/"/g, '""')}"`,
      `"${(a.status || '').replace(/"/g, '""')}"`,
      `"${(a.stage || '').replace(/"/g, '""')}"`,
      `"${(a.primary_staff || '').replace(/"/g, '""')}"`
    ].join(','));
  });
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Appeals_Export_${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

onMounted(() => {
  loadLookups();
  loadAppeals();
});
</script>

<style scoped>
.appeals-page {
  padding: var(--goa-space-m) 0;
}

.page-header {
  margin-bottom: var(--goa-space-l);
}

.header-row {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
}

.header-actions {
  display: flex;
  gap: var(--goa-space-s);
  align-items: center;
}

.page-header h1 {
  font-size: var(--goa-font-size-8, 1.75rem);
  margin-bottom: var(--goa-space-xs);
}

.page-header p {
  color: var(--goa-color-text-secondary, #666);
}

/* Filter Panel */
.filter-panel {
  background: white;
  border: 1px solid var(--goa-color-greyscale-200, #dcdcdc);
  border-radius: var(--goa-border-radius-m, 4px);
  padding: var(--goa-space-m) var(--goa-space-l);
  margin-bottom: var(--goa-space-m);
}

.filter-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--goa-space-s);
}

.filter-title {
  font-weight: var(--goa-font-weight-bold, 700);
  font-size: var(--goa-font-size-5, 1rem);
}

.filter-row {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: var(--goa-space-m);
  margin-bottom: var(--goa-space-s);
}

.filter-item {
  min-width: 0;
}

.filter-item goa-dropdown {
  width: 100%;
  max-width: 100%;
}

.filter-item goa-input {
  width: 100%;
  max-width: 100%;
}

.filter-item label {
  display: block;
  font-size: var(--goa-font-size-3, 0.8rem);
  font-weight: var(--goa-font-weight-bold, 700);
  color: var(--goa-color-text-secondary, #666);
  margin-bottom: var(--goa-space-2xs);
  text-transform: uppercase;
}

.filter-actions {
  display: flex;
  justify-content: flex-end;
  margin-top: var(--goa-space-xs);
}

/* Results summary */
.results-summary {
  margin-bottom: var(--goa-space-s);
  font-size: var(--goa-font-size-4, 0.875rem);
  color: var(--goa-color-text-secondary, #666);
}

.table-container {
  background: white;
  border: 1px solid var(--goa-color-greyscale-200, #dcdcdc);
  border-radius: var(--goa-border-radius-m, 4px);
  overflow-x: auto;
}

.appeals-table {
  width: 100%;
  border-collapse: collapse;
}

.appeals-table th,
.appeals-table td {
  padding: var(--goa-space-s) var(--goa-space-m);
  text-align: left;
  border-bottom: 1px solid var(--goa-color-greyscale-200, #dcdcdc);
}

.appeals-table th {
  background: var(--goa-color-greyscale-100, #f1f1f1);
  font-weight: var(--goa-font-weight-bold, 700);
  font-size: var(--goa-font-size-4, 0.875rem);
}

.appeals-table tbody tr:hover {
  background: var(--goa-color-greyscale-100, #f9f9f9);
}

.clickable-row {
  cursor: pointer;
}

.file-number {
  font-family: monospace;
  font-weight: var(--goa-font-weight-bold, 700);
}

.center-text {
  text-align: center;
  padding: var(--goa-space-xl) !important;
  color: var(--goa-color-text-secondary, #666);
}

.status-badge {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 12px;
  font-size: var(--goa-font-size-3, 0.8rem);
  font-weight: var(--goa-font-weight-bold, 700);
}

.status-active { background: #d1fae5; color: #065f46; }
.status-new { background: #dbeafe; color: #1d4ed8; }
.status-closed { background: #e5e7eb; color: #374151; }
.status-on-hold { background: #fef3c7; color: #b45309; }
.status-withdrawn { background: #fee2e2; color: #991b1b; }
.status-conciliation { background: #ede9fe; color: #6d28d9; }
.status-order-issued { background: #dbeafe; color: #1e40af; }

.pagination {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--goa-space-m);
  margin-top: var(--goa-space-m);
}

.page-info {
  font-size: var(--goa-font-size-4, 0.875rem);
  color: var(--goa-color-text-secondary, #666);
}

@media (max-width: 1024px) {
  .filter-row {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 768px) {
  .filter-row {
    grid-template-columns: 1fr;
  }
}
</style>
