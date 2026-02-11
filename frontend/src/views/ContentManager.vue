<template>
  <div class="content-manager">
    <div class="page-header">
      <h1>Content Management</h1>
      <p>Manage website pages and content blocks</p>
    </div>

    <goa-callout v-if="successMsg" type="success" heading="Success">
      {{ successMsg }}
    </goa-callout>

    <goa-callout v-if="errorMsg" type="emergency" heading="Error">
      {{ errorMsg }}
    </goa-callout>

    <!-- Actions bar -->
    <div class="actions-bar">
      <goa-button type="primary" @_click="openCreateForm">
        Add Content Block
      </goa-button>
      <div class="filter-group">
        <label>Filter by page:</label>
        <select v-model="filterPage" class="page-filter">
          <option value="">All Pages</option>
          <option v-for="p in uniquePages" :key="p" :value="p">{{ p }}</option>
        </select>
      </div>
    </div>

    <!-- Content table -->
    <div class="table-container">
      <table class="content-table">
        <thead>
          <tr>
            <th>Page</th>
            <th>Section Key</th>
            <th>Title</th>
            <th>Status</th>
            <th>Order</th>
            <th>Updated</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="loading">
            <td colspan="7" class="center-text">Loading content...</td>
          </tr>
          <tr v-else-if="filteredContent.length === 0">
            <td colspan="7" class="center-text">No content blocks found</td>
          </tr>
          <tr v-for="item in filteredContent" :key="item.id" :class="{ 'draft-row': !item.is_published }">
            <td>
              <span class="page-badge">{{ item.page_slug }}</span>
            </td>
            <td>{{ item.section_key }}</td>
            <td>{{ item.title || '—' }}</td>
            <td>
              <span class="status-badge" :class="item.is_published ? 'status-published' : 'status-draft'">
                {{ item.is_published ? 'Published' : 'Draft' }}
              </span>
            </td>
            <td>{{ item.sort_order }}</td>
            <td>{{ formatDate(item.updated_at) }}</td>
            <td class="actions-cell">
              <goa-button type="tertiary" size="compact" @_click="openEditForm(item)">
                Edit
              </goa-button>
              <goa-button type="tertiary" size="compact" @_click="togglePublish(item)">
                {{ item.is_published ? 'Unpublish' : 'Publish' }}
              </goa-button>
              <goa-button type="tertiary" size="compact" @_click="confirmDelete(item)">
                Delete
              </goa-button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Create/Edit Modal -->
    <div v-if="showForm" class="modal-overlay" @click.self="closeForm">
      <div class="modal-content">
        <h2>{{ editingItem ? 'Edit Content Block' : 'New Content Block' }}</h2>

        <goa-callout v-if="formError" type="emergency" heading="Error">
          {{ formError }}
        </goa-callout>

        <goa-form-item label="Page Slug" :error="formErrors.page_slug">
          <goa-input
            name="page_slug"
            :value="formData.page_slug"
            @_change="(e) => formData.page_slug = e.detail.value"
            width="100%"
            placeholder="e.g. home, about, contact"
            :disabled="!!editingItem"
          />
        </goa-form-item>

        <goa-form-item label="Section Key" :error="formErrors.section_key">
          <goa-input
            name="section_key"
            :value="formData.section_key"
            @_change="(e) => formData.section_key = e.detail.value"
            width="100%"
            placeholder="e.g. hero, mandate, info"
            :disabled="!!editingItem"
          />
        </goa-form-item>

        <goa-form-item label="Title">
          <goa-input
            name="title"
            :value="formData.title"
            @_change="(e) => formData.title = e.detail.value"
            width="100%"
            placeholder="Section heading (optional)"
          />
        </goa-form-item>

        <goa-form-item label="Body">
          <textarea
            class="body-editor"
            v-model="formData.body"
            rows="10"
            placeholder="Content body (supports plain text or HTML)"
          ></textarea>
        </goa-form-item>

        <div class="form-row">
          <goa-form-item label="Sort Order">
            <goa-input
              type="number"
              name="sort_order"
              :value="String(formData.sort_order)"
              @_change="(e) => formData.sort_order = Number(e.detail.value)"
              width="100px"
            />
          </goa-form-item>

          <goa-form-item label="Published">
            <goa-checkbox
              name="is_published"
              :checked="formData.is_published"
              @_change="(e) => formData.is_published = e.detail.checked"
            />
          </goa-form-item>
        </div>

        <div class="form-actions">
          <goa-button type="primary" @_click="handleSubmit" :disabled="saving">
            {{ saving ? 'Saving...' : (editingItem ? 'Save Changes' : 'Create') }}
          </goa-button>
          <goa-button type="tertiary" @_click="closeForm">
            Cancel
          </goa-button>
        </div>
      </div>
    </div>

    <!-- Delete Confirmation Modal -->
    <div v-if="showDeleteConfirm" class="modal-overlay" @click.self="cancelDelete">
      <div class="modal-content modal-small">
        <h2>Delete Content Block</h2>
        <p>Are you sure you want to delete the content block <strong>"{{ deletingItem?.section_key }}"</strong> from page <strong>"{{ deletingItem?.page_slug }}"</strong>?</p>
        <p class="warning-text">This action cannot be undone.</p>
        <div class="form-actions">
          <goa-button type="primary" @_click="handleDelete">
            Delete
          </goa-button>
          <goa-button type="tertiary" @_click="cancelDelete">
            Cancel
          </goa-button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue';
import api from '@/services/api.js';

const contentItems = ref([]);
const loading = ref(true);
const successMsg = ref('');
const errorMsg = ref('');
const filterPage = ref('');

// Form state
const showForm = ref(false);
const editingItem = ref(null);
const saving = ref(false);
const formError = ref('');

// Delete state
const showDeleteConfirm = ref(false);
const deletingItem = ref(null);

const formData = reactive({
  page_slug: '',
  section_key: '',
  title: '',
  body: '',
  is_published: true,
  sort_order: 0
});

const formErrors = reactive({
  page_slug: '',
  section_key: ''
});

const uniquePages = computed(() => {
  const pages = [...new Set(contentItems.value.map(c => c.page_slug))];
  return pages.sort();
});

const filteredContent = computed(() => {
  if (!filterPage.value) return contentItems.value;
  return contentItems.value.filter(c => c.page_slug === filterPage.value);
});

function formatDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-CA', { year: 'numeric', month: 'short', day: 'numeric' });
}

async function loadContent() {
  loading.value = true;
  try {
    const response = await api.get('/content');
    if (response.success) {
      contentItems.value = response.data;
    }
  } catch (err) {
    errorMsg.value = err.response?.data?.message || 'Failed to load content';
  } finally {
    loading.value = false;
  }
}

function clearFormErrors() {
  formErrors.page_slug = '';
  formErrors.section_key = '';
  formError.value = '';
}

function openCreateForm() {
  editingItem.value = null;
  formData.page_slug = '';
  formData.section_key = '';
  formData.title = '';
  formData.body = '';
  formData.is_published = true;
  formData.sort_order = 0;
  clearFormErrors();
  successMsg.value = '';
  errorMsg.value = '';
  showForm.value = true;
}

async function openEditForm(item) {
  editingItem.value = item;
  clearFormErrors();
  successMsg.value = '';
  errorMsg.value = '';

  // Fetch full body from detail endpoint
  try {
    const response = await api.get(`/content/${item.id}`);
    if (response.success) {
      const full = response.data;
      formData.page_slug = full.page_slug;
      formData.section_key = full.section_key;
      formData.title = full.title || '';
      formData.body = full.body || '';
      formData.is_published = full.is_published;
      formData.sort_order = full.sort_order;
    }
  } catch (err) {
    formData.page_slug = item.page_slug;
    formData.section_key = item.section_key;
    formData.title = item.title || '';
    formData.body = '';
    formData.is_published = item.is_published;
    formData.sort_order = item.sort_order;
  }

  showForm.value = true;
}

function closeForm() {
  showForm.value = false;
  editingItem.value = null;
}

function validateForm() {
  clearFormErrors();
  let valid = true;

  if (!editingItem.value && !formData.page_slug.trim()) {
    formErrors.page_slug = 'Page slug is required';
    valid = false;
  }
  if (!editingItem.value && !formData.section_key.trim()) {
    formErrors.section_key = 'Section key is required';
    valid = false;
  }

  return valid;
}

async function handleSubmit() {
  if (!validateForm()) return;

  saving.value = true;
  formError.value = '';

  try {
    if (editingItem.value) {
      const response = await api.put(`/content/${editingItem.value.id}`, {
        title: formData.title,
        body: formData.body,
        is_published: formData.is_published,
        sort_order: formData.sort_order
      });
      if (response.success) {
        successMsg.value = 'Content block updated';
        closeForm();
        await loadContent();
      }
    } else {
      const response = await api.post('/content', {
        page_slug: formData.page_slug.trim(),
        section_key: formData.section_key.trim(),
        title: formData.title,
        body: formData.body,
        is_published: formData.is_published,
        sort_order: formData.sort_order
      });
      if (response.success) {
        successMsg.value = 'Content block created';
        closeForm();
        await loadContent();
      }
    }
  } catch (err) {
    formError.value = err.response?.data?.message || 'Operation failed';
  } finally {
    saving.value = false;
  }
}

async function togglePublish(item) {
  successMsg.value = '';
  errorMsg.value = '';
  try {
    const response = await api.put(`/content/${item.id}`, {
      is_published: !item.is_published
    });
    if (response.success) {
      successMsg.value = item.is_published ? 'Content unpublished' : 'Content published';
      await loadContent();
    }
  } catch (err) {
    errorMsg.value = err.response?.data?.message || 'Failed to update status';
  }
}

function confirmDelete(item) {
  deletingItem.value = item;
  showDeleteConfirm.value = true;
}

function cancelDelete() {
  deletingItem.value = null;
  showDeleteConfirm.value = false;
}

async function handleDelete() {
  if (!deletingItem.value) return;
  successMsg.value = '';
  errorMsg.value = '';
  try {
    const response = await api.delete(`/content/${deletingItem.value.id}`);
    if (response.success) {
      successMsg.value = 'Content block deleted';
      await loadContent();
    }
  } catch (err) {
    errorMsg.value = err.response?.data?.message || 'Failed to delete content';
  } finally {
    cancelDelete();
  }
}

onMounted(loadContent);
</script>

<style scoped>
.content-manager {
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
  margin-bottom: var(--goa-space-m);
  display: flex;
  align-items: center;
  gap: var(--goa-space-l);
  flex-wrap: wrap;
}

.filter-group {
  display: flex;
  align-items: center;
  gap: var(--goa-space-s);
}

.filter-group label {
  font-size: var(--goa-font-size-4, 0.875rem);
  color: var(--goa-color-text-secondary, #666);
}

.page-filter {
  padding: 6px 12px;
  border: 1px solid var(--goa-color-greyscale-200, #dcdcdc);
  border-radius: var(--goa-border-radius-m, 4px);
  font-size: var(--goa-font-size-4, 0.875rem);
}

.table-container {
  background: white;
  border: 1px solid var(--goa-color-greyscale-200, #dcdcdc);
  border-radius: var(--goa-border-radius-m, 4px);
  overflow-x: auto;
}

.content-table {
  width: 100%;
  border-collapse: collapse;
}

.content-table th,
.content-table td {
  padding: var(--goa-space-s) var(--goa-space-m);
  text-align: left;
  border-bottom: 1px solid var(--goa-color-greyscale-200, #dcdcdc);
}

.content-table th {
  background: var(--goa-color-greyscale-100, #f1f1f1);
  font-weight: var(--goa-font-weight-bold, 700);
  font-size: var(--goa-font-size-4, 0.875rem);
  color: var(--goa-color-text-secondary, #333);
}

.content-table tbody tr:hover {
  background: var(--goa-color-greyscale-100, #f9f9f9);
}

.draft-row {
  opacity: 0.7;
}

.center-text {
  text-align: center;
  padding: var(--goa-space-xl) !important;
  color: var(--goa-color-text-secondary, #666);
}

.page-badge {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 12px;
  font-size: var(--goa-font-size-3, 0.8rem);
  font-weight: var(--goa-font-weight-bold, 700);
  background: #dbeafe;
  color: #1d4ed8;
}

.status-badge {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 12px;
  font-size: var(--goa-font-size-3, 0.8rem);
  font-weight: var(--goa-font-weight-bold, 700);
}

.status-published { background: #d1fae5; color: #065f46; }
.status-draft { background: #fef3c7; color: #b45309; }

.actions-cell {
  display: flex;
  gap: var(--goa-space-xs);
  flex-wrap: wrap;
}

/* Modal */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
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
  max-width: 640px;
  max-height: 90vh;
  overflow-y: auto;
}

.modal-small {
  max-width: 440px;
}

.modal-content h2 {
  font-size: var(--goa-font-size-6, 1.25rem);
  margin-bottom: var(--goa-space-m);
  padding-bottom: var(--goa-space-s);
  border-bottom: 1px solid var(--goa-color-greyscale-200, #dcdcdc);
}

.body-editor {
  width: 100%;
  font-family: monospace;
  font-size: var(--goa-font-size-4, 0.875rem);
  padding: var(--goa-space-s);
  border: 1px solid var(--goa-color-greyscale-200, #dcdcdc);
  border-radius: var(--goa-border-radius-m, 4px);
  resize: vertical;
}

.form-row {
  display: flex;
  gap: var(--goa-space-l);
  align-items: flex-end;
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
</style>
