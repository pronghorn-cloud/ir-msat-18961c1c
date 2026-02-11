<template>
  <div class="digitize-page">
    <div class="page-header">
      <div>
        <h1>Digitize Historical Files</h1>
        <p>Bulk upload scanned documents and link them to appeal cases</p>
      </div>
      <goa-button type="primary" @_click="showNewBatch = !showNewBatch">
        {{ showNewBatch ? 'Cancel' : 'New Batch' }}
      </goa-button>
    </div>

    <!-- Feedback Banner -->
    <div v-if="feedback" :class="['feedback-banner', feedbackError ? 'feedback-error' : 'feedback-success']">
      {{ feedback }}
    </div>

    <!-- New Batch Form -->
    <div v-if="showNewBatch" class="batch-form">
      <h2>Create Digitization Batch</h2>

      <div class="batch-name-field">
        <label>Batch Name</label>
        <input type="text" class="form-input" v-model="batchName"
               :placeholder="'Batch — ' + new Date().toLocaleDateString('en-CA')" />
      </div>

      <!-- File Selection -->
      <div class="file-select-area">
        <label>Select Files <span class="required">*</span></label>
        <div class="file-drop-zone" @click="$refs.fileInput.click()"
             @dragover.prevent="dragActive = true" @dragleave="dragActive = false"
             @drop.prevent="onDrop($event)"
             :class="{ 'drag-active': dragActive }">
          <input type="file" ref="fileInput" multiple @change="onFilesSelected"
                 accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.tif,.tiff"
                 style="display:none" />
          <div class="drop-zone-content">
            <span class="drop-icon">&#128196;</span>
            <span>Click to select files or drag &amp; drop here</span>
            <span class="drop-hint">PDF, Word, Excel, JPG, PNG, TIFF — max 50MB each</span>
          </div>
        </div>
      </div>

      <!-- Selected Files with Metadata -->
      <div v-if="selectedFiles.length > 0" class="files-list">
        <h3>{{ selectedFiles.length }} File(s) Selected</h3>
        <div v-for="(f, idx) in selectedFiles" :key="idx" class="file-item">
          <div class="file-item-header">
            <span class="file-item-name">{{ f.file.name }}</span>
            <span class="file-item-size">{{ formatFileSize(f.file.size) }}</span>
            <button class="file-remove-btn" @click="removeFile(idx)" title="Remove">&times;</button>
          </div>
          <div class="file-meta-grid">
            <div class="meta-field">
              <label>Appeal File #</label>
              <div class="appeal-lookup-wrapper">
                <input type="text" class="form-input" v-model="f.appeal_file_number"
                       placeholder="e.g. 01-001-25" @input="onAppealLookup(idx)" />
                <div v-if="f.lookupResults && f.lookupResults.length > 0" class="lookup-results">
                  <div v-for="a in f.lookupResults" :key="a.id" class="lookup-item"
                       @mousedown.prevent="selectAppeal(idx, a)">
                    <span class="lookup-fn">{{ a.file_number }}</span>
                    <span class="lookup-meta">{{ a.settlement_name }} — {{ a.issue_type }}</span>
                  </div>
                </div>
                <div v-if="f.linkedAppeal" class="linked-appeal">
                  {{ f.linkedAppeal.file_number }} — {{ f.linkedAppeal.settlement_name }}
                  <button class="clear-link-btn" @click="clearAppealLink(idx)">&times;</button>
                </div>
              </div>
            </div>
            <div class="meta-field">
              <label>Document Date</label>
              <input type="date" class="form-input" v-model="f.document_date" />
            </div>
            <div class="meta-field">
              <label>Category</label>
              <select class="form-input" v-model="f.category">
                <option value="Historical">Historical</option>
                <option value="Filing">Filing</option>
                <option value="Submission">Submission</option>
                <option value="Evidence">Evidence</option>
                <option value="Decision">Decision</option>
                <option value="Order">Order</option>
                <option value="Correspondence">Correspondence</option>
                <option value="Other">Other</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      <!-- Upload Progress -->
      <div v-if="uploading" class="upload-progress-section">
        <div class="upload-progress-bar-track">
          <div class="upload-progress-bar-fill" :style="{ width: uploadProgress + '%' }"></div>
        </div>
        <span class="upload-progress-text">Uploading... {{ uploadProgress }}%</span>
      </div>

      <!-- Upload Actions -->
      <div v-if="selectedFiles.length > 0" class="batch-actions">
        <goa-button type="primary" :disabled="selectedFiles.length === 0 || uploading" @_click="uploadBatch">
          {{ uploading ? 'Uploading...' : 'Upload Batch' }}
        </goa-button>
        <goa-button type="tertiary" @_click="resetForm">Clear All</goa-button>
      </div>
    </div>

    <!-- Batches List -->
    <div class="batches-section">
      <h2>Digitization Batches</h2>
      <div v-if="loading" class="loading-state">Loading batches...</div>
      <div v-else-if="batches.length === 0" class="empty-state">No digitization batches yet. Click "New Batch" to start.</div>
      <div v-else class="batches-list">
        <div v-for="batch in batches" :key="batch.id" class="batch-card">
          <div class="batch-card-header" @click="toggleBatch(batch)">
            <div class="batch-card-info">
              <span class="batch-card-name">{{ batch.name }}</span>
              <span class="batch-card-meta">
                {{ formatDate(batch.created_at) }}
                <template v-if="batch.created_by_name"> · {{ batch.created_by_name }}</template>
              </span>
            </div>
            <div class="batch-card-right">
              <span class="batch-status-badge" :class="'batch-status-' + (batch.status || '').toLowerCase().replace(/\s+/g, '-')">
                {{ batch.status }}
              </span>
              <span class="batch-doc-count">{{ batch.processed_files }}/{{ batch.total_files }} files</span>
              <span class="batch-expand-icon" :class="{ 'batch-expanded': expandedBatch === batch.id }">&#9660;</span>
            </div>
          </div>
          <div v-if="expandedBatch === batch.id" class="batch-card-body">
            <div v-if="loadingBatchDocs" class="loading-inline">Loading documents...</div>
            <table v-else-if="expandedDocs.length > 0" class="batch-docs-table">
              <thead>
                <tr>
                  <th>File Name</th>
                  <th>Type</th>
                  <th>Appeal #</th>
                  <th>Doc Date</th>
                  <th>Category</th>
                  <th>Size</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="doc in expandedDocs" :key="doc.id">
                  <td>{{ doc.original_name || doc.file_name }}</td>
                  <td><span class="doc-type-badge">{{ (doc.file_type || '').toUpperCase() }}</span></td>
                  <td>
                    <span v-if="doc.appeal_file_number" class="appeal-link" @click="$router.push(`/appeals/${doc.appeal_id}`)">
                      {{ doc.appeal_file_number }}
                    </span>
                    <span v-else class="muted">Unlinked</span>
                  </td>
                  <td>{{ doc.document_date ? formatDate(doc.document_date) : '—' }}</td>
                  <td>{{ doc.category || '—' }}</td>
                  <td>{{ doc.file_size ? formatFileSize(doc.file_size) : '—' }}</td>
                </tr>
              </tbody>
            </table>
            <div v-else class="loading-inline">No documents in this batch.</div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import api from '@/services/api.js';

const batches = ref([]);
const loading = ref(true);
const feedback = ref('');
const feedbackError = ref(false);

// New batch form state
const showNewBatch = ref(false);
const batchName = ref('');
const selectedFiles = ref([]);
const uploading = ref(false);
const uploadProgress = ref(0);
const dragActive = ref(false);

// Batch expansion state
const expandedBatch = ref(null);
const expandedDocs = ref([]);
const loadingBatchDocs = ref(false);

// Lookup debounce
let lookupTimeouts = {};

function showFeedback(message, isError = false) {
  feedback.value = message;
  feedbackError.value = isError;
  setTimeout(() => { feedback.value = ''; }, 5000);
}

function formatDate(val) {
  if (!val) return '—';
  return new Date(val).toLocaleDateString();
}

function formatFileSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / 1048576).toFixed(1) + ' MB';
}

// File selection
function onFilesSelected(event) {
  const files = Array.from(event.target.files);
  addFiles(files);
}

function onDrop(event) {
  dragActive.value = false;
  const files = Array.from(event.dataTransfer.files);
  addFiles(files);
}

function addFiles(files) {
  for (const file of files) {
    selectedFiles.value.push({
      file,
      appeal_file_number: '',
      document_date: '',
      category: 'Historical',
      lookupResults: null,
      linkedAppeal: null
    });
  }
}

function removeFile(idx) {
  selectedFiles.value.splice(idx, 1);
}

// Appeal lookup
function onAppealLookup(idx) {
  const f = selectedFiles.value[idx];
  f.linkedAppeal = null;
  clearTimeout(lookupTimeouts[idx]);

  if (!f.appeal_file_number || f.appeal_file_number.trim().length < 2) {
    f.lookupResults = null;
    return;
  }

  lookupTimeouts[idx] = setTimeout(async () => {
    try {
      const response = await api.get(`/digitize/lookup-appeal?file_number=${encodeURIComponent(f.appeal_file_number.trim())}`);
      if (response.success) {
        f.lookupResults = response.data;
      }
    } catch {
      f.lookupResults = [];
    }
  }, 300);
}

function selectAppeal(idx, appeal) {
  const f = selectedFiles.value[idx];
  f.linkedAppeal = appeal;
  f.appeal_file_number = appeal.file_number;
  f.lookupResults = null;
}

function clearAppealLink(idx) {
  const f = selectedFiles.value[idx];
  f.linkedAppeal = null;
  f.appeal_file_number = '';
}

// Upload batch
async function uploadBatch() {
  if (selectedFiles.value.length === 0 || uploading.value) return;

  uploading.value = true;
  uploadProgress.value = 0;

  const formData = new FormData();
  formData.append('batch_name', batchName.value.trim() || '');

  const metadata = selectedFiles.value.map(f => ({
    appeal_file_number: f.appeal_file_number || '',
    document_date: f.document_date || '',
    category: f.category || 'Historical'
  }));
  formData.append('metadata', JSON.stringify(metadata));

  for (const f of selectedFiles.value) {
    formData.append('files', f.file);
  }

  try {
    const token = localStorage.getItem('msat_token');
    const baseURL = api.defaults.baseURL;

    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${baseURL}/digitize/batches`);
    xhr.setRequestHeader('Authorization', `Bearer ${token}`);

    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable) {
        uploadProgress.value = Math.round((e.loaded / e.total) * 100);
      }
    });

    const result = await new Promise((resolve, reject) => {
      xhr.onload = () => {
        try {
          const data = JSON.parse(xhr.responseText);
          if (xhr.status >= 200 && xhr.status < 300) resolve(data);
          else reject(data);
        } catch { reject({ message: 'Upload failed' }); }
      };
      xhr.onerror = () => reject({ message: 'Upload failed' });
      xhr.send(formData);
    });

    showFeedback(result.message);

    // Show warnings for individual files
    const warnings = result.documents?.filter(d => d.warning).map(d => d.warning);
    if (warnings?.length > 0) {
      setTimeout(() => showFeedback(`Warnings: ${warnings.join('; ')}`, true), 100);
    }

    resetForm();
    showNewBatch.value = false;
    await loadBatches();
  } catch (err) {
    showFeedback(err.message || 'Failed to upload batch', true);
  } finally {
    uploading.value = false;
    uploadProgress.value = 0;
  }
}

function resetForm() {
  batchName.value = '';
  selectedFiles.value = [];
  uploadProgress.value = 0;
}

// Batch expansion
async function toggleBatch(batch) {
  if (expandedBatch.value === batch.id) {
    expandedBatch.value = null;
    expandedDocs.value = [];
    return;
  }
  expandedBatch.value = batch.id;
  loadingBatchDocs.value = true;
  try {
    const response = await api.get(`/digitize/batches/${batch.id}`);
    if (response.success) {
      expandedDocs.value = response.documents || [];
    }
  } catch {
    expandedDocs.value = [];
  } finally {
    loadingBatchDocs.value = false;
  }
}

// Load batches
async function loadBatches() {
  loading.value = true;
  try {
    const response = await api.get('/digitize/batches');
    if (response.success) {
      batches.value = response.data;
    }
  } catch {
    batches.value = [];
  } finally {
    loading.value = false;
  }
}

onMounted(() => {
  loadBatches();
});
</script>

<style scoped>
.digitize-page {
  padding: var(--goa-space-m) 0;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: var(--goa-space-l);
}

.page-header h1 {
  font-size: var(--goa-font-size-8, 1.75rem);
  margin-bottom: var(--goa-space-2xs);
}

.page-header p {
  color: var(--goa-color-text-secondary, #666);
}

.feedback-banner {
  padding: var(--goa-space-xs) var(--goa-space-m);
  border-radius: var(--goa-border-radius-m, 4px);
  font-weight: var(--goa-font-weight-bold, 700);
  font-size: var(--goa-font-size-4, 0.875rem);
  margin-bottom: var(--goa-space-m);
  text-align: center;
}

.feedback-success { background: #d1fae5; color: #065f46; }
.feedback-error { background: #fee2e2; color: #991b1b; }

/* Batch Form */
.batch-form {
  background: white;
  border: 1px solid var(--goa-color-greyscale-200, #dcdcdc);
  border-radius: var(--goa-border-radius-m, 4px);
  padding: var(--goa-space-l);
  margin-bottom: var(--goa-space-l);
}

.batch-form h2 {
  font-size: var(--goa-font-size-6, 1.25rem);
  margin-bottom: var(--goa-space-m);
}

.batch-name-field {
  margin-bottom: var(--goa-space-m);
  max-width: 400px;
}

.batch-name-field label,
.file-select-area > label {
  display: block;
  font-weight: var(--goa-font-weight-bold, 700);
  font-size: var(--goa-font-size-3, 0.8rem);
  margin-bottom: var(--goa-space-2xs);
}

.form-input {
  width: 100%;
  padding: 6px 10px;
  border: 1px solid var(--goa-color-greyscale-200, #dcdcdc);
  border-radius: var(--goa-border-radius-m, 4px);
  font-size: var(--goa-font-size-4, 0.875rem);
  box-sizing: border-box;
}

.form-input:focus {
  outline: none;
  border-color: var(--goa-color-interactive-default, #0070c4);
  box-shadow: 0 0 0 2px rgba(0, 112, 196, 0.15);
}

.required { color: #b91c1c; }

/* Drop Zone */
.file-select-area {
  margin-bottom: var(--goa-space-m);
}

.file-drop-zone {
  border: 2px dashed var(--goa-color-greyscale-200, #dcdcdc);
  border-radius: var(--goa-border-radius-m, 4px);
  padding: var(--goa-space-xl) var(--goa-space-l);
  text-align: center;
  cursor: pointer;
  transition: border-color 0.2s, background 0.2s;
}

.file-drop-zone:hover, .drag-active {
  border-color: var(--goa-color-interactive-default, #0070c4);
  background: rgba(0, 112, 196, 0.03);
}

.drop-zone-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--goa-space-xs);
}

.drop-icon {
  font-size: 2rem;
}

.drop-hint {
  font-size: var(--goa-font-size-3, 0.8rem);
  color: var(--goa-color-text-secondary, #666);
}

/* Files List */
.files-list {
  margin-bottom: var(--goa-space-m);
}

.files-list h3 {
  font-size: var(--goa-font-size-5, 1rem);
  margin-bottom: var(--goa-space-s);
}

.file-item {
  border: 1px solid var(--goa-color-greyscale-200, #dcdcdc);
  border-radius: var(--goa-border-radius-m, 4px);
  padding: var(--goa-space-s) var(--goa-space-m);
  margin-bottom: var(--goa-space-s);
  background: var(--goa-color-greyscale-100, #f9f9f9);
}

.file-item-header {
  display: flex;
  align-items: center;
  gap: var(--goa-space-m);
  margin-bottom: var(--goa-space-xs);
}

.file-item-name {
  font-weight: var(--goa-font-weight-bold, 700);
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.file-item-size {
  font-size: var(--goa-font-size-3, 0.8rem);
  color: var(--goa-color-text-secondary, #666);
}

.file-remove-btn {
  background: none;
  border: none;
  font-size: 1.2rem;
  cursor: pointer;
  color: #b91c1c;
  padding: 0 4px;
}

.file-remove-btn:hover { color: #991b1b; }

.file-meta-grid {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: var(--goa-space-s);
}

.meta-field label {
  display: block;
  font-size: var(--goa-font-size-2, 0.75rem);
  font-weight: var(--goa-font-weight-bold, 700);
  color: var(--goa-color-text-secondary, #666);
  margin-bottom: 2px;
}

/* Appeal Lookup */
.appeal-lookup-wrapper {
  position: relative;
}

.lookup-results {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  background: white;
  border: 1px solid var(--goa-color-greyscale-200, #dcdcdc);
  border-radius: var(--goa-border-radius-m, 4px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  z-index: 50;
  max-height: 150px;
  overflow-y: auto;
}

.lookup-item {
  padding: var(--goa-space-2xs) var(--goa-space-s);
  cursor: pointer;
  display: flex;
  justify-content: space-between;
  font-size: var(--goa-font-size-3, 0.8rem);
}

.lookup-item:hover {
  background: var(--goa-color-greyscale-100, #f5f5f5);
}

.lookup-fn {
  font-weight: var(--goa-font-weight-bold, 700);
}

.lookup-meta {
  color: var(--goa-color-text-secondary, #666);
}

.linked-appeal {
  display: inline-flex;
  align-items: center;
  gap: var(--goa-space-xs);
  font-size: var(--goa-font-size-3, 0.8rem);
  background: #dbeafe;
  color: #1d4ed8;
  padding: 2px 8px;
  border-radius: 10px;
  margin-top: 4px;
}

.clear-link-btn {
  background: none;
  border: none;
  cursor: pointer;
  font-size: 0.9rem;
  color: #1d4ed8;
}

/* Upload Progress */
.upload-progress-section {
  margin-bottom: var(--goa-space-m);
}

.upload-progress-bar-track {
  height: 8px;
  background: var(--goa-color-greyscale-200, #dcdcdc);
  border-radius: 4px;
  overflow: hidden;
  margin-bottom: var(--goa-space-2xs);
}

.upload-progress-bar-fill {
  height: 100%;
  background: var(--goa-color-interactive-default, #0070c4);
  border-radius: 4px;
  transition: width 0.2s;
}

.upload-progress-text {
  font-size: var(--goa-font-size-3, 0.8rem);
  color: var(--goa-color-text-secondary, #666);
}

.batch-actions {
  display: flex;
  gap: var(--goa-space-s);
}

/* Batches Section */
.batches-section {
  background: white;
  border: 1px solid var(--goa-color-greyscale-200, #dcdcdc);
  border-radius: var(--goa-border-radius-m, 4px);
  padding: var(--goa-space-l);
}

.batches-section h2 {
  font-size: var(--goa-font-size-6, 1.25rem);
  margin-bottom: var(--goa-space-m);
}

.loading-state, .empty-state {
  text-align: center;
  padding: var(--goa-space-l);
  color: var(--goa-color-text-secondary, #666);
}

.batches-list {
  display: flex;
  flex-direction: column;
  gap: var(--goa-space-s);
}

.batch-card {
  border: 1px solid var(--goa-color-greyscale-200, #dcdcdc);
  border-radius: var(--goa-border-radius-m, 4px);
  overflow: hidden;
}

.batch-card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--goa-space-s) var(--goa-space-m);
  cursor: pointer;
  background: white;
  transition: background 0.15s;
}

.batch-card-header:hover {
  background: var(--goa-color-greyscale-100, #f9f9f9);
}

.batch-card-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.batch-card-name {
  font-weight: var(--goa-font-weight-bold, 700);
}

.batch-card-meta {
  font-size: var(--goa-font-size-3, 0.8rem);
  color: var(--goa-color-text-secondary, #666);
}

.batch-card-right {
  display: flex;
  align-items: center;
  gap: var(--goa-space-s);
}

.batch-status-badge {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 10px;
  font-size: var(--goa-font-size-2, 0.75rem);
  font-weight: var(--goa-font-weight-bold, 700);
}

.batch-status-completed { background: #d1fae5; color: #065f46; }
.batch-status-in-progress { background: #fef3c7; color: #b45309; }
.batch-status-completed-with-errors { background: #fef3c7; color: #b45309; }
.batch-status-failed { background: #fee2e2; color: #991b1b; }

.batch-doc-count {
  font-size: var(--goa-font-size-3, 0.8rem);
  color: var(--goa-color-text-secondary, #666);
}

.batch-expand-icon {
  font-size: var(--goa-font-size-2, 0.75rem);
  color: var(--goa-color-text-secondary, #666);
  transition: transform 0.2s;
}

.batch-expanded { transform: rotate(180deg); }

.batch-card-body {
  border-top: 1px solid var(--goa-color-greyscale-200, #dcdcdc);
  padding: var(--goa-space-s) var(--goa-space-m);
  background: var(--goa-color-greyscale-100, #f9f9f9);
}

.loading-inline {
  font-size: var(--goa-font-size-3, 0.8rem);
  color: var(--goa-color-text-secondary, #666);
  padding: var(--goa-space-xs) 0;
}

.batch-docs-table {
  width: 100%;
  border-collapse: collapse;
  font-size: var(--goa-font-size-4, 0.875rem);
}

.batch-docs-table th,
.batch-docs-table td {
  padding: var(--goa-space-2xs) var(--goa-space-xs);
  text-align: left;
  border-bottom: 1px solid var(--goa-color-greyscale-200, #dcdcdc);
}

.batch-docs-table th {
  font-weight: var(--goa-font-weight-bold, 700);
  color: var(--goa-color-text-secondary, #666);
  font-size: var(--goa-font-size-2, 0.75rem);
  text-transform: uppercase;
}

.batch-docs-table tr:last-child td {
  border-bottom: none;
}

.doc-type-badge {
  display: inline-block;
  padding: 1px 6px;
  border-radius: 8px;
  font-size: var(--goa-font-size-2, 0.75rem);
  font-weight: var(--goa-font-weight-bold, 700);
  background: var(--goa-color-greyscale-200, #e5e7eb);
  color: var(--goa-color-text-default, #333);
}

.appeal-link {
  color: var(--goa-color-interactive-default, #0070c4);
  cursor: pointer;
  text-decoration: underline;
}

.appeal-link:hover { color: var(--goa-color-interactive-hover, #004f8a); }

.muted { color: var(--goa-color-text-secondary, #666); }

@media (max-width: 768px) {
  .file-meta-grid {
    grid-template-columns: 1fr;
  }

  .batch-card-header {
    flex-direction: column;
    align-items: flex-start;
    gap: var(--goa-space-xs);
  }

  .batch-card-right {
    width: 100%;
    justify-content: flex-start;
  }
}
</style>
