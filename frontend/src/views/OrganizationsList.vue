<template>
  <div class="orgs-page">
    <div class="page-header">
      <div class="header-row">
        <div>
          <h1>Organizations</h1>
          <p>Manage organization records</p>
        </div>
        <div class="header-actions">
          <goa-button type="secondary" size="compact" @_click="exportCSV" :disabled="organizations.length === 0">
            Export CSV
          </goa-button>
          <goa-button type="primary" @_click="showCreateForm = !showCreateForm">
            {{ showCreateForm ? 'Cancel' : 'New Organization' }}
          </goa-button>
        </div>
      </div>
    </div>

    <!-- Create / Edit Form -->
    <div v-if="showCreateForm || editingOrg" class="org-form-panel">
      <h3>{{ editingOrg ? 'Edit Organization' : 'New Organization' }}</h3>
      <div class="org-form-grid">
        <div class="form-field" style="grid-column: span 2;">
          <label>Name <span class="required">*</span></label>
          <input type="text" class="form-input" v-model="orgForm.name" placeholder="Organization name" />
        </div>
        <div class="form-field">
          <label>Type</label>
          <select class="form-input" v-model="orgForm.type">
            <option v-for="t in orgTypes" :key="t" :value="t">{{ t }}</option>
          </select>
        </div>
        <div class="form-field">
          <label>Phone</label>
          <input type="text" class="form-input" v-model="orgForm.phone" placeholder="Phone number" />
        </div>
        <div class="form-field">
          <label>Toll Free</label>
          <input type="text" class="form-input" v-model="orgForm.toll_free" placeholder="Toll-free number" />
        </div>
        <div class="form-field">
          <label>Fax</label>
          <input type="text" class="form-input" v-model="orgForm.fax" placeholder="Fax number" />
        </div>
        <div class="form-field" style="grid-column: span 2;">
          <label>Email</label>
          <input type="email" class="form-input" v-model="orgForm.email" placeholder="email@example.com" />
        </div>
        <div class="form-field" style="grid-column: span 2;">
          <label>Address Line 1</label>
          <input type="text" class="form-input" v-model="orgForm.address_1" placeholder="Street address" />
        </div>
        <div class="form-field" style="grid-column: span 2;">
          <label>Address Line 2</label>
          <input type="text" class="form-input" v-model="orgForm.address_2" placeholder="Suite, unit, etc." />
        </div>
        <div class="form-field">
          <label>City</label>
          <input type="text" class="form-input" v-model="orgForm.city" placeholder="City" />
        </div>
        <div class="form-field">
          <label>Province</label>
          <input type="text" class="form-input" v-model="orgForm.province" placeholder="AB" />
        </div>
        <div class="form-field">
          <label>Postal Code</label>
          <input type="text" class="form-input" v-model="orgForm.postal_code" placeholder="T0A 0A0" />
        </div>
      </div>
      <div class="form-actions">
        <goa-button type="primary" size="compact"
                    :disabled="!orgForm.name?.trim()"
                    @_click="saveOrg">
          {{ editingOrg ? 'Save Changes' : 'Create Organization' }}
        </goa-button>
        <goa-button type="tertiary" size="compact" @_click="cancelForm">Cancel</goa-button>
      </div>
    </div>

    <!-- Feedback -->
    <div v-if="feedbackMessage" :class="['feedback', feedbackError ? 'feedback-error' : 'feedback-success']">
      {{ feedbackMessage }}
    </div>

    <!-- Search & Filter -->
    <div class="search-bar">
      <input type="text" class="search-input-large" v-model="searchQuery" placeholder="Search by organization name..."
             @keyup.enter="applySearch" />
      <select class="type-filter" v-model="typeFilter" @change="applySearch">
        <option value="">All Types</option>
        <option v-for="t in orgTypes" :key="t" :value="t">{{ t }}</option>
      </select>
      <goa-button type="secondary" size="compact" @_click="applySearch">Search</goa-button>
      <goa-button v-if="searchQuery || typeFilter" type="tertiary" size="compact" @_click="clearSearch">Clear</goa-button>
    </div>

    <!-- Results summary -->
    <div class="results-summary" v-if="!loading">
      <span>{{ total }} organization{{ total !== 1 ? 's' : '' }} found</span>
    </div>

    <!-- Organizations Table -->
    <div class="table-container">
      <table class="orgs-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Type</th>
            <th>City</th>
            <th>Province</th>
            <th>Phone</th>
            <th>Email</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="loading">
            <td colspan="7" class="center-text">Loading organizations...</td>
          </tr>
          <tr v-else-if="organizations.length === 0">
            <td colspan="7" class="center-text">No organizations found</td>
          </tr>
          <tr v-for="o in organizations" :key="o.id" class="clickable-row" @click="viewOrg(o.id)">
            <td class="org-name">{{ o.name }}</td>
            <td><span :class="['type-badge', 'type-' + slugify(o.type)]">{{ o.type }}</span></td>
            <td>{{ o.city || '—' }}</td>
            <td>{{ o.province || '—' }}</td>
            <td>{{ o.phone || '—' }}</td>
            <td>{{ o.email || '—' }}</td>
            <td>
              <goa-button type="tertiary" size="compact" @_click.stop="editOrg(o.id)">Edit</goa-button>
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

    <!-- Organization Detail Panel -->
    <div v-if="detailOrg" class="detail-overlay" @click.self="detailOrg = null">
      <div class="detail-panel">
        <div class="detail-header">
          <h3>{{ detailOrg.name }}</h3>
          <button class="close-btn" @click="detailOrg = null">&times;</button>
        </div>
        <div class="detail-type-row">
          <span :class="['type-badge', 'type-' + slugify(detailOrg.type)]">{{ detailOrg.type }}</span>
        </div>
        <div class="detail-grid">
          <div class="detail-item"><span class="detail-label">Phone</span><span>{{ detailOrg.phone || '—' }}</span></div>
          <div class="detail-item"><span class="detail-label">Toll Free</span><span>{{ detailOrg.toll_free || '—' }}</span></div>
          <div class="detail-item"><span class="detail-label">Fax</span><span>{{ detailOrg.fax || '—' }}</span></div>
          <div class="detail-item"><span class="detail-label">Email</span><span>{{ detailOrg.email || '—' }}</span></div>
          <div class="detail-item"><span class="detail-label">Address</span><span>{{ formatAddress(detailOrg) }}</span></div>
          <div class="detail-item"><span class="detail-label">City</span><span>{{ detailOrg.city || '—' }}</span></div>
          <div class="detail-item"><span class="detail-label">Province</span><span>{{ detailOrg.province || '—' }}</span></div>
          <div class="detail-item"><span class="detail-label">Postal Code</span><span>{{ detailOrg.postal_code || '—' }}</span></div>
        </div>
        <div class="detail-actions">
          <goa-button type="secondary" size="compact" @_click="editOrg(detailOrg.id)">Edit</goa-button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import api from '@/services/api.js';

const organizations = ref([]);
const loading = ref(true);
const total = ref(0);
const limit = ref(25);
const offset = ref(0);
const searchQuery = ref('');
const activeSearch = ref('');
const typeFilter = ref('');
const activeType = ref('');

const showCreateForm = ref(false);
const editingOrg = ref(null);
const detailOrg = ref(null);
const feedbackMessage = ref('');
const feedbackError = ref(false);

const orgTypes = ['Settlement', 'Council', 'Government Body', 'Other'];

const emptyForm = () => ({
  name: '', type: 'Other', address_1: '', address_2: '',
  city: '', province: 'AB', postal_code: '',
  phone: '', fax: '', toll_free: '', email: ''
});

const orgForm = ref(emptyForm());

function slugify(str) {
  return (str || 'other').toLowerCase().replace(/\s+/g, '-');
}

function formatAddress(org) {
  const parts = [org.address_1, org.address_2].filter(Boolean);
  return parts.length > 0 ? parts.join(', ') : '—';
}

function showFeedback(message, isError = false) {
  feedbackMessage.value = message;
  feedbackError.value = isError;
  setTimeout(() => { feedbackMessage.value = ''; }, 3000);
}

async function loadOrganizations() {
  loading.value = true;
  try {
    const params = new URLSearchParams();
    params.set('limit', limit.value);
    params.set('offset', offset.value);
    if (activeSearch.value) params.set('search', activeSearch.value);
    if (activeType.value) params.set('type', activeType.value);

    const response = await api.get(`/organizations?${params.toString()}`);
    if (response.success) {
      organizations.value = response.data;
      total.value = response.total;
    }
  } catch {
    organizations.value = [];
  } finally {
    loading.value = false;
  }
}

function applySearch() {
  activeSearch.value = searchQuery.value.trim();
  activeType.value = typeFilter.value;
  offset.value = 0;
  loadOrganizations();
}

function clearSearch() {
  searchQuery.value = '';
  typeFilter.value = '';
  activeSearch.value = '';
  activeType.value = '';
  offset.value = 0;
  loadOrganizations();
}

function prevPage() {
  offset.value = Math.max(0, offset.value - limit.value);
  loadOrganizations();
}

function nextPage() {
  offset.value = offset.value + limit.value;
  loadOrganizations();
}

async function viewOrg(id) {
  try {
    const response = await api.get(`/organizations/${id}`);
    if (response.success) {
      detailOrg.value = response.organization;
    }
  } catch (err) {
    showFeedback(err.response?.data?.message || 'Failed to load organization', true);
  }
}

async function editOrg(id) {
  try {
    const response = await api.get(`/organizations/${id}`);
    if (response.success) {
      const o = response.organization;
      editingOrg.value = o.id;
      detailOrg.value = null;
      showCreateForm.value = false;
      orgForm.value = {
        name: o.name || '', type: o.type || 'Other',
        address_1: o.address_1 || '', address_2: o.address_2 || '',
        city: o.city || '', province: o.province || 'AB',
        postal_code: o.postal_code || '',
        phone: o.phone || '', fax: o.fax || '',
        toll_free: o.toll_free || '', email: o.email || ''
      };
    }
  } catch (err) {
    showFeedback(err.response?.data?.message || 'Failed to load organization', true);
  }
}

async function saveOrg() {
  if (!orgForm.value.name?.trim()) return;

  const payload = {};
  for (const [key, val] of Object.entries(orgForm.value)) {
    if (val !== '' && val !== null) payload[key] = val;
  }

  try {
    if (editingOrg.value) {
      const response = await api.patch(`/organizations/${editingOrg.value}`, payload);
      if (response.success) {
        showFeedback(response.message);
        cancelForm();
        loadOrganizations();
      }
    } else {
      const response = await api.post('/organizations', payload);
      if (response.success) {
        showFeedback(response.message);
        cancelForm();
        loadOrganizations();
      }
    }
  } catch (err) {
    showFeedback(err.response?.data?.message || 'Failed to save organization', true);
  }
}

function cancelForm() {
  showCreateForm.value = false;
  editingOrg.value = null;
  orgForm.value = emptyForm();
}

function exportCSV() {
  if (organizations.value.length === 0) return;
  const lines = ['Name,Type,City,Province,Phone,Email'];
  organizations.value.forEach(o => {
    lines.push([
      `"${(o.name || '').replace(/"/g, '""')}"`,
      `"${(o.type || '').replace(/"/g, '""')}"`,
      `"${(o.city || '').replace(/"/g, '""')}"`,
      `"${(o.province || '').replace(/"/g, '""')}"`,
      `"${(o.phone || '').replace(/"/g, '""')}"`,
      `"${(o.email || '').replace(/"/g, '""')}"`
    ].join(','));
  });
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Organizations_Export_${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

onMounted(() => {
  loadOrganizations();
});
</script>

<style scoped>
.orgs-page {
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

/* Form Panel */
.org-form-panel {
  background: white;
  border: 1px solid var(--goa-color-greyscale-200, #dcdcdc);
  border-radius: var(--goa-border-radius-m, 4px);
  padding: var(--goa-space-m) var(--goa-space-l);
  margin-bottom: var(--goa-space-m);
}

.org-form-panel h3 {
  font-size: var(--goa-font-size-5, 1rem);
  margin-bottom: var(--goa-space-s);
}

.org-form-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: var(--goa-space-m);
}

.form-field label {
  display: block;
  font-size: var(--goa-font-size-3, 0.8rem);
  font-weight: var(--goa-font-weight-bold, 700);
  color: var(--goa-color-text-secondary, #666);
  margin-bottom: var(--goa-space-2xs);
  text-transform: uppercase;
}

.form-field .required {
  color: #b91c1c;
}

.form-input {
  width: 100%;
  padding: 6px 10px;
  border: 1px solid var(--goa-color-greyscale-200, #ccc);
  border-radius: var(--goa-border-radius-m, 4px);
  font-size: var(--goa-font-size-4, 0.875rem);
  box-sizing: border-box;
}

.form-input:focus {
  border-color: var(--goa-color-interactive-default, #0070c4);
  outline: none;
  box-shadow: 0 0 0 2px rgba(0, 112, 196, 0.2);
}

.form-actions {
  display: flex;
  gap: var(--goa-space-s);
  margin-top: var(--goa-space-m);
}

/* Feedback */
.feedback {
  padding: var(--goa-space-s) var(--goa-space-m);
  border-radius: var(--goa-border-radius-m, 4px);
  margin-bottom: var(--goa-space-m);
  font-size: var(--goa-font-size-4, 0.875rem);
}

.feedback-success {
  background: #d1fae5;
  color: #065f46;
  border: 1px solid #6ee7b7;
}

.feedback-error {
  background: #fee2e2;
  color: #991b1b;
  border: 1px solid #fca5a5;
}

/* Search Bar */
.search-bar {
  display: flex;
  gap: var(--goa-space-s);
  align-items: center;
  margin-bottom: var(--goa-space-m);
}

.search-input-large {
  flex: 1;
  padding: 8px 12px;
  border: 1px solid var(--goa-color-greyscale-200, #ccc);
  border-radius: var(--goa-border-radius-m, 4px);
  font-size: var(--goa-font-size-4, 0.875rem);
  box-sizing: border-box;
}

.search-input-large:focus {
  border-color: var(--goa-color-interactive-default, #0070c4);
  outline: none;
  box-shadow: 0 0 0 2px rgba(0, 112, 196, 0.2);
}

.type-filter {
  padding: 8px 12px;
  border: 1px solid var(--goa-color-greyscale-200, #ccc);
  border-radius: var(--goa-border-radius-m, 4px);
  font-size: var(--goa-font-size-4, 0.875rem);
  background: white;
  min-width: 160px;
}

/* Results summary */
.results-summary {
  margin-bottom: var(--goa-space-s);
  font-size: var(--goa-font-size-4, 0.875rem);
  color: var(--goa-color-text-secondary, #666);
}

/* Table */
.table-container {
  background: white;
  border: 1px solid var(--goa-color-greyscale-200, #dcdcdc);
  border-radius: var(--goa-border-radius-m, 4px);
  overflow-x: auto;
}

.orgs-table {
  width: 100%;
  border-collapse: collapse;
}

.orgs-table th,
.orgs-table td {
  padding: var(--goa-space-s) var(--goa-space-m);
  text-align: left;
  border-bottom: 1px solid var(--goa-color-greyscale-200, #dcdcdc);
}

.orgs-table th {
  background: var(--goa-color-greyscale-100, #f1f1f1);
  font-weight: var(--goa-font-weight-bold, 700);
  font-size: var(--goa-font-size-4, 0.875rem);
}

.orgs-table tbody tr:hover {
  background: var(--goa-color-greyscale-100, #f9f9f9);
}

.clickable-row {
  cursor: pointer;
}

.org-name {
  font-weight: var(--goa-font-weight-bold, 700);
}

.center-text {
  text-align: center;
  padding: var(--goa-space-xl) !important;
  color: var(--goa-color-text-secondary, #666);
}

/* Type Badges */
.type-badge {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 12px;
  font-size: var(--goa-font-size-3, 0.8rem);
  font-weight: var(--goa-font-weight-bold, 700);
  white-space: nowrap;
}

.type-settlement {
  background: #dbeafe;
  color: #1e40af;
}

.type-council {
  background: #fef3c7;
  color: #92400e;
}

.type-government-body {
  background: #e0e7ff;
  color: #3730a3;
}

.type-other {
  background: var(--goa-color-greyscale-100, #f1f1f1);
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

/* Detail Panel Overlay */
.detail-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.4);
  z-index: 100;
  display: flex;
  justify-content: center;
  align-items: flex-start;
  padding-top: 5vh;
}

.detail-panel {
  background: white;
  border-radius: var(--goa-border-radius-m, 4px);
  padding: var(--goa-space-l);
  width: 90%;
  max-width: 600px;
  max-height: 85vh;
  overflow-y: auto;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
}

.detail-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--goa-space-xs);
}

.detail-header h3 {
  font-size: var(--goa-font-size-6, 1.25rem);
}

.close-btn {
  background: none;
  border: none;
  font-size: 1.5rem;
  cursor: pointer;
  color: var(--goa-color-text-secondary, #666);
  padding: 0;
  line-height: 1;
}

.detail-type-row {
  margin-bottom: var(--goa-space-m);
}

.detail-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--goa-space-s) var(--goa-space-l);
}

.detail-item {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.detail-label {
  font-size: var(--goa-font-size-3, 0.8rem);
  font-weight: var(--goa-font-weight-bold, 700);
  color: var(--goa-color-text-secondary, #666);
  text-transform: uppercase;
}

.detail-actions {
  margin-top: var(--goa-space-m);
  display: flex;
  gap: var(--goa-space-s);
}

@media (max-width: 1024px) {
  .org-form-grid {
    grid-template-columns: repeat(2, 1fr);
  }
  .org-form-grid [style*="grid-column: span 2"] {
    grid-column: span 2;
  }
}

@media (max-width: 768px) {
  .org-form-grid {
    grid-template-columns: 1fr;
  }
  .org-form-grid [style*="grid-column: span 2"] {
    grid-column: span 1;
  }
  .detail-grid {
    grid-template-columns: 1fr;
  }
  .search-bar {
    flex-wrap: wrap;
  }
  .type-filter {
    min-width: auto;
    flex: 1;
  }
}
</style>
