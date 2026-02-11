<template>
  <div class="lap-applications">
    <div class="page-header">
      <h1>Land Access Panel — Applications</h1>
      <p>Manage LAP applications for oil and gas access on Metis Settlement lands</p>
    </div>

    <goa-callout v-if="successMsg" type="success" heading="Success">
      {{ successMsg }}
    </goa-callout>
    <goa-callout v-if="errorMsg" type="emergency" heading="Error">
      {{ errorMsg }}
    </goa-callout>

    <!-- Filters & Actions -->
    <div class="actions-bar">
      <goa-button type="primary" @_click="openCreateForm">
        Create Application
      </goa-button>
      <router-link to="/lap/map" class="map-link">
        <goa-button type="secondary" size="compact">View Map</goa-button>
      </router-link>

      <div class="filters">
        <div class="filter-group">
          <label>Status:</label>
          <select v-model="filterStatus" @change="loadApplications">
            <option value="">All Statuses</option>
            <option v-for="s in statuses" :key="s.status" :value="s.status">
              {{ s.status }} ({{ s.count }})
            </option>
          </select>
        </div>
        <div class="filter-group">
          <label>Search:</label>
          <input type="text" v-model="searchTerm" placeholder="Applicant, app #, file #..." @keyup.enter="loadApplications" />
          <button class="search-btn" @click="loadApplications">Search</button>
        </div>
      </div>
    </div>

    <!-- Summary -->
    <div class="summary-bar">
      <span>Showing {{ data.length }} of {{ total }} applications</span>
      <span v-if="filterStatus || searchTerm" class="clear-link" @click="clearFilters">Clear filters</span>
    </div>

    <!-- Applications Table -->
    <div class="table-container">
      <table class="data-table">
        <thead>
          <tr>
            <th>App #</th>
            <th>File #</th>
            <th>Applicant</th>
            <th>Status</th>
            <th>Staff</th>
            <th>Contact Date</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="loading">
            <td colspan="7" class="center-text">Loading applications...</td>
          </tr>
          <tr v-else-if="data.length === 0">
            <td colspan="7" class="center-text">No applications found</td>
          </tr>
          <template v-for="app in data" :key="app.id">
            <tr :class="{ 'expanded-row': expandedId === app.id }" @click="toggleExpand(app)">
              <td class="mono">{{ app.application_number }}</td>
              <td class="mono">{{ app.file_number || '—' }}</td>
              <td>{{ app.applicant || '—' }}</td>
              <td>
                <span class="status-badge" :class="statusClass(app.status)">
                  {{ app.status }}
                </span>
              </td>
              <td>{{ app.staff || '—' }}</td>
              <td>{{ formatDate(app.contact_date) }}</td>
              <td class="actions-cell" @click.stop>
                <goa-button type="tertiary" size="compact" @_click="openEditForm(app)">
                  Edit
                </goa-button>
                <goa-button type="tertiary" size="compact" @_click="confirmDelete(app)">
                  Delete
                </goa-button>
              </td>
            </tr>
            <!-- Expanded Detail Row -->
            <tr v-if="expandedId === app.id && expandedDetail" class="detail-row">
              <td colspan="7">
                <div class="detail-panel">
                  <div class="detail-grid">
                    <div class="detail-section">
                      <h4>Application Details</h4>
                      <div class="detail-fields">
                        <div><strong>Application #:</strong> {{ expandedDetail.application_number }}</div>
                        <div><strong>File #:</strong> {{ expandedDetail.file_number || '—' }}</div>
                        <div><strong>Applicant:</strong> {{ expandedDetail.applicant || '—' }}</div>
                        <div><strong>Status:</strong> {{ expandedDetail.status }}</div>
                        <div><strong>Staff:</strong> {{ expandedDetail.staff || '—' }}</div>
                        <div><strong>Contact Date:</strong> {{ formatDate(expandedDetail.contact_date) }}</div>
                        <div><strong>Amendment:</strong> {{ expandedDetail.amendment ? 'Yes' : 'No' }}</div>
                      </div>
                      <div v-if="expandedDetail.staff_notes" class="notes-block">
                        <strong>Staff Notes:</strong>
                        <p>{{ expandedDetail.staff_notes }}</p>
                      </div>
                    </div>

                    <div class="detail-section">
                      <div class="section-header">
                        <h4>LAP Orders ({{ expandedDetail.orders.length }})</h4>
                        <goa-button type="tertiary" size="compact" @_click="openOrderForm(null)">
                          Add Order
                        </goa-button>
                      </div>
                      <div v-if="expandedDetail.orders.length === 0" class="empty-text">No orders linked</div>
                      <table v-else class="sub-table">
                        <thead>
                          <tr><th>Order #</th><th>Date Issued</th><th>Actions</th></tr>
                        </thead>
                        <tbody>
                          <tr v-for="o in expandedDetail.orders" :key="o.id">
                            <td>{{ o.order_number }}</td>
                            <td>{{ formatDate(o.date_issued) }}</td>
                            <td class="sub-actions">
                              <button class="inline-btn" @click="openOrderForm(o)">Edit</button>
                              <button class="inline-btn danger" @click="confirmDeleteOrder(o)">Delete</button>
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>

                    <div class="detail-section full-width">
                      <div class="section-header">
                        <h4>Access Records ({{ expandedDetail.access_records.length }})</h4>
                        <goa-button type="tertiary" size="compact" @_click="openAccessForm(null)">
                          Add Record
                        </goa-button>
                      </div>
                      <div v-if="expandedDetail.access_records.length === 0" class="empty-text">No access records linked</div>
                      <table v-else class="sub-table">
                        <thead>
                          <tr>
                            <th>Operator</th>
                            <th>Settlement</th>
                            <th>Project Type</th>
                            <th>REO</th>
                            <th>REO Date</th>
                            <th>CO</th>
                            <th>CO Date</th>
                            <th>Wellsite Legal</th>
                            <th>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr v-for="ar in expandedDetail.access_records" :key="ar.id">
                            <td>{{ ar.operator || '—' }}</td>
                            <td>{{ ar.settlement || '—' }}</td>
                            <td>{{ ar.project_type || '—' }}</td>
                            <td>{{ ar.reo || '—' }}</td>
                            <td>{{ formatDate(ar.reo_date) }}</td>
                            <td>{{ ar.co || '—' }}</td>
                            <td>{{ formatDate(ar.co_date) }}</td>
                            <td class="wrap-cell">{{ ar.wellsite_legal || '—' }}</td>
                            <td class="sub-actions">
                              <button class="inline-btn" @click="openAccessForm(ar)">Edit</button>
                              <button class="inline-btn danger" @click="confirmDeleteAccess(ar)">Delete</button>
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </td>
            </tr>
            <tr v-if="expandedId === app.id && expandLoading" class="detail-row">
              <td colspan="7" class="center-text">Loading details...</td>
            </tr>
          </template>
        </tbody>
      </table>
    </div>

    <!-- Pagination -->
    <div v-if="totalPages > 1" class="pagination">
      <button :disabled="currentPage <= 1" @click="goPage(currentPage - 1)">Previous</button>
      <template v-for="p in paginationRange" :key="p">
        <button v-if="p === '...'" disabled class="ellipsis">...</button>
        <button v-else :class="{ active: p === currentPage }" @click="goPage(p)">{{ p }}</button>
      </template>
      <button :disabled="currentPage >= totalPages" @click="goPage(currentPage + 1)">Next</button>
    </div>

    <!-- Create/Edit Modal -->
    <div v-if="showForm" class="modal-overlay" @click.self="closeForm">
      <div class="modal-content">
        <h2>{{ editingApp ? 'Edit Application' : 'Create Application' }}</h2>

        <goa-callout v-if="formError" type="emergency" heading="Error">
          {{ formError }}
        </goa-callout>

        <goa-form-item label="Application Number" :error="formErrors.application_number">
          <goa-input
            name="application_number"
            :value="formData.application_number"
            @_change="(e) => formData.application_number = e.detail.value"
            width="100%"
            :disabled="!!editingApp"
          />
        </goa-form-item>

        <goa-form-item label="File Number">
          <goa-input
            name="file_number"
            :value="formData.file_number"
            @_change="(e) => formData.file_number = e.detail.value"
            width="100%"
          />
        </goa-form-item>

        <goa-form-item label="Applicant">
          <goa-input
            name="applicant"
            :value="formData.applicant"
            @_change="(e) => formData.applicant = e.detail.value"
            width="100%"
            placeholder="Company or individual name"
          />
        </goa-form-item>

        <goa-form-item label="Status">
          <goa-dropdown
            name="status"
            :value="formData.status"
            @_change="(e) => formData.status = e.detail.value"
            width="100%"
          >
            <goa-dropdown-item value="Open" label="Open" />
            <goa-dropdown-item value="Active" label="Active" />
            <goa-dropdown-item value="Order Issued" label="Order Issued" />
            <goa-dropdown-item value="Closed" label="Closed" />
            <goa-dropdown-item value="Withdrawn" label="Withdrawn" />
          </goa-dropdown>
        </goa-form-item>

        <goa-form-item label="Staff">
          <goa-input
            name="staff"
            :value="formData.staff"
            @_change="(e) => formData.staff = e.detail.value"
            width="100%"
          />
        </goa-form-item>

        <goa-form-item label="Contact Date">
          <input
            type="date"
            class="date-input"
            :value="formData.contact_date"
            @input="(e) => formData.contact_date = e.target.value"
          />
        </goa-form-item>

        <goa-form-item label="Amendment">
          <goa-checkbox
            name="amendment"
            :checked="formData.amendment"
            @_change="(e) => formData.amendment = e.detail.checked"
          />
        </goa-form-item>

        <goa-form-item label="Staff Notes">
          <textarea
            class="notes-textarea"
            v-model="formData.staff_notes"
            rows="4"
            placeholder="Internal notes..."
          ></textarea>
        </goa-form-item>

        <div class="form-actions">
          <goa-button type="primary" @_click="handleSubmit" :disabled="saving">
            {{ saving ? 'Saving...' : (editingApp ? 'Save Changes' : 'Create') }}
          </goa-button>
          <goa-button type="tertiary" @_click="closeForm">
            Cancel
          </goa-button>
        </div>
      </div>
    </div>

    <!-- Delete Confirmation -->
    <div v-if="showDeleteConfirm" class="modal-overlay" @click.self="cancelDelete">
      <div class="modal-content modal-small">
        <h2>Delete Application</h2>
        <p>Are you sure you want to delete application <strong>{{ deletingApp?.application_number }}</strong>?</p>
        <p class="warning-text">This action cannot be undone.</p>
        <div class="form-actions">
          <goa-button type="primary" @_click="handleDelete">Delete</goa-button>
          <goa-button type="tertiary" @_click="cancelDelete">Cancel</goa-button>
        </div>
      </div>
    </div>

    <!-- Order Create/Edit Modal -->
    <div v-if="showOrderForm" class="modal-overlay" @click.self="closeOrderForm">
      <div class="modal-content modal-small">
        <h2>{{ editingOrder ? 'Edit Order' : 'Add Order' }}</h2>

        <goa-callout v-if="orderFormError" type="emergency" heading="Error">
          {{ orderFormError }}
        </goa-callout>

        <goa-form-item label="Order Number">
          <goa-input
            name="order_number"
            :value="orderFormData.order_number"
            @_change="(e) => orderFormData.order_number = e.detail.value"
            width="100%"
            placeholder="e.g. 0016/99"
          />
        </goa-form-item>

        <goa-form-item label="Date Issued">
          <input
            type="date"
            class="date-input"
            :value="orderFormData.date_issued"
            @input="(e) => orderFormData.date_issued = e.target.value"
          />
        </goa-form-item>

        <div class="form-actions">
          <goa-button type="primary" @_click="handleOrderSubmit" :disabled="savingOrder">
            {{ savingOrder ? 'Saving...' : (editingOrder ? 'Save Changes' : 'Add Order') }}
          </goa-button>
          <goa-button type="tertiary" @_click="closeOrderForm">
            Cancel
          </goa-button>
        </div>
      </div>
    </div>

    <!-- Order Delete Confirmation -->
    <div v-if="showDeleteOrderConfirm" class="modal-overlay" @click.self="cancelDeleteOrder">
      <div class="modal-content modal-small">
        <h2>Delete Order</h2>
        <p>Are you sure you want to delete order <strong>{{ deletingOrder?.order_number || 'this order' }}</strong>?</p>
        <p class="warning-text">This action cannot be undone.</p>
        <div class="form-actions">
          <goa-button type="primary" @_click="handleDeleteOrder">Delete</goa-button>
          <goa-button type="tertiary" @_click="cancelDeleteOrder">Cancel</goa-button>
        </div>
      </div>
    </div>

    <!-- Access Record Create/Edit Modal -->
    <div v-if="showAccessForm" class="modal-overlay" @click.self="closeAccessForm">
      <div class="modal-content">
        <h2>{{ editingAccess ? 'Edit Access Record' : 'Add Access Record' }}</h2>

        <goa-callout v-if="accessFormError" type="emergency" heading="Error">
          {{ accessFormError }}
        </goa-callout>

        <div class="form-grid">
          <goa-form-item label="Status">
            <goa-input name="ar_status" :value="accessFormData.status"
              @_change="(e) => accessFormData.status = e.detail.value" width="100%" placeholder="e.g. Active" />
          </goa-form-item>

          <goa-form-item label="Operator">
            <goa-input name="ar_operator" :value="accessFormData.operator"
              @_change="(e) => accessFormData.operator = e.detail.value" width="100%" placeholder="Company name" />
          </goa-form-item>

          <goa-form-item label="Settlement">
            <select class="form-select" v-model="accessFormData.settlement">
              <option value="">— Select Settlement —</option>
              <option v-for="s in settlements" :key="s.settlement" :value="s.settlement">
                {{ s.settlement }} ({{ s.count }})
              </option>
            </select>
          </goa-form-item>

          <goa-form-item label="Project Type">
            <select class="form-select" v-model="accessFormData.project_type">
              <option value="">— Select Project Type —</option>
              <option v-for="pt in projectTypes" :key="pt.project_type" :value="pt.project_type">
                {{ pt.project_type }} ({{ pt.count }})
              </option>
            </select>
          </goa-form-item>

          <goa-form-item label="REO">
            <goa-input name="ar_reo" :value="accessFormData.reo"
              @_change="(e) => accessFormData.reo = e.detail.value" width="100%" placeholder="e.g. E242/81" />
          </goa-form-item>

          <goa-form-item label="REO Date">
            <input type="date" class="date-input" :value="accessFormData.reo_date"
              @input="(e) => accessFormData.reo_date = e.target.value" />
          </goa-form-item>

          <goa-form-item label="CO">
            <goa-input name="ar_co" :value="accessFormData.co"
              @_change="(e) => accessFormData.co = e.detail.value" width="100%" placeholder="e.g. E1035/82" />
          </goa-form-item>

          <goa-form-item label="CO Date">
            <input type="date" class="date-input" :value="accessFormData.co_date"
              @input="(e) => accessFormData.co_date = e.target.value" />
          </goa-form-item>

          <goa-form-item label="Anniversary Date">
            <input type="date" class="date-input" :value="accessFormData.anniversary_date"
              @input="(e) => accessFormData.anniversary_date = e.target.value" />
          </goa-form-item>
        </div>

        <goa-form-item label="Purpose">
          <textarea class="notes-textarea" v-model="accessFormData.purpose" rows="2" placeholder="Purpose of REO..."></textarea>
        </goa-form-item>

        <goa-form-item label="Wellsite Legal Description">
          <goa-input name="ar_wellsite" :value="accessFormData.wellsite_legal"
            @_change="(e) => accessFormData.wellsite_legal = e.detail.value" width="100%" placeholder="e.g. NW 32-63-01W5" />
        </goa-form-item>

        <goa-form-item label="Lands Affected">
          <textarea class="notes-textarea" v-model="accessFormData.lands_affected" rows="2" placeholder="Description of affected lands..."></textarea>
        </goa-form-item>

        <div class="form-actions">
          <goa-button type="primary" @_click="handleAccessSubmit" :disabled="savingAccess">
            {{ savingAccess ? 'Saving...' : (editingAccess ? 'Save Changes' : 'Add Record') }}
          </goa-button>
          <goa-button type="tertiary" @_click="closeAccessForm">
            Cancel
          </goa-button>
        </div>
      </div>
    </div>

    <!-- Access Record Delete Confirmation -->
    <div v-if="showDeleteAccessConfirm" class="modal-overlay" @click.self="cancelDeleteAccess">
      <div class="modal-content modal-small">
        <h2>Delete Access Record</h2>
        <p>Are you sure you want to delete this access record for <strong>{{ deletingAccess?.operator || 'unknown operator' }}</strong>?</p>
        <p class="warning-text">This action cannot be undone.</p>
        <div class="form-actions">
          <goa-button type="primary" @_click="handleDeleteAccess">Delete</goa-button>
          <goa-button type="tertiary" @_click="cancelDeleteAccess">Cancel</goa-button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue';
import api from '@/services/api.js';

const data = ref([]);
const loading = ref(true);
const total = ref(0);
const currentPage = ref(1);
const pageSize = 25;
const successMsg = ref('');
const errorMsg = ref('');

// Filters
const filterStatus = ref('');
const searchTerm = ref('');
const statuses = ref([]);

// Expand
const expandedId = ref(null);
const expandedDetail = ref(null);
const expandLoading = ref(false);

// Form
const showForm = ref(false);
const editingApp = ref(null);
const saving = ref(false);
const formError = ref('');
const formErrors = reactive({ application_number: '' });

const formData = reactive({
  application_number: '',
  file_number: '',
  applicant: '',
  status: 'Open',
  staff: '',
  contact_date: '',
  amendment: false,
  staff_notes: ''
});

// Delete
const showDeleteConfirm = ref(false);
const deletingApp = ref(null);

// Order form
const showOrderForm = ref(false);
const editingOrder = ref(null);
const savingOrder = ref(false);
const orderFormError = ref('');
const orderFormData = reactive({
  order_number: '',
  date_issued: ''
});

// Order delete
const showDeleteOrderConfirm = ref(false);
const deletingOrder = ref(null);

// Access record form
const showAccessForm = ref(false);
const editingAccess = ref(null);
const savingAccess = ref(false);
const accessFormError = ref('');
const accessFormData = reactive({
  status: '', operator: '', settlement: '', project_type: '',
  reo: '', reo_date: '', co: '', co_date: '',
  purpose: '', wellsite_legal: '', anniversary_date: '', lands_affected: ''
});

// Access record delete
const showDeleteAccessConfirm = ref(false);
const deletingAccess = ref(null);

// Access record dropdown lists
const settlements = ref([]);
const projectTypes = ref([]);

const totalPages = computed(() => Math.ceil(total.value / pageSize));

const paginationRange = computed(() => {
  const pages = [];
  const tp = totalPages.value;
  const cp = currentPage.value;
  if (tp <= 7) {
    for (let i = 1; i <= tp; i++) pages.push(i);
  } else {
    pages.push(1);
    if (cp > 3) pages.push('...');
    for (let i = Math.max(2, cp - 1); i <= Math.min(tp - 1, cp + 1); i++) pages.push(i);
    if (cp < tp - 2) pages.push('...');
    pages.push(tp);
  }
  return pages;
});

function formatDate(d) {
  if (!d) return '—';
  const dt = new Date(d);
  return dt.toLocaleDateString('en-CA', { year: 'numeric', month: 'short', day: 'numeric' });
}

function statusClass(status) {
  const map = {
    'Open': 'status-open',
    'Active': 'status-active',
    'Order Issued': 'status-issued',
    'Closed': 'status-closed',
    'Close': 'status-closed',
    'Withdrawn': 'status-withdrawn'
  };
  return map[status] || 'status-default';
}

async function loadStatuses() {
  try {
    const r = await api.get('/lap/statuses');
    if (r.success) statuses.value = r.data;
  } catch { /* ignore */ }
}

async function loadApplications() {
  loading.value = true;
  expandedId.value = null;
  expandedDetail.value = null;
  try {
    const params = { page: currentPage.value, limit: pageSize };
    if (filterStatus.value) params.status = filterStatus.value;
    if (searchTerm.value.trim()) params.search = searchTerm.value.trim();

    const r = await api.get('/lap/applications', { params });
    if (r.success) {
      data.value = r.data;
      total.value = r.total;
    }
  } catch (err) {
    errorMsg.value = err.response?.data?.message || 'Failed to load applications';
  } finally {
    loading.value = false;
  }
}

function clearFilters() {
  filterStatus.value = '';
  searchTerm.value = '';
  currentPage.value = 1;
  loadApplications();
}

function goPage(p) {
  currentPage.value = p;
  loadApplications();
}

async function toggleExpand(app) {
  if (expandedId.value === app.id) {
    expandedId.value = null;
    expandedDetail.value = null;
    return;
  }
  expandedId.value = app.id;
  expandedDetail.value = null;
  expandLoading.value = true;
  try {
    const r = await api.get(`/lap/applications/${app.id}`);
    if (r.success) expandedDetail.value = r.data;
  } catch {
    expandedDetail.value = null;
  } finally {
    expandLoading.value = false;
  }
}

function openCreateForm() {
  editingApp.value = null;
  formData.application_number = '';
  formData.file_number = '';
  formData.applicant = '';
  formData.status = 'Open';
  formData.staff = '';
  formData.contact_date = '';
  formData.amendment = false;
  formData.staff_notes = '';
  formErrors.application_number = '';
  formError.value = '';
  successMsg.value = '';
  errorMsg.value = '';
  showForm.value = true;
}

function openEditForm(app) {
  editingApp.value = app;
  formData.application_number = app.application_number || '';
  formData.file_number = app.file_number || '';
  formData.applicant = app.applicant || '';
  formData.status = app.status || 'Open';
  formData.staff = app.staff || '';
  formData.contact_date = app.contact_date ? app.contact_date.substring(0, 10) : '';
  formData.amendment = app.amendment || false;
  formData.staff_notes = app.staff_notes || '';
  formErrors.application_number = '';
  formError.value = '';
  successMsg.value = '';
  errorMsg.value = '';
  showForm.value = true;
}

function closeForm() {
  showForm.value = false;
  editingApp.value = null;
}

async function handleSubmit() {
  formErrors.application_number = '';
  formError.value = '';

  if (!editingApp.value && !formData.application_number.trim()) {
    formErrors.application_number = 'Application number is required';
    return;
  }

  saving.value = true;
  try {
    if (editingApp.value) {
      const r = await api.put(`/lap/applications/${editingApp.value.id}`, {
        applicant: formData.applicant,
        file_number: formData.file_number,
        status: formData.status,
        staff: formData.staff,
        contact_date: formData.contact_date || null,
        amendment: formData.amendment,
        staff_notes: formData.staff_notes
      });
      if (r.success) {
        successMsg.value = 'Application updated';
        closeForm();
        await loadApplications();
      }
    } else {
      const r = await api.post('/lap/applications', {
        application_number: formData.application_number.trim(),
        file_number: formData.file_number || null,
        applicant: formData.applicant || null,
        status: formData.status,
        staff: formData.staff || null,
        contact_date: formData.contact_date || null,
        amendment: formData.amendment,
        staff_notes: formData.staff_notes || null
      });
      if (r.success) {
        successMsg.value = 'Application created';
        closeForm();
        await Promise.all([loadApplications(), loadStatuses()]);
      }
    }
  } catch (err) {
    formError.value = err.response?.data?.message || 'Operation failed';
  } finally {
    saving.value = false;
  }
}

function confirmDelete(app) {
  deletingApp.value = app;
  showDeleteConfirm.value = true;
}

function cancelDelete() {
  deletingApp.value = null;
  showDeleteConfirm.value = false;
}

async function handleDelete() {
  if (!deletingApp.value) return;
  successMsg.value = '';
  errorMsg.value = '';
  try {
    const r = await api.delete(`/lap/applications/${deletingApp.value.id}`);
    if (r.success) {
      successMsg.value = 'Application deleted';
      await Promise.all([loadApplications(), loadStatuses()]);
    }
  } catch (err) {
    errorMsg.value = err.response?.data?.message || 'Failed to delete';
  } finally {
    cancelDelete();
  }
}

// ==============================
// Order CRUD
// ==============================

function openOrderForm(order) {
  editingOrder.value = order;
  orderFormData.order_number = order?.order_number || '';
  orderFormData.date_issued = order?.date_issued ? order.date_issued.substring(0, 10) : '';
  orderFormError.value = '';
  showOrderForm.value = true;
}

function closeOrderForm() {
  showOrderForm.value = false;
  editingOrder.value = null;
}

async function handleOrderSubmit() {
  orderFormError.value = '';
  savingOrder.value = true;
  try {
    if (editingOrder.value) {
      const r = await api.put(`/lap/orders/${editingOrder.value.id}`, {
        order_number: orderFormData.order_number || null,
        date_issued: orderFormData.date_issued || null
      });
      if (r.success) {
        successMsg.value = 'Order updated';
        closeOrderForm();
        await refreshExpandedDetail();
      }
    } else {
      const r = await api.post('/lap/orders', {
        application_id: expandedId.value,
        order_number: orderFormData.order_number || null,
        date_issued: orderFormData.date_issued || null
      });
      if (r.success) {
        successMsg.value = 'Order added';
        closeOrderForm();
        await refreshExpandedDetail();
      }
    }
  } catch (err) {
    orderFormError.value = err.response?.data?.message || 'Operation failed';
  } finally {
    savingOrder.value = false;
  }
}

function confirmDeleteOrder(order) {
  deletingOrder.value = order;
  showDeleteOrderConfirm.value = true;
}

function cancelDeleteOrder() {
  deletingOrder.value = null;
  showDeleteOrderConfirm.value = false;
}

async function handleDeleteOrder() {
  if (!deletingOrder.value) return;
  successMsg.value = '';
  errorMsg.value = '';
  try {
    const r = await api.delete(`/lap/orders/${deletingOrder.value.id}`);
    if (r.success) {
      successMsg.value = 'Order deleted';
      await refreshExpandedDetail();
    }
  } catch (err) {
    errorMsg.value = err.response?.data?.message || 'Failed to delete order';
  } finally {
    cancelDeleteOrder();
  }
}

async function refreshExpandedDetail() {
  if (!expandedId.value) return;
  try {
    const r = await api.get(`/lap/applications/${expandedId.value}`);
    if (r.success) expandedDetail.value = r.data;
  } catch { /* ignore */ }
}

// ==============================
// Access Record CRUD
// ==============================

function openAccessForm(record) {
  editingAccess.value = record;
  accessFormData.status = record?.status || '';
  accessFormData.operator = record?.operator || '';
  accessFormData.settlement = record?.settlement || '';
  accessFormData.project_type = record?.project_type || '';
  accessFormData.reo = record?.reo || '';
  accessFormData.reo_date = record?.reo_date ? record.reo_date.substring(0, 10) : '';
  accessFormData.co = record?.co || '';
  accessFormData.co_date = record?.co_date ? record.co_date.substring(0, 10) : '';
  accessFormData.purpose = record?.purpose || '';
  accessFormData.wellsite_legal = record?.wellsite_legal || '';
  accessFormData.anniversary_date = record?.anniversary_date ? record.anniversary_date.substring(0, 10) : '';
  accessFormData.lands_affected = record?.lands_affected || '';
  accessFormError.value = '';
  showAccessForm.value = true;
}

function closeAccessForm() {
  showAccessForm.value = false;
  editingAccess.value = null;
}

async function handleAccessSubmit() {
  accessFormError.value = '';
  savingAccess.value = true;
  try {
    const payload = {
      status: accessFormData.status || null,
      operator: accessFormData.operator || null,
      settlement: accessFormData.settlement || null,
      project_type: accessFormData.project_type || null,
      reo: accessFormData.reo || null,
      reo_date: accessFormData.reo_date || null,
      co: accessFormData.co || null,
      co_date: accessFormData.co_date || null,
      purpose: accessFormData.purpose || null,
      wellsite_legal: accessFormData.wellsite_legal || null,
      anniversary_date: accessFormData.anniversary_date || null,
      lands_affected: accessFormData.lands_affected || null
    };

    if (editingAccess.value) {
      const r = await api.put(`/lap/access-records/${editingAccess.value.id}`, payload);
      if (r.success) {
        successMsg.value = 'Access record updated';
        closeAccessForm();
        await refreshExpandedDetail();
      }
    } else {
      payload.file_number = expandedDetail.value?.file_number;
      if (!payload.file_number) {
        accessFormError.value = 'Application has no file number — cannot link access record';
        savingAccess.value = false;
        return;
      }
      const r = await api.post('/lap/access-records', payload);
      if (r.success) {
        successMsg.value = 'Access record added';
        closeAccessForm();
        await refreshExpandedDetail();
      }
    }
  } catch (err) {
    accessFormError.value = err.response?.data?.message || 'Operation failed';
  } finally {
    savingAccess.value = false;
  }
}

function confirmDeleteAccess(record) {
  deletingAccess.value = record;
  showDeleteAccessConfirm.value = true;
}

function cancelDeleteAccess() {
  deletingAccess.value = null;
  showDeleteAccessConfirm.value = false;
}

async function handleDeleteAccess() {
  if (!deletingAccess.value) return;
  successMsg.value = '';
  errorMsg.value = '';
  try {
    const r = await api.delete(`/lap/access-records/${deletingAccess.value.id}`);
    if (r.success) {
      successMsg.value = 'Access record deleted';
      await refreshExpandedDetail();
    }
  } catch (err) {
    errorMsg.value = err.response?.data?.message || 'Failed to delete access record';
  } finally {
    cancelDeleteAccess();
  }
}

async function loadSettlements() {
  try {
    const r = await api.get('/lap/access-records/settlements');
    if (r.success) settlements.value = r.data;
  } catch { /* ignore */ }
}

async function loadProjectTypes() {
  try {
    const r = await api.get('/lap/access-records/project-types');
    if (r.success) projectTypes.value = r.data;
  } catch { /* ignore */ }
}

onMounted(() => {
  loadStatuses();
  loadApplications();
  loadSettlements();
  loadProjectTypes();
});
</script>

<style scoped>
.lap-applications {
  padding: var(--goa-space-m) 0;
}

.page-header {
  margin-bottom: var(--goa-space-xl);
}

.page-header h1 {
  font-size: var(--goa-font-size-8, 1.75rem);
  margin-bottom: var(--goa-space-xs);
}

.page-header p {
  color: var(--goa-color-text-secondary, #666);
}

.actions-bar {
  display: flex;
  align-items: center;
  gap: var(--goa-space-l);
  flex-wrap: wrap;
  margin-bottom: var(--goa-space-m);
}

.filters {
  display: flex;
  gap: var(--goa-space-m);
  flex-wrap: wrap;
  flex: 1;
}

.filter-group {
  display: flex;
  align-items: center;
  gap: var(--goa-space-xs);
}

.filter-group label {
  font-size: var(--goa-font-size-4, 0.875rem);
  color: var(--goa-color-text-secondary, #666);
  white-space: nowrap;
}

.filter-group select,
.filter-group input {
  padding: 6px 12px;
  border: 1px solid var(--goa-color-greyscale-200, #dcdcdc);
  border-radius: var(--goa-border-radius-m, 4px);
  font-size: var(--goa-font-size-4, 0.875rem);
}

.filter-group input { width: 200px; }

.search-btn {
  padding: 6px 14px;
  background: var(--goa-color-interactive-default, #0070c4);
  color: white;
  border: none;
  border-radius: var(--goa-border-radius-m, 4px);
  cursor: pointer;
  font-size: var(--goa-font-size-4, 0.875rem);
}

.search-btn:hover { opacity: 0.9; }

.summary-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--goa-space-s);
  font-size: var(--goa-font-size-4, 0.875rem);
  color: var(--goa-color-text-secondary, #666);
}

.clear-link {
  color: var(--goa-color-interactive-default, #0070c4);
  cursor: pointer;
  text-decoration: underline;
}

.table-container {
  background: white;
  border: 1px solid var(--goa-color-greyscale-200, #dcdcdc);
  border-radius: var(--goa-border-radius-m, 4px);
  overflow-x: auto;
}

.data-table {
  width: 100%;
  border-collapse: collapse;
}

.data-table th,
.data-table td {
  padding: var(--goa-space-s) var(--goa-space-m);
  text-align: left;
  border-bottom: 1px solid var(--goa-color-greyscale-200, #dcdcdc);
}

.data-table th {
  background: var(--goa-color-greyscale-100, #f1f1f1);
  font-weight: var(--goa-font-weight-bold, 700);
  font-size: var(--goa-font-size-4, 0.875rem);
  color: var(--goa-color-text-secondary, #333);
}

.data-table tbody tr:not(.detail-row) {
  cursor: pointer;
}

.data-table tbody tr:not(.detail-row):hover {
  background: var(--goa-color-greyscale-100, #f9f9f9);
}

.expanded-row {
  background: #eef4ff !important;
}

.center-text {
  text-align: center;
  padding: var(--goa-space-xl) !important;
  color: var(--goa-color-text-secondary, #666);
}

.mono { font-family: monospace; }

.status-badge {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 12px;
  font-size: var(--goa-font-size-3, 0.8rem);
  font-weight: var(--goa-font-weight-bold, 700);
}

.status-open { background: #dbeafe; color: #1d4ed8; }
.status-active { background: #d1fae5; color: #065f46; }
.status-issued { background: #e8d5f5; color: #6b21a8; }
.status-closed { background: #e5e7eb; color: #374151; }
.status-withdrawn { background: #fef3c7; color: #b45309; }
.status-default { background: #f3f4f6; color: #6b7280; }

.actions-cell {
  display: flex;
  gap: var(--goa-space-xs);
}

/* Detail panel */
.detail-row td {
  padding: 0 !important;
  background: #f8faff;
}

.detail-panel {
  padding: var(--goa-space-l) var(--goa-space-xl);
  border-top: 2px solid var(--goa-color-interactive-default, #0070c4);
}

.detail-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--goa-space-l);
}

.detail-section h4 {
  font-size: var(--goa-font-size-5, 1rem);
  font-weight: var(--goa-font-weight-bold, 700);
  margin-bottom: var(--goa-space-s);
  color: var(--goa-color-text-default);
}

.detail-fields {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--goa-space-xs) var(--goa-space-m);
  font-size: var(--goa-font-size-4, 0.875rem);
}

.notes-block {
  margin-top: var(--goa-space-s);
  font-size: var(--goa-font-size-4, 0.875rem);
}

.notes-block p {
  margin-top: var(--goa-space-2xs);
  white-space: pre-wrap;
  color: var(--goa-color-text-secondary, #666);
}

.full-width { grid-column: 1 / -1; }

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--goa-space-s);
}

.section-header h4 {
  margin-bottom: 0 !important;
}

.sub-actions {
  display: flex;
  gap: 4px;
}

.inline-btn {
  padding: 2px 8px;
  font-size: var(--goa-font-size-3, 0.8rem);
  border: 1px solid var(--goa-color-greyscale-200, #dcdcdc);
  border-radius: var(--goa-border-radius-m, 4px);
  background: white;
  cursor: pointer;
  color: var(--goa-color-interactive-default, #0070c4);
}

.inline-btn:hover { background: var(--goa-color-greyscale-100, #f1f1f1); }

.inline-btn.danger {
  color: #991b1b;
  border-color: #fca5a5;
}

.inline-btn.danger:hover { background: #fef2f2; }

.empty-text {
  color: var(--goa-color-text-secondary, #666);
  font-style: italic;
  font-size: var(--goa-font-size-4, 0.875rem);
}

.sub-table {
  width: 100%;
  border-collapse: collapse;
  font-size: var(--goa-font-size-3, 0.8rem);
}

.sub-table th,
.sub-table td {
  padding: 4px 8px;
  border: 1px solid var(--goa-color-greyscale-200, #dcdcdc);
  text-align: left;
}

.sub-table th {
  background: var(--goa-color-greyscale-100, #f1f1f1);
  font-weight: var(--goa-font-weight-bold, 700);
}

.wrap-cell {
  max-width: 200px;
  word-break: break-word;
}

/* Pagination */
.pagination {
  display: flex;
  justify-content: center;
  gap: var(--goa-space-xs);
  margin-top: var(--goa-space-l);
}

.pagination button {
  padding: 6px 12px;
  border: 1px solid var(--goa-color-greyscale-200, #dcdcdc);
  background: white;
  border-radius: var(--goa-border-radius-m, 4px);
  cursor: pointer;
  font-size: var(--goa-font-size-4, 0.875rem);
}

.pagination button:hover:not(:disabled) {
  background: var(--goa-color-greyscale-100, #f1f1f1);
}

.pagination button.active {
  background: var(--goa-color-interactive-default, #0070c4);
  color: white;
  border-color: var(--goa-color-interactive-default, #0070c4);
}

.pagination button:disabled {
  opacity: 0.5;
  cursor: default;
}

.ellipsis { border: none; background: none; }

/* Modal */
.modal-overlay {
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-content {
  background: white;
  border-radius: var(--goa-border-radius-m, 4px);
  padding: var(--goa-space-xl);
  width: 100%;
  max-width: 560px;
  max-height: 90vh;
  overflow-y: auto;
}

.modal-small { max-width: 440px; }

.modal-content h2 {
  font-size: var(--goa-font-size-6, 1.25rem);
  margin-bottom: var(--goa-space-m);
  padding-bottom: var(--goa-space-s);
  border-bottom: 1px solid var(--goa-color-greyscale-200, #dcdcdc);
}

.date-input {
  padding: 8px 12px;
  border: 1px solid var(--goa-color-greyscale-200, #dcdcdc);
  border-radius: var(--goa-border-radius-m, 4px);
  font-size: var(--goa-font-size-4, 0.875rem);
}

.notes-textarea {
  width: 100%;
  padding: var(--goa-space-s);
  border: 1px solid var(--goa-color-greyscale-200, #dcdcdc);
  border-radius: var(--goa-border-radius-m, 4px);
  font-size: var(--goa-font-size-4, 0.875rem);
  resize: vertical;
}

.form-actions {
  margin-top: var(--goa-space-m);
  display: flex;
  gap: var(--goa-space-s);
}

.warning-text {
  color: #991b1b;
  font-weight: var(--goa-font-weight-bold, 700);
  margin-top: var(--goa-space-s);
}

.form-select {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid var(--goa-color-greyscale-200, #dcdcdc);
  border-radius: var(--goa-border-radius-m, 4px);
  font-size: var(--goa-font-size-4, 0.875rem);
  background: white;
}

.form-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--goa-space-xs) var(--goa-space-m);
}

.map-link { text-decoration: none; }

@media (max-width: 968px) {
  .detail-grid { grid-template-columns: 1fr; }
  .detail-fields { grid-template-columns: 1fr; }
  .form-grid { grid-template-columns: 1fr; }
}
</style>
