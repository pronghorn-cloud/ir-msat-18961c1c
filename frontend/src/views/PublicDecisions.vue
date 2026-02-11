<template>
  <div class="decisions-page">
    <header class="page-header">
      <h1>Published Decisions</h1>
      <p>Search and browse MSAT tribunal decisions and orders</p>
    </header>

    <!-- Search & Filters -->
    <div class="search-panel">
      <div class="search-row">
        <div class="search-box">
          <input
            type="text"
            class="search-input"
            v-model="searchQuery"
            placeholder="Search by keyword, subject, settlement..."
            @keyup.enter="applySearch"
          />
          <button class="search-btn" @click="applySearch">Search</button>
        </div>
      </div>

      <div class="filter-row">
        <div class="filter-group">
          <label>Settlement</label>
          <select class="filter-input" v-model="settlementFilter" @change="applySearch">
            <option value="">All Settlements</option>
            <option v-for="s in settlements" :key="s" :value="s">{{ s }}</option>
          </select>
        </div>
        <div class="filter-group">
          <label>Issue Type</label>
          <select class="filter-input" v-model="issueTypeFilter" @change="applySearch">
            <option value="">All Issue Types</option>
            <option v-for="t in issueTypes" :key="t" :value="t">{{ t }}</option>
          </select>
        </div>
        <div class="filter-group">
          <label>Year</label>
          <select class="filter-input" v-model="yearFilter" @change="applySearch">
            <option value="">All Years</option>
            <option v-for="y in years" :key="y" :value="y">{{ y }}</option>
          </select>
        </div>
        <div class="filter-actions" v-if="hasActiveFilters">
          <button class="clear-btn" @click="clearFilters">Clear Filters</button>
        </div>
      </div>
    </div>

    <!-- Results summary -->
    <div class="results-bar" v-if="!loading">
      <span class="results-count">{{ total }} decision{{ total !== 1 ? 's' : '' }} found</span>
      <span v-if="searchTime > 0" class="search-time">({{ searchTime }}ms)</span>
    </div>

    <!-- Results table -->
    <div class="table-container">
      <table class="decisions-table">
        <thead>
          <tr>
            <th>Order #</th>
            <th>Date</th>
            <th>Subject / Keywords</th>
            <th>Settlement</th>
            <th>Issue Type</th>
            <th>View</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="loading">
            <td colspan="6" class="center-text">Loading decisions...</td>
          </tr>
          <tr v-else-if="decisions.length === 0">
            <td colspan="6" class="center-text">No decisions found</td>
          </tr>
          <tr v-for="d in decisions" :key="d.id">
            <td class="order-num">{{ d.order_number }}</td>
            <td class="date-col">{{ formatDate(d.issue_date) }}</td>
            <td class="keyword-col">
              <span class="keyword-text">{{ d.keyword || '—' }}</span>
              <div v-if="d.app_for_leave" class="leave-badge">
                App for Leave{{ d.leave_granted ? ' (Granted)' : '' }}
              </div>
            </td>
            <td>{{ d.settlement_name || '—' }}</td>
            <td>
              <span v-if="d.issue_type" class="issue-badge">{{ d.issue_type }}</span>
              <span v-else>—</span>
            </td>
            <td>
              <a
                v-if="d.document_url"
                :href="d.document_url"
                target="_blank"
                rel="noopener"
                class="pdf-link"
              >
                PDF
              </a>
              <span v-else class="no-doc">—</span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Pagination -->
    <div v-if="total > limit" class="pagination">
      <button class="page-btn" :disabled="offset === 0" @click="prevPage">Previous</button>
      <span class="page-info">
        Showing {{ offset + 1 }}–{{ Math.min(offset + limit, total) }} of {{ total }}
      </span>
      <button class="page-btn" :disabled="offset + limit >= total" @click="nextPage">Next</button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import api from '@/services/api.js';

const decisions = ref([]);
const loading = ref(true);
const total = ref(0);
const limit = ref(20);
const offset = ref(0);
const searchTime = ref(0);

const searchQuery = ref('');
const activeSearch = ref('');
const settlementFilter = ref('');
const issueTypeFilter = ref('');
const yearFilter = ref('');

const settlements = ref([]);
const issueTypes = ref([]);
const years = ref([]);

const hasActiveFilters = computed(() => {
  return searchQuery.value || settlementFilter.value || issueTypeFilter.value || yearFilter.value;
});

async function loadFilters() {
  try {
    const [settRes, typeRes, yearRes] = await Promise.all([
      api.get('/public/decisions/settlements'),
      api.get('/public/decisions/issue-types'),
      api.get('/public/decisions/years')
    ]);
    if (settRes.success) settlements.value = settRes.data;
    if (typeRes.success) issueTypes.value = typeRes.data;
    if (yearRes.success) years.value = yearRes.data;
  } catch {
    // silent
  }
}

async function loadDecisions() {
  loading.value = true;
  const start = Date.now();
  try {
    const params = new URLSearchParams();
    params.set('limit', limit.value);
    params.set('offset', offset.value);
    if (activeSearch.value) params.set('search', activeSearch.value);
    if (settlementFilter.value) params.set('settlement', settlementFilter.value);
    if (issueTypeFilter.value) params.set('issue_type', issueTypeFilter.value);
    if (yearFilter.value) params.set('year', yearFilter.value);

    const response = await api.get(`/public/decisions?${params.toString()}`);
    if (response.success) {
      decisions.value = response.data;
      total.value = response.total;
    }
  } catch {
    decisions.value = [];
  } finally {
    searchTime.value = Date.now() - start;
    loading.value = false;
  }
}

function applySearch() {
  activeSearch.value = searchQuery.value;
  offset.value = 0;
  loadDecisions();
}

function clearFilters() {
  searchQuery.value = '';
  activeSearch.value = '';
  settlementFilter.value = '';
  issueTypeFilter.value = '';
  yearFilter.value = '';
  offset.value = 0;
  loadDecisions();
}

function prevPage() {
  offset.value = Math.max(0, offset.value - limit.value);
  loadDecisions();
}

function nextPage() {
  offset.value = offset.value + limit.value;
  loadDecisions();
}

function formatDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-CA');
}

onMounted(() => {
  loadFilters();
  loadDecisions();
});
</script>

<style scoped>
.decisions-page {
  max-width: 1200px;
  margin: 0 auto;
  padding: var(--goa-space-m) 0;
}

.page-header {
  margin-bottom: var(--goa-space-l);
}

.page-header h1 {
  font-size: var(--goa-font-size-8, 1.75rem);
  font-weight: var(--goa-font-weight-bold);
  color: var(--goa-color-text-default);
  margin-bottom: var(--goa-space-xs);
}

.page-header p {
  font-size: var(--goa-font-size-4);
  color: var(--goa-color-text-secondary);
}

/* Search panel */
.search-panel {
  background: white;
  border: 1px solid var(--goa-color-greyscale-200, #dcdcdc);
  border-radius: var(--goa-border-radius-m, 4px);
  padding: var(--goa-space-l);
  margin-bottom: var(--goa-space-m);
}

.search-row {
  margin-bottom: var(--goa-space-m);
}

.search-box {
  display: flex;
  gap: var(--goa-space-s);
}

.search-input {
  flex: 1;
  padding: 10px 14px;
  font-size: var(--goa-font-size-4, 1rem);
  border: 1px solid var(--goa-color-greyscale-400, #999);
  border-radius: var(--goa-border-radius-s, 4px);
  font-family: inherit;
}

.search-input:focus {
  outline: 2px solid var(--goa-color-interactive-default, #0070c4);
  border-color: var(--goa-color-interactive-default, #0070c4);
}

.search-btn {
  padding: 10px 24px;
  background: var(--goa-color-interactive-default, #0070c4);
  color: white;
  border: none;
  border-radius: var(--goa-border-radius-s, 4px);
  font-size: var(--goa-font-size-4, 1rem);
  font-weight: var(--goa-font-weight-bold);
  cursor: pointer;
}

.search-btn:hover {
  background: var(--goa-color-interactive-hover, #004f8a);
}

.filter-row {
  display: flex;
  gap: var(--goa-space-m);
  align-items: flex-end;
  flex-wrap: wrap;
}

.filter-group {
  flex: 1;
  min-width: 150px;
}

.filter-group label {
  display: block;
  font-size: var(--goa-font-size-3, 0.8rem);
  font-weight: var(--goa-font-weight-bold);
  color: var(--goa-color-text-secondary);
  text-transform: uppercase;
  margin-bottom: var(--goa-space-2xs);
}

.filter-input {
  width: 100%;
  padding: 8px 10px;
  font-size: var(--goa-font-size-4, 1rem);
  border: 1px solid var(--goa-color-greyscale-400, #999);
  border-radius: var(--goa-border-radius-s, 4px);
  font-family: inherit;
}

.filter-actions {
  display: flex;
  align-items: flex-end;
}

.clear-btn {
  padding: 8px 16px;
  background: none;
  border: 1px solid var(--goa-color-greyscale-400, #999);
  border-radius: var(--goa-border-radius-s, 4px);
  color: var(--goa-color-text-secondary);
  cursor: pointer;
  font-size: var(--goa-font-size-3);
}

.clear-btn:hover {
  background: var(--goa-color-greyscale-100);
}

/* Results */
.results-bar {
  display: flex;
  align-items: center;
  gap: var(--goa-space-s);
  margin-bottom: var(--goa-space-s);
}

.results-count {
  font-size: var(--goa-font-size-4);
  color: var(--goa-color-text-secondary);
}

.search-time {
  font-size: var(--goa-font-size-3);
  color: var(--goa-color-text-secondary);
}

/* Table */
.table-container {
  background: white;
  border: 1px solid var(--goa-color-greyscale-200, #dcdcdc);
  border-radius: var(--goa-border-radius-m, 4px);
  overflow-x: auto;
}

.decisions-table {
  width: 100%;
  border-collapse: collapse;
}

.decisions-table th,
.decisions-table td {
  padding: var(--goa-space-s) var(--goa-space-m);
  text-align: left;
  border-bottom: 1px solid var(--goa-color-greyscale-200, #dcdcdc);
}

.decisions-table th {
  background: var(--goa-color-greyscale-100, #f1f1f1);
  font-weight: var(--goa-font-weight-bold);
  font-size: var(--goa-font-size-4, 0.875rem);
  white-space: nowrap;
}

.decisions-table tbody tr:hover {
  background: var(--goa-color-greyscale-100, #f9f9f9);
}

.order-num {
  font-family: monospace;
  font-weight: var(--goa-font-weight-bold);
  white-space: nowrap;
}

.date-col {
  white-space: nowrap;
}

.keyword-col {
  max-width: 350px;
}

.keyword-text {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  font-size: var(--goa-font-size-4);
}

.leave-badge {
  display: inline-block;
  margin-top: 4px;
  padding: 1px 6px;
  font-size: var(--goa-font-size-2, 0.7rem);
  background: #fef3c7;
  color: #b45309;
  border-radius: 8px;
}

.issue-badge {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 12px;
  font-size: var(--goa-font-size-3, 0.8rem);
  font-weight: var(--goa-font-weight-bold);
  background: #dbeafe;
  color: #1d4ed8;
}

.center-text {
  text-align: center;
  padding: var(--goa-space-xl) !important;
  color: var(--goa-color-text-secondary);
}

.pdf-link {
  display: inline-block;
  padding: 4px 10px;
  background: #dc2626;
  color: white;
  border-radius: 4px;
  text-decoration: none;
  font-size: var(--goa-font-size-3);
  font-weight: var(--goa-font-weight-bold);
}

.pdf-link:hover {
  background: #b91c1c;
}

.no-doc {
  color: var(--goa-color-text-secondary);
}

/* Pagination */
.pagination {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--goa-space-m);
  margin-top: var(--goa-space-m);
}

.page-btn {
  padding: 8px 16px;
  background: white;
  border: 1px solid var(--goa-color-greyscale-300, #ccc);
  border-radius: var(--goa-border-radius-s, 4px);
  cursor: pointer;
  font-size: var(--goa-font-size-4);
}

.page-btn:hover:not(:disabled) {
  background: var(--goa-color-greyscale-100);
}

.page-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.page-info {
  font-size: var(--goa-font-size-4);
  color: var(--goa-color-text-secondary);
}

@media (max-width: 768px) {
  .filter-row {
    flex-direction: column;
  }

  .filter-group {
    min-width: unset;
    width: 100%;
  }

  .keyword-col {
    max-width: 200px;
  }
}
</style>
