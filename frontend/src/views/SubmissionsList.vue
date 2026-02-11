<template>
  <div class="submissions-page">
    <div class="page-header">
      <div>
        <h1>Public Submissions</h1>
        <p>Review appeals submitted through the public form</p>
      </div>
    </div>

    <!-- Filter bar -->
    <div class="filter-bar">
      <div class="filter-item">
        <label>Status</label>
        <select class="filter-select" v-model="statusFilter" @change="applyFilter">
          <option value="">All Statuses</option>
          <option value="Pending">Pending</option>
          <option value="Reviewed">Reviewed</option>
          <option value="Converted">Converted</option>
          <option value="Rejected">Rejected</option>
        </select>
      </div>
      <div class="results-count" v-if="!loading">
        {{ total }} submission{{ total !== 1 ? 's' : '' }}
      </div>
    </div>

    <!-- Table -->
    <div class="table-container">
      <table class="submissions-table">
        <thead>
          <tr>
            <th>Reference</th>
            <th>Name</th>
            <th>Settlement</th>
            <th>Issue Type</th>
            <th>Status</th>
            <th>Docs</th>
            <th>Submitted</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="loading">
            <td colspan="8" class="center-text">Loading submissions...</td>
          </tr>
          <tr v-else-if="submissions.length === 0">
            <td colspan="8" class="center-text">No submissions found</td>
          </tr>
          <tr
            v-for="sub in submissions"
            :key="sub.id"
            class="clickable-row"
            @click="openDetail(sub)"
          >
            <td class="ref-number">{{ sub.reference_number }}</td>
            <td>{{ sub.full_name }}</td>
            <td>{{ sub.settlement }}</td>
            <td>{{ sub.issue_type }}</td>
            <td>
              <span class="status-badge" :class="'status-' + sub.status.toLowerCase()">
                {{ sub.status }}
              </span>
            </td>
            <td class="center-text">{{ sub.document_count || 0 }}</td>
            <td>{{ formatDate(sub.created_at) }}</td>
            <td>
              <goa-button type="tertiary" size="compact" @_click.stop="openDetail(sub)">
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

    <!-- Detail / Review Modal -->
    <div v-if="selected" class="modal-overlay" @click.self="closeDetail">
      <div class="modal-content">
        <div class="modal-header">
          <h2>{{ selected.reference_number }}</h2>
          <span class="status-badge" :class="'status-' + selected.status.toLowerCase()">
            {{ selected.status }}
          </span>
          <button class="close-btn" @click="closeDetail">&times;</button>
        </div>

        <div class="detail-grid">
          <div class="detail-item">
            <span class="detail-label">Full Name</span>
            <span>{{ selected.full_name }}</span>
          </div>
          <div class="detail-item" v-if="selected.member_id">
            <span class="detail-label">Member ID</span>
            <span>{{ selected.member_id }}</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">Settlement</span>
            <span>{{ selected.settlement }}</span>
          </div>
          <div class="detail-item" v-if="selected.phone">
            <span class="detail-label">Phone</span>
            <span>{{ selected.phone }}</span>
          </div>
          <div class="detail-item" v-if="selected.email">
            <span class="detail-label">Email</span>
            <span>{{ selected.email }}</span>
          </div>
          <div class="detail-item" v-if="selected.address">
            <span class="detail-label">Address</span>
            <span>{{ selected.address }}</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">Issue Type</span>
            <span>{{ selected.issue_type }}</span>
          </div>
          <div class="detail-item" v-if="selected.decision_date">
            <span class="detail-label">Decision Date</span>
            <span>{{ formatDate(selected.decision_date) }}</span>
          </div>
          <div class="detail-item" v-if="selected.decision_maker">
            <span class="detail-label">Decision Maker</span>
            <span>{{ selected.decision_maker }}</span>
          </div>
          <div class="detail-item" v-if="selected.reviewed_by_name">
            <span class="detail-label">Reviewed By</span>
            <span>{{ selected.reviewed_by_name }} ({{ formatDate(selected.reviewed_at) }})</span>
          </div>
        </div>

        <div class="detail-section">
          <span class="detail-label">Description</span>
          <p class="description-text">{{ selected.description }}</p>
        </div>

        <div v-if="detailDocs.length > 0" class="detail-section">
          <span class="detail-label">Documents ({{ detailDocs.length }})</span>
          <ul class="doc-list">
            <li v-for="doc in detailDocs" :key="doc.id">
              {{ doc.original_name }} ({{ formatFileSize(doc.file_size) }})
            </li>
          </ul>
        </div>

        <div v-if="selected.staff_notes" class="detail-section">
          <span class="detail-label">Staff Notes</span>
          <p class="description-text">{{ selected.staff_notes }}</p>
        </div>

        <!-- Review actions -->
        <div class="review-section">
          <h3>Review</h3>
          <div class="review-form">
            <div class="review-field">
              <label>Update Status</label>
              <select v-model="reviewStatus" class="filter-select">
                <option value="Pending">Pending</option>
                <option value="Reviewed">Reviewed</option>
                <option value="Converted">Converted</option>
                <option value="Rejected">Rejected</option>
              </select>
            </div>
            <div class="review-field">
              <label>Staff Notes</label>
              <textarea v-model="reviewNotes" rows="3" class="review-textarea" placeholder="Add notes about this submission..."></textarea>
            </div>
            <div class="review-actions">
              <goa-button type="primary" @_click="submitReview" :disabled="reviewing">
                {{ reviewing ? 'Saving...' : 'Save Review' }}
              </goa-button>
            </div>
          </div>
          <goa-callout v-if="reviewMsg" :type="reviewSuccess ? 'success' : 'emergency'" class="review-msg">
            {{ reviewMsg }}
          </goa-callout>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import api from '@/services/api.js';

const submissions = ref([]);
const loading = ref(true);
const total = ref(0);
const limit = ref(20);
const offset = ref(0);
const statusFilter = ref('');

const selected = ref(null);
const detailDocs = ref([]);
const reviewStatus = ref('');
const reviewNotes = ref('');
const reviewing = ref(false);
const reviewMsg = ref('');
const reviewSuccess = ref(false);

async function loadSubmissions() {
  loading.value = true;
  try {
    const params = new URLSearchParams();
    params.set('limit', limit.value);
    params.set('offset', offset.value);
    if (statusFilter.value) params.set('status', statusFilter.value);

    const response = await api.get(`/submissions?${params.toString()}`);
    if (response.success) {
      submissions.value = response.data;
      total.value = response.total;
    }
  } catch {
    submissions.value = [];
  } finally {
    loading.value = false;
  }
}

async function openDetail(sub) {
  try {
    const response = await api.get(`/submissions/${sub.id}`);
    if (response.success) {
      selected.value = response.submission;
      detailDocs.value = response.documents || [];
      reviewStatus.value = response.submission.status;
      reviewNotes.value = response.submission.staff_notes || '';
      reviewMsg.value = '';
    }
  } catch {
    selected.value = sub;
    detailDocs.value = [];
    reviewStatus.value = sub.status;
    reviewNotes.value = '';
  }
}

function closeDetail() {
  selected.value = null;
  detailDocs.value = [];
  reviewMsg.value = '';
}

async function submitReview() {
  if (!selected.value) return;
  reviewing.value = true;
  reviewMsg.value = '';
  try {
    const response = await api.patch(`/submissions/${selected.value.id}/review`, {
      status: reviewStatus.value,
      staff_notes: reviewNotes.value || null
    });
    if (response.success) {
      reviewSuccess.value = true;
      reviewMsg.value = `Submission updated to ${response.submission.status}`;
      selected.value = response.submission;
      loadSubmissions();
    }
  } catch (err) {
    reviewSuccess.value = false;
    reviewMsg.value = err.response?.data?.message || 'Failed to update submission';
  } finally {
    reviewing.value = false;
  }
}

function applyFilter() {
  offset.value = 0;
  loadSubmissions();
}

function prevPage() {
  offset.value = Math.max(0, offset.value - limit.value);
  loadSubmissions();
}

function nextPage() {
  offset.value = offset.value + limit.value;
  loadSubmissions();
}

function formatDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString();
}

function formatFileSize(bytes) {
  if (!bytes) return '0 B';
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / 1048576).toFixed(1) + ' MB';
}

onMounted(loadSubmissions);
</script>

<style scoped>
.submissions-page {
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

/* Filter bar */
.filter-bar {
  display: flex;
  align-items: flex-end;
  gap: var(--goa-space-l);
  margin-bottom: var(--goa-space-m);
}

.filter-item label {
  display: block;
  font-size: var(--goa-font-size-3, 0.8rem);
  font-weight: var(--goa-font-weight-bold);
  color: var(--goa-color-text-secondary);
  text-transform: uppercase;
  margin-bottom: var(--goa-space-2xs);
}

.filter-select {
  padding: 8px 12px;
  font-size: var(--goa-font-size-4, 1rem);
  border: 1px solid var(--goa-color-greyscale-400, #999);
  border-radius: var(--goa-border-radius-s, 4px);
  font-family: inherit;
  min-width: 180px;
}

.results-count {
  font-size: var(--goa-font-size-4);
  color: var(--goa-color-text-secondary);
  margin-left: auto;
}

/* Table */
.table-container {
  background: white;
  border: 1px solid var(--goa-color-greyscale-200, #dcdcdc);
  border-radius: var(--goa-border-radius-m, 4px);
  overflow-x: auto;
}

.submissions-table {
  width: 100%;
  border-collapse: collapse;
}

.submissions-table th,
.submissions-table td {
  padding: var(--goa-space-s) var(--goa-space-m);
  text-align: left;
  border-bottom: 1px solid var(--goa-color-greyscale-200, #dcdcdc);
}

.submissions-table th {
  background: var(--goa-color-greyscale-100, #f1f1f1);
  font-weight: var(--goa-font-weight-bold);
  font-size: var(--goa-font-size-4, 0.875rem);
}

.submissions-table tbody tr:hover {
  background: var(--goa-color-greyscale-100, #f9f9f9);
}

.clickable-row { cursor: pointer; }

.ref-number {
  font-family: monospace;
  font-weight: var(--goa-font-weight-bold);
}

.center-text {
  text-align: center;
  padding: var(--goa-space-xl) !important;
  color: var(--goa-color-text-secondary);
}

.status-badge {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 12px;
  font-size: var(--goa-font-size-3, 0.8rem);
  font-weight: var(--goa-font-weight-bold);
}

.status-pending { background: #fef3c7; color: #b45309; }
.status-reviewed { background: #dbeafe; color: #1d4ed8; }
.status-converted { background: #d1fae5; color: #065f46; }
.status-rejected { background: #fee2e2; color: #991b1b; }

/* Pagination */
.pagination {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--goa-space-m);
  margin-top: var(--goa-space-m);
}

.page-info {
  font-size: var(--goa-font-size-4);
  color: var(--goa-color-text-secondary);
}

/* Modal */
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--goa-space-l);
}

.modal-content {
  background: white;
  border-radius: var(--goa-border-radius-m, 4px);
  padding: var(--goa-space-xl);
  max-width: 700px;
  width: 100%;
  max-height: 85vh;
  overflow-y: auto;
}

.modal-header {
  display: flex;
  align-items: center;
  gap: var(--goa-space-m);
  margin-bottom: var(--goa-space-l);
}

.modal-header h2 {
  font-size: var(--goa-font-size-6);
  font-weight: var(--goa-font-weight-bold);
  font-family: monospace;
}

.close-btn {
  margin-left: auto;
  background: none;
  border: none;
  font-size: 1.5rem;
  cursor: pointer;
  color: var(--goa-color-text-secondary);
  padding: 4px 8px;
}

.close-btn:hover {
  color: var(--goa-color-text-default);
}

/* Detail grid */
.detail-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--goa-space-s) var(--goa-space-l);
  margin-bottom: var(--goa-space-l);
}

.detail-item {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.detail-label {
  font-size: var(--goa-font-size-3);
  font-weight: var(--goa-font-weight-bold);
  color: var(--goa-color-text-secondary);
  text-transform: uppercase;
}

.detail-section {
  margin-bottom: var(--goa-space-l);
}

.description-text {
  white-space: pre-wrap;
  background: var(--goa-color-greyscale-100, #f1f1f1);
  padding: var(--goa-space-s);
  border-radius: var(--goa-border-radius-s, 4px);
  margin-top: var(--goa-space-xs);
  max-height: 150px;
  overflow-y: auto;
}

.doc-list {
  list-style: none;
  padding: 0;
  margin-top: var(--goa-space-xs);
}

.doc-list li {
  padding: var(--goa-space-xs) 0;
  border-bottom: 1px solid var(--goa-color-greyscale-100);
}

/* Review section */
.review-section {
  border-top: 2px solid var(--goa-color-greyscale-200);
  padding-top: var(--goa-space-l);
}

.review-section h3 {
  font-size: var(--goa-font-size-5);
  font-weight: var(--goa-font-weight-bold);
  margin-bottom: var(--goa-space-m);
}

.review-form {
  display: flex;
  flex-direction: column;
  gap: var(--goa-space-m);
}

.review-field label {
  display: block;
  font-size: var(--goa-font-size-3);
  font-weight: var(--goa-font-weight-bold);
  color: var(--goa-color-text-secondary);
  text-transform: uppercase;
  margin-bottom: var(--goa-space-2xs);
}

.review-textarea {
  width: 100%;
  padding: 8px 12px;
  font-size: var(--goa-font-size-4, 1rem);
  border: 1px solid var(--goa-color-greyscale-400, #999);
  border-radius: var(--goa-border-radius-s, 4px);
  font-family: inherit;
  resize: vertical;
}

.review-actions {
  display: flex;
  gap: var(--goa-space-m);
}

.review-msg {
  margin-top: var(--goa-space-m);
}

@media (max-width: 768px) {
  .detail-grid {
    grid-template-columns: 1fr;
  }
}
</style>
