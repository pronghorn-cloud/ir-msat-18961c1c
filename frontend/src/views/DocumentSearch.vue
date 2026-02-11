<template>
  <div class="documents-page">
    <div class="page-header">
      <h1>Document Search</h1>
      <p>Search across all uploaded documents by keyword, category, or date</p>
    </div>

    <!-- Search & Filters -->
    <div class="search-section">
      <div class="search-bar">
        <input
          type="text"
          class="search-input-large"
          v-model="searchQuery"
          placeholder="Search documents by name, description, category, appeal file number..."
          @keyup.enter="applySearch"
        />
        <goa-button type="primary" size="compact" @_click="applySearch">Search</goa-button>
      </div>

      <div class="filters-row">
        <div class="filter-group">
          <label>Category</label>
          <select class="filter-input" v-model="categoryFilter" @change="applySearch">
            <option value="">All Categories</option>
            <option v-for="cat in categories" :key="cat" :value="cat">{{ cat }}</option>
          </select>
        </div>
        <div class="filter-group">
          <label>Appeal</label>
          <select class="filter-input" v-model="appealFilter" @change="applySearch">
            <option value="">All Appeals</option>
            <option v-for="a in appeals" :key="a.id" :value="a.id">{{ a.file_number }}</option>
          </select>
        </div>
        <div class="filter-group">
          <label>Settlement</label>
          <select class="filter-input" v-model="settlementFilter" @change="applySearch">
            <option value="">All Settlements</option>
            <option v-for="s in settlements" :key="s" :value="s">{{ s }}</option>
          </select>
        </div>
        <div class="filter-group">
          <label>From</label>
          <input type="date" class="filter-input" v-model="dateFrom" @change="applySearch" />
        </div>
        <div class="filter-group">
          <label>To</label>
          <input type="date" class="filter-input" v-model="dateTo" @change="applySearch" />
        </div>
        <div class="filter-actions">
          <goa-button
            v-if="hasActiveFilters"
            type="tertiary"
            size="compact"
            @_click="clearFilters"
          >Clear Filters</goa-button>
        </div>
      </div>
    </div>

    <!-- Results summary -->
    <div class="results-summary" v-if="!loading">
      <span>{{ total }} document{{ total !== 1 ? 's' : '' }} found</span>
      <span v-if="searchTime > 0" class="search-time">({{ searchTime }}ms)</span>
    </div>

    <!-- Documents Table -->
    <div class="table-container">
      <table class="docs-table">
        <thead>
          <tr>
            <th>File Name</th>
            <th>Category</th>
            <th>Appeal</th>
            <th>Settlement</th>
            <th>Size</th>
            <th>Uploaded</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="loading">
            <td colspan="7" class="center-text">Searching documents...</td>
          </tr>
          <tr v-else-if="documents.length === 0">
            <td colspan="7" class="center-text">No documents found</td>
          </tr>
          <tr v-for="doc in documents" :key="doc.id">
            <td class="doc-name">
              <span class="file-icon">{{ fileIcon(doc.file_type) }}</span>
              <span :title="doc.original_name">{{ truncateName(doc.original_name) }}</span>
            </td>
            <td>
              <span class="category-badge" :class="'cat-' + (doc.category || 'other').toLowerCase()">
                {{ doc.category || 'N/A' }}
              </span>
            </td>
            <td>
              <a
                v-if="doc.appeal_file_number"
                href="#"
                class="appeal-link"
                @click.prevent="goToAppeal(doc.appeal_id)"
              >{{ doc.appeal_file_number }}</a>
              <span v-else class="muted">—</span>
            </td>
            <td>{{ doc.settlement_name || '—' }}</td>
            <td class="file-size">{{ formatSize(doc.file_size) }}</td>
            <td class="date-cell">{{ formatDate(doc.created_at) }}</td>
            <td>
              <goa-button type="tertiary" size="compact" @_click="downloadDoc(doc)">Download</goa-button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Pagination -->
    <div v-if="total > limit" class="pagination">
      <goa-button type="tertiary" size="compact" :disabled="offset === 0" @_click="prevPage">Previous</goa-button>
      <span class="page-info">Showing {{ offset + 1 }}–{{ Math.min(offset + limit, total) }} of {{ total }}</span>
      <goa-button type="tertiary" size="compact" :disabled="offset + limit >= total" @_click="nextPage">Next</goa-button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import api from '@/services/api.js';

const router = useRouter();

const documents = ref([]);
const loading = ref(true);
const total = ref(0);
const limit = ref(20);
const offset = ref(0);
const searchTime = ref(0);

const searchQuery = ref('');
const activeSearch = ref('');
const categoryFilter = ref('');
const appealFilter = ref('');
const settlementFilter = ref('');
const dateFrom = ref('');
const dateTo = ref('');
const categories = ref([]);
const appeals = ref([]);
const settlements = ref([]);

const hasActiveFilters = computed(() => {
  return searchQuery.value || categoryFilter.value || appealFilter.value || settlementFilter.value || dateFrom.value || dateTo.value;
});

async function loadCategories() {
  try {
    const response = await api.get('/documents/categories');
    if (response.success) {
      categories.value = response.data;
    }
  } catch {
    // silent — categories dropdown just won't populate
  }
}

async function loadAppeals() {
  try {
    const response = await api.get('/documents/appeals');
    if (response.success) {
      appeals.value = response.data;
    }
  } catch {
    // silent
  }
}

async function loadSettlements() {
  try {
    const response = await api.get('/documents/settlements');
    if (response.success) {
      settlements.value = response.data;
    }
  } catch {
    // silent
  }
}

async function loadDocuments() {
  loading.value = true;
  const start = Date.now();
  try {
    const params = new URLSearchParams();
    params.set('limit', limit.value);
    params.set('offset', offset.value);
    if (activeSearch.value) params.set('search', activeSearch.value);
    if (categoryFilter.value) params.set('category', categoryFilter.value);
    if (appealFilter.value) params.set('appeal_id', appealFilter.value);
    if (settlementFilter.value) params.set('settlement', settlementFilter.value);
    if (dateFrom.value) params.set('date_from', dateFrom.value);
    if (dateTo.value) params.set('date_to', dateTo.value);

    const response = await api.get(`/documents?${params.toString()}`);
    if (response.success) {
      documents.value = response.data;
      total.value = response.total;
    }
  } catch {
    documents.value = [];
    total.value = 0;
  } finally {
    searchTime.value = Date.now() - start;
    loading.value = false;
  }
}

function applySearch() {
  activeSearch.value = searchQuery.value.trim();
  offset.value = 0;
  loadDocuments();
}

function clearFilters() {
  searchQuery.value = '';
  activeSearch.value = '';
  categoryFilter.value = '';
  appealFilter.value = '';
  settlementFilter.value = '';
  dateFrom.value = '';
  dateTo.value = '';
  offset.value = 0;
  loadDocuments();
}

function prevPage() {
  offset.value = Math.max(0, offset.value - limit.value);
  loadDocuments();
}

function nextPage() {
  offset.value = offset.value + limit.value;
  loadDocuments();
}

function goToAppeal(appealId) {
  router.push(`/appeals/${appealId}`);
}

async function downloadDoc(doc) {
  try {
    if (!doc.appeal_id) return;
    const token = localStorage.getItem('msat_token');
    const response = await fetch(`/api/appeals/${doc.appeal_id}/documents/${doc.id}/download`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!response.ok) throw new Error('Download failed');
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = doc.original_name || doc.file_name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } catch {
    alert('Failed to download document');
  }
}

function formatSize(bytes) {
  if (!bytes) return '—';
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / 1048576).toFixed(1) + ' MB';
}

function formatDate(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-CA');
}

function truncateName(name) {
  if (!name) return '—';
  return name.length > 60 ? name.substring(0, 57) + '...' : name;
}

function fileIcon(type) {
  const icons = { pdf: 'PDF', doc: 'DOC', docx: 'DOC', xls: 'XLS', xlsx: 'XLS', jpg: 'IMG', jpeg: 'IMG', png: 'IMG', tif: 'IMG', tiff: 'IMG' };
  return icons[type?.toLowerCase()] || 'FILE';
}

onMounted(() => {
  loadCategories();
  loadAppeals();
  loadSettlements();
  loadDocuments();
});
</script>

<style scoped>
.documents-page {
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

/* Search Section */
.search-section {
  background: white;
  border: 1px solid var(--goa-color-greyscale-200, #dcdcdc);
  border-radius: var(--goa-border-radius-m, 4px);
  padding: var(--goa-space-m) var(--goa-space-l);
  margin-bottom: var(--goa-space-m);
}

.search-bar {
  display: flex;
  gap: var(--goa-space-s);
  align-items: center;
  margin-bottom: var(--goa-space-m);
}

.search-input-large {
  flex: 1;
  padding: 10px 14px;
  border: 1px solid var(--goa-color-greyscale-200, #ccc);
  border-radius: var(--goa-border-radius-m, 4px);
  font-size: var(--goa-font-size-5, 1rem);
  box-sizing: border-box;
}

.search-input-large:focus {
  border-color: var(--goa-color-interactive-default, #0070c4);
  outline: none;
  box-shadow: 0 0 0 2px rgba(0, 112, 196, 0.2);
}

.filters-row {
  display: flex;
  gap: var(--goa-space-m);
  align-items: flex-end;
  flex-wrap: wrap;
}

.filter-group {
  display: flex;
  flex-direction: column;
  gap: var(--goa-space-2xs);
}

.filter-group label {
  font-size: var(--goa-font-size-3, 0.8rem);
  font-weight: var(--goa-font-weight-bold, 700);
  color: var(--goa-color-text-secondary, #666);
  text-transform: uppercase;
}

.filter-input {
  padding: 6px 10px;
  border: 1px solid var(--goa-color-greyscale-200, #ccc);
  border-radius: var(--goa-border-radius-m, 4px);
  font-size: var(--goa-font-size-4, 0.875rem);
  min-width: 150px;
}

.filter-input:focus {
  border-color: var(--goa-color-interactive-default, #0070c4);
  outline: none;
  box-shadow: 0 0 0 2px rgba(0, 112, 196, 0.2);
}

.filter-actions {
  display: flex;
  align-items: flex-end;
}

/* Results summary */
.results-summary {
  display: flex;
  gap: var(--goa-space-s);
  align-items: center;
  margin-bottom: var(--goa-space-s);
  font-size: var(--goa-font-size-4, 0.875rem);
  color: var(--goa-color-text-secondary, #666);
}

.search-time {
  font-size: var(--goa-font-size-3, 0.8rem);
  color: var(--goa-color-text-secondary, #999);
}

/* Table */
.table-container {
  background: white;
  border: 1px solid var(--goa-color-greyscale-200, #dcdcdc);
  border-radius: var(--goa-border-radius-m, 4px);
  overflow-x: auto;
}

.docs-table {
  width: 100%;
  border-collapse: collapse;
}

.docs-table th,
.docs-table td {
  padding: var(--goa-space-s) var(--goa-space-m);
  text-align: left;
  border-bottom: 1px solid var(--goa-color-greyscale-200, #dcdcdc);
  font-size: var(--goa-font-size-4, 0.875rem);
}

.docs-table th {
  background: var(--goa-color-greyscale-100, #f1f1f1);
  font-weight: var(--goa-font-weight-bold, 700);
  white-space: nowrap;
}

.docs-table tbody tr:hover {
  background: var(--goa-color-greyscale-100, #f9f9f9);
}

.doc-name {
  display: flex;
  align-items: center;
  gap: var(--goa-space-xs);
  max-width: 350px;
}

.file-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: var(--goa-color-greyscale-200, #e5e5e5);
  color: var(--goa-color-text-secondary, #666);
  font-size: 0.65rem;
  font-weight: 700;
  padding: 2px 4px;
  border-radius: 3px;
  min-width: 28px;
  text-align: center;
}

.category-badge {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 10px;
  font-size: var(--goa-font-size-3, 0.8rem);
  font-weight: 600;
  white-space: nowrap;
}

.cat-filing { background: #dbeafe; color: #1e40af; }
.cat-submission { background: #fef3c7; color: #92400e; }
.cat-evidence { background: #fce7f3; color: #9d174d; }
.cat-decision { background: #d1fae5; color: #065f46; }
.cat-order { background: #ede9fe; color: #5b21b6; }
.cat-correspondence { background: #e0e7ff; color: #3730a3; }
.cat-historical { background: #f3f4f6; color: #374151; }
.cat-other { background: #f3f4f6; color: #6b7280; }

.appeal-link {
  color: var(--goa-color-interactive-default, #0070c4);
  text-decoration: none;
  font-family: monospace;
  font-size: var(--goa-font-size-4, 0.875rem);
}

.appeal-link:hover {
  text-decoration: underline;
}

.muted {
  color: var(--goa-color-text-secondary, #999);
}

.file-size {
  white-space: nowrap;
  font-family: monospace;
  font-size: var(--goa-font-size-3, 0.8rem);
}

.date-cell {
  white-space: nowrap;
}

.center-text {
  text-align: center;
  padding: var(--goa-space-xl) !important;
  color: var(--goa-color-text-secondary, #666);
}

/* Pagination */
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

@media (max-width: 768px) {
  .filters-row {
    flex-direction: column;
    align-items: stretch;
  }

  .filter-input {
    min-width: unset;
    width: 100%;
  }

  .doc-name {
    max-width: 200px;
  }
}
</style>
