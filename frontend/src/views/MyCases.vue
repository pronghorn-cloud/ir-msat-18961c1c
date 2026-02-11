<template>
  <div class="my-cases-page">
    <header class="page-header">
      <h1>My Cases</h1>
      <p>View the status of your appeals with MSAT</p>
    </header>

    <!-- Filters -->
    <div class="filter-bar" v-if="statuses.length > 0">
      <div class="filter-group">
        <label>Status</label>
        <select class="filter-input" v-model="statusFilter" @change="loadCases">
          <option value="">All Statuses</option>
          <option v-for="s in statuses" :key="s" :value="s">{{ s }}</option>
        </select>
      </div>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="loading-msg">Loading your cases...</div>

    <!-- Empty state -->
    <div v-else-if="cases.length === 0 && !noClientLink" class="empty-msg">
      No cases found matching your filters.
    </div>
    <div v-else-if="noClientLink" class="empty-state">
      <div class="empty-icon">&#128196;</div>
      <h2>No Cases Found</h2>
      <p>Your account is not currently linked to any appeal cases. If you believe this is an error, please contact the MSAT office.</p>
      <a href="/contact" @click.prevent="$router.push('/contact')" class="contact-link">Contact MSAT</a>
    </div>

    <!-- Case list -->
    <template v-else>
      <div class="results-bar">
        <span class="results-count">{{ total }} case{{ total !== 1 ? 's' : '' }}</span>
      </div>

      <div class="cases-list">
        <div
          v-for="c in cases"
          :key="c.id"
          class="case-card"
          @click="selectedCase === c.id ? (selectedCase = null) : openDetail(c.id)"
        >
          <div class="card-header">
            <div class="card-file-number">{{ c.file_number }}</div>
            <span class="status-badge" :class="statusClass(c.status)">{{ c.status }}</span>
          </div>
          <div class="card-body">
            <div class="card-meta">
              <span class="meta-item" v-if="c.party_type">
                <strong>Your role:</strong> {{ c.party_type }}
              </span>
              <span class="meta-item" v-if="c.issue_type">
                <strong>Issue:</strong> {{ c.issue_type }}
              </span>
              <span class="meta-item" v-if="c.settlement_name">
                <strong>Settlement:</strong> {{ c.settlement_name }}
              </span>
            </div>
            <div class="card-dates">
              <span v-if="c.contact_date" class="date-item">Filed: {{ formatDate(c.contact_date) }}</span>
              <span v-if="c.closed_date" class="date-item">Closed: {{ formatDate(c.closed_date) }}</span>
            </div>
            <div class="card-extras">
              <span v-if="c.next_hearing" class="next-hearing">
                Next hearing: {{ formatDate(c.next_hearing.hearing_date) }}
                <span v-if="c.next_hearing.hearing_time"> at {{ formatTime(c.next_hearing.hearing_time) }}</span>
                <span v-if="c.next_hearing.location"> &mdash; {{ c.next_hearing.location }}</span>
              </span>
              <span v-else class="no-hearing">No upcoming hearings</span>
              <span class="doc-count" v-if="c.document_count > 0">{{ c.document_count }} document{{ c.document_count !== 1 ? 's' : '' }}</span>
            </div>
          </div>

          <!-- Expanded detail -->
          <div v-if="selectedCase === c.id && detail" class="case-detail" @click.stop>
            <div class="detail-section" v-if="detail.description">
              <h3>Description</h3>
              <p>{{ detail.description }}</p>
            </div>

            <div class="detail-section" v-if="detail.background">
              <h3>Background</h3>
              <p>{{ detail.background }}</p>
            </div>

            <div class="detail-section">
              <h3>Timeline</h3>
              <div class="timeline">
                <div class="timeline-item" v-if="detail.contact_date">
                  <span class="tl-label">Contact Date</span>
                  <span class="tl-date">{{ formatDate(detail.contact_date) }}</span>
                </div>
                <div class="timeline-item" v-if="detail.mediation_date">
                  <span class="tl-label">Mediation</span>
                  <span class="tl-date">{{ formatDate(detail.mediation_date) }}</span>
                </div>
                <div class="timeline-item" v-if="detail.hearing_date">
                  <span class="tl-label">Hearing</span>
                  <span class="tl-date">{{ formatDate(detail.hearing_date) }}</span>
                </div>
                <div class="timeline-item" v-if="detail.closed_date">
                  <span class="tl-label">Closed</span>
                  <span class="tl-date">{{ formatDate(detail.closed_date) }}</span>
                </div>
              </div>
            </div>

            <div class="detail-section" v-if="detail.parties && detail.parties.length > 0">
              <h3>Parties</h3>
              <div class="parties-list">
                <div v-for="(p, idx) in detail.parties" :key="idx" class="party-item">
                  <span class="party-name">{{ p.name }}</span>
                  <span class="party-role">{{ p.party_type || 'Party' }}</span>
                </div>
              </div>
            </div>

            <div class="detail-section" v-if="detail.hearings && detail.hearings.length > 0">
              <h3>Hearings</h3>
              <div class="sub-table">
                <div v-for="h in detail.hearings" :key="h.id" class="sub-row">
                  <span>{{ formatDate(h.hearing_date) }}</span>
                  <span v-if="h.hearing_time">{{ formatTime(h.hearing_time) }}</span>
                  <span>{{ h.hearing_type }}</span>
                  <span v-if="h.location">{{ h.location }}</span>
                  <span v-if="h.outcome" class="outcome-tag" :class="'outcome-' + h.outcome.toLowerCase()">{{ h.outcome }}</span>
                </div>
              </div>
            </div>
            <div class="detail-section empty-detail" v-else>
              <h3>Hearings</h3>
              <p>No hearings scheduled</p>
            </div>

            <div class="detail-section" v-if="detail.documents && detail.documents.length > 0">
              <h3>Documents</h3>
              <div class="sub-table">
                <div v-for="d in detail.documents" :key="d.id" class="sub-row">
                  <span>{{ d.file_name }}</span>
                  <span v-if="d.category">{{ d.category }}</span>
                  <span v-if="d.document_date">{{ formatDate(d.document_date) }}</span>
                </div>
              </div>
            </div>
            <div class="detail-section empty-detail" v-else>
              <h3>Documents</h3>
              <p>No documents</p>
            </div>

            <div class="detail-section" v-if="detail.orders && detail.orders.length > 0">
              <h3>Orders</h3>
              <div class="sub-table">
                <div v-for="o in detail.orders" :key="o.id" class="sub-row">
                  <span class="order-num">Order #{{ o.order_number }}</span>
                  <span>{{ formatDate(o.issue_date) }}</span>
                  <span v-if="o.keyword">{{ o.keyword }}</span>
                  <a v-if="o.document_url" :href="o.document_url" target="_blank" rel="noopener" class="pdf-link">PDF</a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import api from '@/services/api.js';

const cases = ref([]);
const loading = ref(true);
const total = ref(0);
const noClientLink = ref(false);
const statusFilter = ref('');
const statuses = ref([]);

const selectedCase = ref(null);
const detail = ref(null);
const detailLoading = ref(false);

async function loadStatuses() {
  try {
    const res = await api.get('/my-cases/statuses');
    if (res.success) statuses.value = res.data;
  } catch {
    // silent
  }
}

async function loadCases() {
  loading.value = true;
  noClientLink.value = false;
  try {
    const params = new URLSearchParams();
    if (statusFilter.value) params.set('status', statusFilter.value);
    const res = await api.get(`/my-cases?${params.toString()}`);
    if (res.success) {
      cases.value = res.data;
      total.value = res.total;
      if (res.message && res.total === 0) {
        noClientLink.value = true;
      }
    }
  } catch {
    cases.value = [];
  } finally {
    loading.value = false;
  }
}

async function openDetail(caseId) {
  selectedCase.value = caseId;
  detail.value = null;
  detailLoading.value = true;
  try {
    const res = await api.get(`/my-cases/${caseId}`);
    if (res.success) {
      detail.value = res.data;
    }
  } catch {
    detail.value = null;
  } finally {
    detailLoading.value = false;
  }
}

function formatDate(d) {
  if (!d) return '';
  const dt = new Date(d);
  return isNaN(dt.getTime()) ? '' : dt.toLocaleDateString('en-CA');
}

function formatTime(t) {
  if (!t) return '';
  const [h, m] = t.split(':');
  const hour = parseInt(h, 10);
  if (isNaN(hour)) return '';
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  return `${displayHour}:${m} ${ampm}`;
}

function statusClass(status) {
  switch (status) {
    case 'Active': return 'status-active';
    case 'Closed': return 'status-closed';
    case 'Withdrawn': return 'status-withdrawn';
    case 'Order Issued': return 'status-order';
    case 'Conciliation': return 'status-conciliation';
    case 'Conciliated': return 'status-conciliated';
    case 'Mediation': return 'status-mediation';
    case 'Mediated': return 'status-mediated';
    case 'No Jurisdiction': return 'status-nojurisdiction';
    case 'No Merit': return 'status-nomerit';
    default: return '';
  }
}

onMounted(() => {
  loadStatuses();
  loadCases();
});
</script>

<style scoped>
.my-cases-page {
  max-width: 1000px;
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

/* Filter */
.filter-bar {
  margin-bottom: var(--goa-space-m);
}

.filter-group {
  max-width: 250px;
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

/* Loading / Empty */
.loading-msg {
  text-align: center;
  padding: var(--goa-space-xl);
  color: var(--goa-color-text-secondary);
}

.empty-msg {
  text-align: center;
  padding: var(--goa-space-xl);
  color: var(--goa-color-text-secondary);
}

.empty-state {
  text-align: center;
  padding: var(--goa-space-2xl) var(--goa-space-l);
  background: white;
  border: 1px solid var(--goa-color-greyscale-200, #dcdcdc);
  border-radius: var(--goa-border-radius-m, 4px);
}

.empty-icon {
  font-size: 3rem;
  margin-bottom: var(--goa-space-m);
}

.empty-state h2 {
  font-size: var(--goa-font-size-6);
  margin-bottom: var(--goa-space-s);
}

.empty-state p {
  font-size: var(--goa-font-size-4);
  color: var(--goa-color-text-secondary);
  max-width: 500px;
  margin: 0 auto var(--goa-space-m);
}

.contact-link {
  display: inline-block;
  padding: 8px 20px;
  background: var(--goa-color-interactive-default, #0070c4);
  color: white;
  border-radius: var(--goa-border-radius-s, 4px);
  text-decoration: none;
  font-weight: var(--goa-font-weight-bold);
}

.contact-link:hover {
  background: var(--goa-color-interactive-hover, #004f8a);
}

/* Results bar */
.results-bar {
  margin-bottom: var(--goa-space-s);
}

.results-count {
  font-size: var(--goa-font-size-4);
  color: var(--goa-color-text-secondary);
}

/* Case cards */
.cases-list {
  display: flex;
  flex-direction: column;
  gap: var(--goa-space-s);
}

.case-card {
  background: white;
  border: 1px solid var(--goa-color-greyscale-200, #dcdcdc);
  border-radius: var(--goa-border-radius-m, 4px);
  cursor: pointer;
  transition: box-shadow 0.2s;
}

.case-card:hover {
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--goa-space-m) var(--goa-space-l);
  border-bottom: 1px solid var(--goa-color-greyscale-100, #f1f1f1);
}

.card-file-number {
  font-size: var(--goa-font-size-5, 1.1rem);
  font-weight: var(--goa-font-weight-bold);
  font-family: monospace;
}

/* Status badges */
.status-badge {
  display: inline-block;
  padding: 3px 10px;
  border-radius: 12px;
  font-size: var(--goa-font-size-3, 0.8rem);
  font-weight: var(--goa-font-weight-bold);
}

.status-active { background: #d1fae5; color: #065f46; }
.status-closed { background: #e5e7eb; color: #374151; }
.status-withdrawn { background: #fee2e2; color: #dc2626; }
.status-order { background: #ede9fe; color: #6d28d9; }
.status-conciliation { background: #dbeafe; color: #1d4ed8; }
.status-conciliated { background: #d1fae5; color: #065f46; }
.status-mediation { background: #fef3c7; color: #b45309; }
.status-mediated { background: #d1fae5; color: #065f46; }
.status-nojurisdiction { background: #e5e7eb; color: #374151; }
.status-nomerit { background: #e5e7eb; color: #374151; }

/* Card body */
.card-body {
  padding: var(--goa-space-s) var(--goa-space-l) var(--goa-space-m);
}

.card-meta {
  display: flex;
  gap: var(--goa-space-l);
  flex-wrap: wrap;
  margin-bottom: var(--goa-space-xs);
  font-size: var(--goa-font-size-4);
}

.card-dates {
  display: flex;
  gap: var(--goa-space-l);
  margin-bottom: var(--goa-space-xs);
}

.date-item {
  font-size: var(--goa-font-size-3);
  color: var(--goa-color-text-secondary);
}

.card-extras {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: var(--goa-font-size-3);
}

.next-hearing {
  color: #059669;
  font-weight: var(--goa-font-weight-bold);
}

.no-hearing {
  color: var(--goa-color-text-secondary);
}

.doc-count {
  color: var(--goa-color-text-secondary);
}

/* Detail panel */
.case-detail {
  border-top: 2px solid var(--goa-color-interactive-default, #0070c4);
  padding: var(--goa-space-l);
  background: var(--goa-color-greyscale-100, #f9f9f9);
  cursor: default;
}

.detail-section {
  margin-bottom: var(--goa-space-m);
}

.detail-section:last-child {
  margin-bottom: 0;
}

.detail-section h3 {
  font-size: var(--goa-font-size-4);
  font-weight: var(--goa-font-weight-bold);
  color: var(--goa-color-text-default);
  margin-bottom: var(--goa-space-xs);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.detail-section p {
  font-size: var(--goa-font-size-4);
  color: var(--goa-color-text-default);
  line-height: 1.5;
}

.empty-detail p {
  color: var(--goa-color-text-secondary);
  font-style: italic;
}

/* Timeline */
.timeline {
  display: flex;
  gap: var(--goa-space-l);
  flex-wrap: wrap;
}

.timeline-item {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.tl-label {
  font-size: var(--goa-font-size-2, 0.7rem);
  color: var(--goa-color-text-secondary);
  text-transform: uppercase;
}

.tl-date {
  font-size: var(--goa-font-size-4);
  font-weight: var(--goa-font-weight-bold);
}

/* Parties */
.parties-list {
  display: flex;
  flex-direction: column;
  gap: var(--goa-space-xs);
}

.party-item {
  display: flex;
  justify-content: space-between;
  padding: var(--goa-space-xs) var(--goa-space-s);
  background: white;
  border-radius: var(--goa-border-radius-s, 4px);
}

.party-name {
  font-size: var(--goa-font-size-4);
}

.party-role {
  font-size: var(--goa-font-size-3);
  color: var(--goa-color-text-secondary);
}

/* Sub-tables (hearings, docs, orders) */
.sub-table {
  display: flex;
  flex-direction: column;
  gap: var(--goa-space-xs);
}

.sub-row {
  display: flex;
  gap: var(--goa-space-m);
  align-items: center;
  padding: var(--goa-space-xs) var(--goa-space-s);
  background: white;
  border-radius: var(--goa-border-radius-s, 4px);
  font-size: var(--goa-font-size-4);
  flex-wrap: wrap;
}

.order-num {
  font-family: monospace;
  font-weight: var(--goa-font-weight-bold);
}

.outcome-tag {
  padding: 1px 6px;
  border-radius: 8px;
  font-size: var(--goa-font-size-2, 0.7rem);
  font-weight: var(--goa-font-weight-bold);
}

.outcome-completed { background: #d1fae5; color: #065f46; }
.outcome-resolved { background: #d1fae5; color: #065f46; }
.outcome-adjourned { background: #fef3c7; color: #b45309; }
.outcome-cancelled { background: #fee2e2; color: #dc2626; }
.outcome-unresolved { background: #e0e7ff; color: #4338ca; }

.pdf-link {
  display: inline-block;
  padding: 2px 8px;
  background: #dc2626;
  color: white;
  border-radius: 4px;
  text-decoration: none;
  font-size: var(--goa-font-size-2);
  font-weight: var(--goa-font-weight-bold);
}

.pdf-link:hover {
  background: #b91c1c;
}

@media (max-width: 768px) {
  .card-meta {
    flex-direction: column;
    gap: var(--goa-space-xs);
  }

  .card-dates {
    flex-direction: column;
    gap: var(--goa-space-xs);
  }

  .card-extras {
    flex-direction: column;
    align-items: flex-start;
    gap: var(--goa-space-xs);
  }

  .timeline {
    flex-direction: column;
    gap: var(--goa-space-s);
  }
}
</style>
