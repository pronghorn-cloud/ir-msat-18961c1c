<template>
  <div class="hearings-page">
    <header class="page-header">
      <h1>Hearing Schedule</h1>
      <p>View upcoming MSAT tribunal hearings and mediations</p>
    </header>

    <!-- Filters -->
    <div class="filter-panel">
      <div class="filter-row">
        <div class="filter-group">
          <label>Month</label>
          <select class="filter-input" v-model="monthFilter" @change="applyFilters">
            <option value="">All Months</option>
            <option v-for="m in months" :key="m.value" :value="m.value">{{ m.label }}</option>
          </select>
        </div>
        <div class="filter-group">
          <label>Location</label>
          <select class="filter-input" v-model="locationFilter" @change="applyFilters">
            <option value="">All Locations</option>
            <option v-for="loc in locations" :key="loc" :value="loc">{{ loc }}</option>
          </select>
        </div>
        <div class="filter-group">
          <label>Type</label>
          <select class="filter-input" v-model="typeFilter" @change="applyFilters">
            <option value="">All Types</option>
            <option value="Oral">Oral Hearing</option>
            <option value="Mediation">Mediation</option>
          </select>
        </div>
        <div class="filter-group">
          <label class="checkbox-label">
            <input type="checkbox" v-model="showPast" @change="applyFilters" />
            Show past hearings
          </label>
        </div>
        <div class="filter-actions" v-if="hasActiveFilters">
          <button class="clear-btn" @click="clearFilters">Clear Filters</button>
        </div>
      </div>
    </div>

    <!-- Results summary -->
    <div class="results-bar" v-if="!loading">
      <span class="results-count">{{ total }} hearing{{ total !== 1 ? 's' : '' }} found</span>
    </div>

    <!-- Hearing cards -->
    <div v-if="loading" class="loading-msg">Loading hearings...</div>
    <div v-else-if="hearings.length === 0" class="empty-msg">No hearings found</div>
    <div v-else class="hearings-list">
      <div
        v-for="h in hearings"
        :key="h.id"
        class="hearing-card"
        :class="{ 'past-hearing': isPast(h.hearing_date) }"
      >
        <div class="card-date-col">
          <div class="date-day">{{ formatDay(h.hearing_date) }}</div>
          <div class="date-month">{{ formatMonth(h.hearing_date) }}</div>
          <div class="date-year">{{ formatYear(h.hearing_date) }}</div>
        </div>
        <div class="card-details">
          <div class="card-top-row">
            <span class="type-badge" :class="h.hearing_type === 'Oral' ? 'badge-oral' : 'badge-mediation'">
              {{ h.hearing_type }}
            </span>
            <span v-if="h.outcome" class="outcome-badge" :class="outcomeClass(h.outcome)">
              {{ h.outcome }}
            </span>
            <span v-else-if="!isPast(h.hearing_date)" class="status-upcoming">Upcoming</span>
          </div>
          <div class="card-info">
            <div class="info-row" v-if="h.hearing_time">
              <span class="info-icon">&#128337;</span>
              <span>{{ formatTime(h.hearing_time) }}</span>
            </div>
            <div class="info-row" v-if="h.location">
              <span class="info-icon">&#128205;</span>
              <span>{{ h.location }}</span>
            </div>
            <div class="info-row" v-if="h.file_number">
              <span class="info-icon">&#128196;</span>
              <span>Appeal {{ h.file_number }}</span>
              <span v-if="h.settlement_name" class="settlement-tag">{{ h.settlement_name }}</span>
            </div>
            <div class="info-row notes" v-if="h.notes">
              <span class="info-icon">&#128221;</span>
              <span>{{ h.notes }}</span>
            </div>
          </div>
        </div>
      </div>
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

const hearings = ref([]);
const loading = ref(true);
const total = ref(0);
const limit = ref(20);
const offset = ref(0);

const monthFilter = ref('');
const locationFilter = ref('');
const typeFilter = ref('');
const showPast = ref(false);

const months = ref([]);
const locations = ref([]);

const hasActiveFilters = computed(() => {
  return monthFilter.value || locationFilter.value || typeFilter.value || showPast.value;
});

async function loadFilters() {
  try {
    const [monthRes, locRes] = await Promise.all([
      api.get('/public/hearings/months'),
      api.get('/public/hearings/locations')
    ]);
    if (monthRes.success) months.value = monthRes.data;
    if (locRes.success) locations.value = locRes.data;
  } catch {
    // silent
  }
}

async function loadHearings() {
  loading.value = true;
  try {
    const params = new URLSearchParams();
    params.set('limit', limit.value);
    params.set('offset', offset.value);
    if (monthFilter.value) params.set('month', monthFilter.value);
    if (locationFilter.value) params.set('location', locationFilter.value);
    if (typeFilter.value) params.set('type', typeFilter.value);
    if (showPast.value) params.set('show_past', 'true');

    const response = await api.get(`/public/hearings?${params.toString()}`);
    if (response.success) {
      hearings.value = response.data;
      total.value = response.total;
    }
  } catch {
    hearings.value = [];
  } finally {
    loading.value = false;
  }
}

function applyFilters() {
  offset.value = 0;
  loadHearings();
}

function clearFilters() {
  monthFilter.value = '';
  locationFilter.value = '';
  typeFilter.value = '';
  showPast.value = false;
  offset.value = 0;
  loadHearings();
}

function prevPage() {
  offset.value = Math.max(0, offset.value - limit.value);
  loadHearings();
}

function nextPage() {
  offset.value = offset.value + limit.value;
  loadHearings();
}

function toDate(d) {
  if (!d) return null;
  const dt = new Date(d);
  return isNaN(dt.getTime()) ? null : dt;
}

function isPast(dateStr) {
  const dt = toDate(dateStr);
  if (!dt) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return dt < today;
}

function formatDay(d) {
  const dt = toDate(d);
  return dt ? dt.getUTCDate() : '';
}

function formatMonth(d) {
  const dt = toDate(d);
  if (!dt) return '';
  const months = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
  return months[dt.getUTCMonth()];
}

function formatYear(d) {
  const dt = toDate(d);
  return dt ? dt.getUTCFullYear() : '';
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

function outcomeClass(outcome) {
  switch (outcome) {
    case 'Completed': return 'outcome-completed';
    case 'Resolved': return 'outcome-resolved';
    case 'Adjourned': return 'outcome-adjourned';
    case 'Cancelled': return 'outcome-cancelled';
    case 'Unresolved': return 'outcome-unresolved';
    default: return '';
  }
}

onMounted(() => {
  loadFilters();
  loadHearings();
});
</script>

<style scoped>
.hearings-page {
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

/* Filter panel */
.filter-panel {
  background: white;
  border: 1px solid var(--goa-color-greyscale-200, #dcdcdc);
  border-radius: var(--goa-border-radius-m, 4px);
  padding: var(--goa-space-l);
  margin-bottom: var(--goa-space-m);
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

.checkbox-label {
  display: flex !important;
  align-items: center;
  gap: var(--goa-space-xs);
  text-transform: none !important;
  font-weight: normal !important;
  cursor: pointer;
  padding-top: var(--goa-space-m);
}

.checkbox-label input[type="checkbox"] {
  width: 16px;
  height: 16px;
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

/* Results bar */
.results-bar {
  margin-bottom: var(--goa-space-s);
}

.results-count {
  font-size: var(--goa-font-size-4);
  color: var(--goa-color-text-secondary);
}

/* Loading / empty */
.loading-msg,
.empty-msg {
  text-align: center;
  padding: var(--goa-space-xl);
  color: var(--goa-color-text-secondary);
  font-size: var(--goa-font-size-4);
}

/* Hearing cards */
.hearings-list {
  display: flex;
  flex-direction: column;
  gap: var(--goa-space-s);
}

.hearing-card {
  display: flex;
  background: white;
  border: 1px solid var(--goa-color-greyscale-200, #dcdcdc);
  border-radius: var(--goa-border-radius-m, 4px);
  overflow: hidden;
  transition: box-shadow 0.2s;
}

.hearing-card:hover {
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
}

.hearing-card.past-hearing {
  opacity: 0.7;
}

.card-date-col {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: var(--goa-space-m);
  min-width: 80px;
  background: var(--goa-color-interactive-default, #0070c4);
  color: white;
}

.date-day {
  font-size: 1.75rem;
  font-weight: var(--goa-font-weight-bold);
  line-height: 1;
}

.date-month {
  font-size: var(--goa-font-size-3, 0.8rem);
  font-weight: var(--goa-font-weight-bold);
  letter-spacing: 1px;
}

.date-year {
  font-size: var(--goa-font-size-2, 0.7rem);
  opacity: 0.85;
}

.card-details {
  flex: 1;
  padding: var(--goa-space-m) var(--goa-space-l);
}

.card-top-row {
  display: flex;
  gap: var(--goa-space-s);
  align-items: center;
  margin-bottom: var(--goa-space-s);
}

/* Badges */
.type-badge {
  display: inline-block;
  padding: 2px 10px;
  border-radius: 12px;
  font-size: var(--goa-font-size-3, 0.8rem);
  font-weight: var(--goa-font-weight-bold);
}

.badge-oral {
  background: #dbeafe;
  color: #1d4ed8;
}

.badge-mediation {
  background: #fef3c7;
  color: #b45309;
}

.status-upcoming {
  font-size: var(--goa-font-size-3, 0.8rem);
  color: #059669;
  font-weight: var(--goa-font-weight-bold);
}

.outcome-badge {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 12px;
  font-size: var(--goa-font-size-2, 0.7rem);
  font-weight: var(--goa-font-weight-bold);
}

.outcome-completed {
  background: #d1fae5;
  color: #065f46;
}

.outcome-resolved {
  background: #d1fae5;
  color: #065f46;
}

.outcome-adjourned {
  background: #fef3c7;
  color: #b45309;
}

.outcome-cancelled {
  background: #fee2e2;
  color: #dc2626;
}

.outcome-unresolved {
  background: #e0e7ff;
  color: #4338ca;
}

/* Info rows */
.card-info {
  display: flex;
  flex-direction: column;
  gap: var(--goa-space-xs);
}

.info-row {
  display: flex;
  align-items: center;
  gap: var(--goa-space-xs);
  font-size: var(--goa-font-size-4);
  color: var(--goa-color-text-default);
}

.info-row.notes {
  color: var(--goa-color-text-secondary);
  font-style: italic;
  font-size: var(--goa-font-size-3);
}

.info-icon {
  width: 20px;
  text-align: center;
  flex-shrink: 0;
}

.settlement-tag {
  display: inline-block;
  margin-left: var(--goa-space-xs);
  padding: 1px 6px;
  background: var(--goa-color-greyscale-100, #f1f1f1);
  border-radius: 8px;
  font-size: var(--goa-font-size-2, 0.7rem);
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

  .hearing-card {
    flex-direction: column;
  }

  .card-date-col {
    flex-direction: row;
    gap: var(--goa-space-xs);
    min-width: unset;
    padding: var(--goa-space-s) var(--goa-space-m);
  }
}
</style>
