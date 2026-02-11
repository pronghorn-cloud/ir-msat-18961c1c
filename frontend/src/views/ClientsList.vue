<template>
  <div class="clients-page">
    <div class="page-header">
      <div class="header-row">
        <div>
          <h1>Clients</h1>
          <p>Manage client records</p>
        </div>
        <div class="header-actions">
          <goa-button type="secondary" size="compact" @_click="exportCSV" :disabled="clients.length === 0">
            Export CSV
          </goa-button>
          <goa-button type="primary" @_click="showCreateForm = !showCreateForm">
            {{ showCreateForm ? 'Cancel' : 'New Client' }}
          </goa-button>
        </div>
      </div>
    </div>

    <!-- Create / Edit Form -->
    <div v-if="showCreateForm || editingClient" class="client-form-panel">
      <h3>{{ editingClient ? 'Edit Client' : 'New Client' }}</h3>
      <div class="client-form-grid">
        <div class="form-field">
          <label>First Name <span class="required">*</span></label>
          <input type="text" class="form-input" v-model="clientForm.first_name" placeholder="First name" />
        </div>
        <div class="form-field">
          <label>Last Name <span class="required">*</span></label>
          <input type="text" class="form-input" v-model="clientForm.last_name" placeholder="Last name" />
        </div>
        <div class="form-field">
          <label>Member ID</label>
          <input type="text" class="form-input" v-model="clientForm.member_id" placeholder="e.g. 1-891133" />
        </div>
        <div class="form-field">
          <label>Email</label>
          <input type="email" class="form-input" v-model="clientForm.email" placeholder="email@example.com" />
        </div>
        <div class="form-field">
          <label>Phone (Home)</label>
          <input type="text" class="form-input" v-model="clientForm.phone_home" placeholder="Phone home" />
        </div>
        <div class="form-field">
          <label>Phone (Work)</label>
          <input type="text" class="form-input" v-model="clientForm.phone_work" placeholder="Phone work" />
        </div>
        <div class="form-field">
          <label>Phone (Cell)</label>
          <input type="text" class="form-input" v-model="clientForm.phone_cell" placeholder="Cell phone" />
        </div>
        <div class="form-field">
          <label>Settlement</label>
          <select class="form-input" v-model="clientForm.settlement">
            <option value="">— Select —</option>
            <option v-for="s in settlements" :key="s" :value="s">{{ s }}</option>
          </select>
        </div>
        <div class="form-field">
          <label>Address</label>
          <input type="text" class="form-input" v-model="clientForm.address_1" placeholder="Street address" />
        </div>
        <div class="form-field">
          <label>City</label>
          <input type="text" class="form-input" v-model="clientForm.city" placeholder="City" />
        </div>
        <div class="form-field">
          <label>Province</label>
          <input type="text" class="form-input" v-model="clientForm.province" placeholder="AB" />
        </div>
        <div class="form-field">
          <label>Postal Code</label>
          <input type="text" class="form-input" v-model="clientForm.postal_code" placeholder="T0A 0A0" />
        </div>
        <div class="form-field">
          <label>Date of Birth</label>
          <input type="date" class="form-input" v-model="clientForm.date_of_birth" />
        </div>
        <div class="form-field">
          <label>Organization</label>
          <input type="text" class="form-input" v-model="clientForm.org_name" placeholder="Organization name" />
        </div>
        <div class="form-field">
          <label>Job Title</label>
          <input type="text" class="form-input" v-model="clientForm.job_title" placeholder="Job title" />
        </div>
      </div>
      <div class="form-field form-notes">
        <label>Notes</label>
        <textarea class="form-input form-textarea" v-model="clientForm.notes" rows="2" placeholder="Internal notes..."></textarea>
      </div>
      <div class="form-actions">
        <goa-button type="primary" size="compact"
                    :disabled="!clientForm.first_name?.trim() || !clientForm.last_name?.trim()"
                    @_click="saveClient">
          {{ editingClient ? 'Save Changes' : 'Create Client' }}
        </goa-button>
        <goa-button type="tertiary" size="compact" @_click="cancelForm">Cancel</goa-button>
      </div>
    </div>

    <!-- Feedback -->
    <div v-if="feedbackMessage" :class="['feedback', feedbackError ? 'feedback-error' : 'feedback-success']">
      {{ feedbackMessage }}
    </div>

    <!-- Search -->
    <div class="search-bar">
      <input type="text" class="search-input-large" v-model="searchQuery" placeholder="Search by name, member ID, or email..."
             @keyup.enter="applySearch" />
      <goa-button type="secondary" size="compact" @_click="applySearch">Search</goa-button>
      <goa-button v-if="searchQuery" type="tertiary" size="compact" @_click="clearSearch">Clear</goa-button>
    </div>

    <!-- Results summary -->
    <div class="results-summary" v-if="!loading">
      <span>{{ total }} client{{ total !== 1 ? 's' : '' }} found</span>
    </div>

    <!-- Clients Table -->
    <div class="table-container">
      <table class="clients-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Member ID</th>
            <th>Email</th>
            <th>Phone</th>
            <th>Settlement</th>
            <th>City</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="loading">
            <td colspan="7" class="center-text">Loading clients...</td>
          </tr>
          <tr v-else-if="clients.length === 0">
            <td colspan="7" class="center-text">No clients found</td>
          </tr>
          <tr v-for="c in clients" :key="c.id" class="clickable-row" @click="viewClient(c.id)">
            <td class="client-name">{{ c.last_name }}, {{ c.first_name }}</td>
            <td class="member-id">{{ c.member_id || '—' }}</td>
            <td>{{ c.email || '—' }}</td>
            <td>{{ c.phone_cell || c.phone_home || '—' }}</td>
            <td>{{ c.settlement || '—' }}</td>
            <td>{{ c.city || '—' }}</td>
            <td>
              <goa-button type="tertiary" size="compact" @_click.stop="editClient(c.id)">Edit</goa-button>
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

    <!-- Client Detail Panel -->
    <div v-if="detailClient" class="detail-overlay" @click.self="detailClient = null">
      <div class="detail-panel">
        <div class="detail-header">
          <h3>{{ detailClient.first_name }} {{ detailClient.last_name }}</h3>
          <button class="close-btn" @click="detailClient = null">&times;</button>
        </div>
        <div class="detail-grid">
          <div class="detail-item"><span class="detail-label">Member ID</span><span>{{ detailClient.member_id || '—' }}</span></div>
          <div class="detail-item"><span class="detail-label">Email</span><span>{{ detailClient.email || '—' }}</span></div>
          <div class="detail-item"><span class="detail-label">Phone (Home)</span><span>{{ detailClient.phone_home || '—' }}</span></div>
          <div class="detail-item"><span class="detail-label">Phone (Work)</span><span>{{ detailClient.phone_work || '—' }}</span></div>
          <div class="detail-item"><span class="detail-label">Phone (Cell)</span><span>{{ detailClient.phone_cell || '—' }}</span></div>
          <div class="detail-item"><span class="detail-label">Settlement</span><span>{{ detailClient.settlement || '—' }}</span></div>
          <div class="detail-item"><span class="detail-label">Address</span><span>{{ detailClient.address_1 || '—' }}</span></div>
          <div class="detail-item"><span class="detail-label">City</span><span>{{ detailClient.city || '—' }}</span></div>
          <div class="detail-item"><span class="detail-label">Province</span><span>{{ detailClient.province || '—' }}</span></div>
          <div class="detail-item"><span class="detail-label">Postal Code</span><span>{{ detailClient.postal_code || '—' }}</span></div>
          <div class="detail-item"><span class="detail-label">Date of Birth</span><span>{{ detailClient.date_of_birth ? new Date(detailClient.date_of_birth).toLocaleDateString() : '—' }}</span></div>
          <div class="detail-item"><span class="detail-label">Organization</span><span>{{ detailClient.org_name || '—' }}</span></div>
          <div class="detail-item"><span class="detail-label">Job Title</span><span>{{ detailClient.job_title || '—' }}</span></div>
          <div class="detail-item"><span class="detail-label">Department</span><span>{{ detailClient.department || '—' }}</span></div>
        </div>
        <div v-if="detailClient.notes" class="detail-notes">
          <span class="detail-label">Notes</span>
          <p>{{ detailClient.notes }}</p>
        </div>
        <div class="detail-actions">
          <goa-button type="secondary" size="compact" @_click="editClient(detailClient.id)">Edit</goa-button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import api from '@/services/api.js';

const clients = ref([]);
const loading = ref(true);
const total = ref(0);
const limit = ref(25);
const offset = ref(0);
const searchQuery = ref('');
const activeSearch = ref('');

const showCreateForm = ref(false);
const editingClient = ref(null);
const detailClient = ref(null);
const feedbackMessage = ref('');
const feedbackError = ref(false);

const settlements = [
  'Buffalo Lake', 'East Prairie', 'Elizabeth', 'Fishing Lake',
  'Gift Lake', 'Kikino', 'Paddle Prairie', 'Peavine'
];

const emptyForm = () => ({
  first_name: '', last_name: '', member_id: '', email: '',
  phone_home: '', phone_work: '', phone_cell: '',
  address_1: '', city: '', province: 'AB', postal_code: '',
  date_of_birth: '', settlement: '', org_name: '', job_title: '', notes: ''
});

const clientForm = ref(emptyForm());

function showFeedback(message, isError = false) {
  feedbackMessage.value = message;
  feedbackError.value = isError;
  setTimeout(() => { feedbackMessage.value = ''; }, 3000);
}

async function loadClients() {
  loading.value = true;
  try {
    const params = new URLSearchParams();
    params.set('limit', limit.value);
    params.set('offset', offset.value);
    if (activeSearch.value) params.set('search', activeSearch.value);

    const response = await api.get(`/clients?${params.toString()}`);
    if (response.success) {
      clients.value = response.data;
      total.value = response.total;
    }
  } catch {
    clients.value = [];
  } finally {
    loading.value = false;
  }
}

function applySearch() {
  activeSearch.value = searchQuery.value.trim();
  offset.value = 0;
  loadClients();
}

function clearSearch() {
  searchQuery.value = '';
  activeSearch.value = '';
  offset.value = 0;
  loadClients();
}

function prevPage() {
  offset.value = Math.max(0, offset.value - limit.value);
  loadClients();
}

function nextPage() {
  offset.value = offset.value + limit.value;
  loadClients();
}

async function viewClient(id) {
  try {
    const response = await api.get(`/clients/${id}`);
    if (response.success) {
      detailClient.value = response.client;
    }
  } catch (err) {
    showFeedback(err.response?.data?.message || 'Failed to load client', true);
  }
}

async function editClient(id) {
  try {
    const response = await api.get(`/clients/${id}`);
    if (response.success) {
      const c = response.client;
      editingClient.value = c.id;
      detailClient.value = null;
      showCreateForm.value = false;
      clientForm.value = {
        first_name: c.first_name || '', last_name: c.last_name || '',
        member_id: c.member_id || '', email: c.email || '',
        phone_home: c.phone_home || '', phone_work: c.phone_work || '',
        phone_cell: c.phone_cell || '',
        address_1: c.address_1 || '', city: c.city || '',
        province: c.province || 'AB', postal_code: c.postal_code || '',
        date_of_birth: c.date_of_birth ? c.date_of_birth.split('T')[0] : '',
        settlement: c.settlement || '', org_name: c.org_name || '',
        job_title: c.job_title || '', notes: c.notes || ''
      };
    }
  } catch (err) {
    showFeedback(err.response?.data?.message || 'Failed to load client', true);
  }
}

async function saveClient() {
  if (!clientForm.value.first_name?.trim() || !clientForm.value.last_name?.trim()) return;

  const payload = {};
  for (const [key, val] of Object.entries(clientForm.value)) {
    if (val !== '' && val !== null) payload[key] = val;
  }

  try {
    if (editingClient.value) {
      const response = await api.patch(`/clients/${editingClient.value}`, payload);
      if (response.success) {
        showFeedback(response.message);
        cancelForm();
        loadClients();
      }
    } else {
      const response = await api.post('/clients', payload);
      if (response.success) {
        showFeedback(response.message);
        cancelForm();
        loadClients();
      }
    }
  } catch (err) {
    showFeedback(err.response?.data?.message || 'Failed to save client', true);
  }
}

function cancelForm() {
  showCreateForm.value = false;
  editingClient.value = null;
  clientForm.value = emptyForm();
}

function exportCSV() {
  if (clients.value.length === 0) return;
  const lines = ['Last Name,First Name,Member ID,Email,Phone (Cell),Phone (Home),Settlement,City'];
  clients.value.forEach(c => {
    lines.push([
      `"${(c.last_name || '').replace(/"/g, '""')}"`,
      `"${(c.first_name || '').replace(/"/g, '""')}"`,
      `"${(c.member_id || '').replace(/"/g, '""')}"`,
      `"${(c.email || '').replace(/"/g, '""')}"`,
      `"${(c.phone_cell || '').replace(/"/g, '""')}"`,
      `"${(c.phone_home || '').replace(/"/g, '""')}"`,
      `"${(c.settlement || '').replace(/"/g, '""')}"`,
      `"${(c.city || '').replace(/"/g, '""')}"`
    ].join(','));
  });
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Clients_Export_${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

onMounted(() => {
  loadClients();
});
</script>

<style scoped>
.clients-page {
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
.client-form-panel {
  background: white;
  border: 1px solid var(--goa-color-greyscale-200, #dcdcdc);
  border-radius: var(--goa-border-radius-m, 4px);
  padding: var(--goa-space-m) var(--goa-space-l);
  margin-bottom: var(--goa-space-m);
}

.client-form-panel h3 {
  font-size: var(--goa-font-size-5, 1rem);
  margin-bottom: var(--goa-space-s);
}

.client-form-grid {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
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

.form-notes {
  margin-top: var(--goa-space-s);
}

.form-textarea {
  resize: vertical;
  min-height: 40px;
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

.clients-table {
  width: 100%;
  border-collapse: collapse;
}

.clients-table th,
.clients-table td {
  padding: var(--goa-space-s) var(--goa-space-m);
  text-align: left;
  border-bottom: 1px solid var(--goa-color-greyscale-200, #dcdcdc);
}

.clients-table th {
  background: var(--goa-color-greyscale-100, #f1f1f1);
  font-weight: var(--goa-font-weight-bold, 700);
  font-size: var(--goa-font-size-4, 0.875rem);
}

.clients-table tbody tr:hover {
  background: var(--goa-color-greyscale-100, #f9f9f9);
}

.clickable-row {
  cursor: pointer;
}

.client-name {
  font-weight: var(--goa-font-weight-bold, 700);
}

.member-id {
  font-family: monospace;
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
  max-width: 700px;
  max-height: 85vh;
  overflow-y: auto;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
}

.detail-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--goa-space-m);
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

.detail-notes {
  margin-top: var(--goa-space-m);
  padding-top: var(--goa-space-s);
  border-top: 1px solid var(--goa-color-greyscale-200, #eee);
}

.detail-notes p {
  margin-top: var(--goa-space-2xs);
  white-space: pre-wrap;
}

.detail-actions {
  margin-top: var(--goa-space-m);
  display: flex;
  gap: var(--goa-space-s);
}

@media (max-width: 1024px) {
  .client-form-grid {
    grid-template-columns: repeat(3, 1fr);
  }
}

@media (max-width: 768px) {
  .client-form-grid {
    grid-template-columns: repeat(2, 1fr);
  }

  .detail-grid {
    grid-template-columns: 1fr;
  }
}
</style>
