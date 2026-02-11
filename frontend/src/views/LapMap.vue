<template>
  <div class="lap-map">
    <div class="page-header">
      <div class="header-row">
        <div>
          <h1>Land Access Map</h1>
          <p>Visualize oil and gas access records across Metis Settlement lands</p>
        </div>
        <router-link to="/lap" class="back-link">
          <goa-button type="tertiary" size="compact">Back to Applications</goa-button>
        </router-link>
      </div>
    </div>

    <goa-callout v-if="errorMsg" type="emergency" heading="Error">
      {{ errorMsg }}
    </goa-callout>

    <!-- Filters -->
    <div class="filters-bar">
      <div class="filter-group">
        <label>Settlement:</label>
        <select v-model="filterSettlement" @change="loadMapData" class="filter-select">
          <option value="">All Settlements</option>
          <option v-for="s in settlementOptions" :key="s.settlement" :value="s.settlement">
            {{ s.settlement }} ({{ s.count }})
          </option>
        </select>
      </div>
      <div class="filter-group">
        <label>Project Type:</label>
        <select v-model="filterProjectType" @change="loadMapData" class="filter-select">
          <option value="">All Types</option>
          <option v-for="pt in projectTypeOptions" :key="pt.project_type" :value="pt.project_type">
            {{ pt.project_type }} ({{ pt.count }})
          </option>
        </select>
      </div>
      <div class="filter-group">
        <label>Operator:</label>
        <input type="text" v-model="filterOperator" placeholder="Search operator..."
          class="filter-input" @keyup.enter="loadMapData" />
        <button class="search-btn" @click="loadMapData">Search</button>
      </div>
      <span v-if="filterSettlement || filterProjectType || filterOperator"
        class="clear-link" @click="clearFilters">Clear filters</span>
    </div>

    <!-- Summary -->
    <div class="summary-bar">
      <span>{{ totalRecords }} access records across {{ mapData.length }} settlements</span>
    </div>

    <!-- Map Container -->
    <div class="map-wrapper">
      <div ref="mapContainer" class="map-container"></div>
    </div>

    <!-- Legend -->
    <div class="legend">
      <strong>Status Legend:</strong>
      <span class="legend-item"><span class="dot dot-active"></span> Active</span>
      <span class="legend-item"><span class="dot dot-terminated"></span> Terminated</span>
      <span class="legend-item"><span class="dot dot-pending"></span> Pending</span>
      <span class="legend-item"><span class="dot dot-withdrawn"></span> Withdrawn</span>
      <span class="legend-item"><span class="dot dot-closed"></span> Closed</span>
      <span class="legend-item"><span class="dot dot-other"></span> Other</span>
    </div>

    <!-- Settlement Details Table -->
    <div v-if="selectedSettlement" class="detail-panel">
      <div class="detail-header">
        <h3>{{ selectedSettlement.settlement }}</h3>
        <span class="detail-count">{{ selectedSettlement.total }} records</span>
        <button class="close-btn" @click="selectedSettlement = null">&times;</button>
      </div>
      <div class="status-summary">
        <span v-for="(count, status) in selectedSettlement.statuses" :key="status" class="status-chip"
          :class="statusChipClass(status)">
          {{ status || 'Unknown' }}: {{ count }}
        </span>
      </div>
      <table class="detail-table">
        <thead>
          <tr>
            <th>Operator</th>
            <th>Project Type</th>
            <th>Status</th>
            <th>Wellsite Legal</th>
            <th>REO</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="r in selectedSettlement.records" :key="r.id">
            <td>{{ r.operator || '—' }}</td>
            <td>{{ r.project_type || '—' }}</td>
            <td><span class="status-badge" :class="statusBadgeClass(r.status)">{{ r.status || '—' }}</span></td>
            <td class="mono">{{ r.wellsite_legal || '—' }}</td>
            <td class="mono">{{ r.reo || '—' }}</td>
          </tr>
        </tbody>
      </table>
      <p v-if="selectedSettlement.records.length >= 10" class="more-text">
        Showing first 10 records. Use the Applications page for full access.
      </p>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount, nextTick } from 'vue';
import api from '@/services/api.js';
import L from 'leaflet';

const mapContainer = ref(null);
let map = null;
let markerLayer = null;

const mapData = ref([]);
const totalRecords = ref(0);
const errorMsg = ref('');
const loading = ref(false);
const selectedSettlement = ref(null);

// Filter state
const filterSettlement = ref('');
const filterProjectType = ref('');
const filterOperator = ref('');
const settlementOptions = ref([]);
const projectTypeOptions = ref([]);

// Status color mapping
const STATUS_COLORS = {
  'Active': '#059669',
  'Terminated': '#dc2626',
  'Pending': '#d97706',
  'Withdrawn': '#6b7280',
  'Closed': '#374151',
  'No file': '#ea580c'
};

function getStatusColor(status) {
  return STATUS_COLORS[status] || '#9ca3af';
}

function statusChipClass(status) {
  const map = {
    'Active': 'chip-active', 'Terminated': 'chip-terminated',
    'Pending': 'chip-pending', 'Withdrawn': 'chip-withdrawn',
    'Closed': 'chip-closed', 'No file': 'chip-other'
  };
  return map[status] || 'chip-other';
}

function statusBadgeClass(status) {
  const map = {
    'Active': 'badge-active', 'Terminated': 'badge-terminated',
    'Pending': 'badge-pending', 'Withdrawn': 'badge-withdrawn',
    'Closed': 'badge-closed'
  };
  return map[status] || 'badge-other';
}

function getDominantStatus(statuses) {
  let max = 0, dominant = 'Active';
  Object.entries(statuses).forEach(([status, count]) => {
    if (count > max) { max = count; dominant = status; }
  });
  return dominant;
}

function initMap() {
  if (!mapContainer.value) return;

  map = L.map(mapContainer.value, {
    center: [55.0, -114.0],
    zoom: 6,
    minZoom: 5,
    maxZoom: 12
  });

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxZoom: 18
  }).addTo(map);

  markerLayer = L.layerGroup().addTo(map);
}

function updateMarkers() {
  if (!markerLayer) return;
  markerLayer.clearLayers();

  mapData.value.forEach(s => {
    const dominant = getDominantStatus(s.statuses);
    const color = getStatusColor(dominant);
    const radius = Math.max(12, Math.min(30, 10 + Math.sqrt(s.total) * 3));

    const marker = L.circleMarker([s.lat, s.lng], {
      radius,
      fillColor: color,
      color: '#ffffff',
      weight: 2,
      opacity: 1,
      fillOpacity: 0.75
    }).addTo(markerLayer);

    // Settlement label
    const label = L.tooltip({
      permanent: true,
      direction: 'top',
      offset: [0, -radius],
      className: 'settlement-label'
    }).setContent(`<strong>${s.settlement.replace(' Metis Settlement', '')}</strong><br>${s.total} records`);

    marker.bindTooltip(label);

    // Click handler — show detail
    marker.on('click', () => {
      selectedSettlement.value = s;
    });

    // Popup on hover
    const statusLines = Object.entries(s.statuses)
      .map(([st, c]) => `<span style="color:${getStatusColor(st)}">\u25CF</span> ${st || 'Unknown'}: ${c}`)
      .join('<br>');

    marker.bindPopup(`
      <div style="min-width:160px">
        <strong>${s.settlement}</strong><br>
        <em>${s.total} total records</em><hr style="margin:4px 0">
        ${statusLines}
      </div>
    `);
  });

  // Fit bounds if there are markers
  if (mapData.value.length > 0) {
    const bounds = L.latLngBounds(mapData.value.map(s => [s.lat, s.lng]));
    map.fitBounds(bounds, { padding: [50, 50], maxZoom: 8 });
  }
}

async function loadMapData() {
  loading.value = true;
  errorMsg.value = '';
  try {
    const params = {};
    if (filterSettlement.value) params.settlement = filterSettlement.value;
    if (filterProjectType.value) params.project_type = filterProjectType.value;
    if (filterOperator.value.trim()) params.operator = filterOperator.value.trim();

    const r = await api.get('/lap/map-data', { params });
    if (r.success) {
      mapData.value = r.data;
      totalRecords.value = r.total;
      selectedSettlement.value = null;
      updateMarkers();
    }
  } catch (err) {
    errorMsg.value = err.response?.data?.message || 'Failed to load map data';
  } finally {
    loading.value = false;
  }
}

async function loadFilterOptions() {
  try {
    const [sRes, ptRes] = await Promise.all([
      api.get('/lap/access-records/settlements'),
      api.get('/lap/access-records/project-types')
    ]);
    if (sRes.success) settlementOptions.value = sRes.data;
    if (ptRes.success) projectTypeOptions.value = ptRes.data;
  } catch { /* ignore */ }
}

function clearFilters() {
  filterSettlement.value = '';
  filterProjectType.value = '';
  filterOperator.value = '';
  loadMapData();
}

onMounted(async () => {
  await nextTick();
  initMap();
  await Promise.all([loadFilterOptions(), loadMapData()]);
});

onBeforeUnmount(() => {
  if (map) {
    map.remove();
    map = null;
  }
});
</script>

<style scoped>
@import 'leaflet/dist/leaflet.css';

.lap-map {
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

.page-header h1 {
  font-size: var(--goa-font-size-8, 1.75rem);
  margin-bottom: var(--goa-space-xs);
}

.page-header p {
  color: var(--goa-color-text-secondary, #666);
}

.back-link {
  text-decoration: none;
}

.filters-bar {
  display: flex;
  align-items: center;
  gap: var(--goa-space-m);
  flex-wrap: wrap;
  margin-bottom: var(--goa-space-m);
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

.filter-select,
.filter-input {
  padding: 6px 12px;
  border: 1px solid var(--goa-color-greyscale-200, #dcdcdc);
  border-radius: var(--goa-border-radius-m, 4px);
  font-size: var(--goa-font-size-4, 0.875rem);
}

.filter-input { width: 180px; }

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

.clear-link {
  color: var(--goa-color-interactive-default, #0070c4);
  cursor: pointer;
  text-decoration: underline;
  font-size: var(--goa-font-size-4, 0.875rem);
}

.summary-bar {
  margin-bottom: var(--goa-space-s);
  font-size: var(--goa-font-size-4, 0.875rem);
  color: var(--goa-color-text-secondary, #666);
}

.map-wrapper {
  border: 1px solid var(--goa-color-greyscale-200, #dcdcdc);
  border-radius: var(--goa-border-radius-m, 4px);
  overflow: hidden;
  margin-bottom: var(--goa-space-m);
}

.map-container {
  width: 100%;
  height: 520px;
}

/* Legend */
.legend {
  display: flex;
  align-items: center;
  gap: var(--goa-space-m);
  flex-wrap: wrap;
  padding: var(--goa-space-s) var(--goa-space-m);
  background: var(--goa-color-greyscale-100, #f1f1f1);
  border-radius: var(--goa-border-radius-m, 4px);
  font-size: var(--goa-font-size-4, 0.875rem);
  margin-bottom: var(--goa-space-m);
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 4px;
}

.dot {
  display: inline-block;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  border: 1px solid rgba(0,0,0,0.2);
}

.dot-active { background: #059669; }
.dot-terminated { background: #dc2626; }
.dot-pending { background: #d97706; }
.dot-withdrawn { background: #6b7280; }
.dot-closed { background: #374151; }
.dot-other { background: #ea580c; }

/* Detail panel */
.detail-panel {
  background: white;
  border: 1px solid var(--goa-color-greyscale-200, #dcdcdc);
  border-radius: var(--goa-border-radius-m, 4px);
  padding: var(--goa-space-l);
}

.detail-header {
  display: flex;
  align-items: center;
  gap: var(--goa-space-m);
  margin-bottom: var(--goa-space-s);
}

.detail-header h3 {
  font-size: var(--goa-font-size-6, 1.25rem);
  margin: 0;
}

.detail-count {
  color: var(--goa-color-text-secondary, #666);
  font-size: var(--goa-font-size-4, 0.875rem);
}

.close-btn {
  margin-left: auto;
  background: none;
  border: none;
  font-size: 1.5rem;
  cursor: pointer;
  color: var(--goa-color-text-secondary, #666);
  line-height: 1;
}

.close-btn:hover { color: #333; }

.status-summary {
  display: flex;
  gap: var(--goa-space-xs);
  flex-wrap: wrap;
  margin-bottom: var(--goa-space-m);
}

.status-chip {
  padding: 2px 10px;
  border-radius: 12px;
  font-size: var(--goa-font-size-3, 0.8rem);
  font-weight: 600;
}

.chip-active { background: #d1fae5; color: #065f46; }
.chip-terminated { background: #fee2e2; color: #991b1b; }
.chip-pending { background: #fef3c7; color: #b45309; }
.chip-withdrawn { background: #e5e7eb; color: #374151; }
.chip-closed { background: #d1d5db; color: #1f2937; }
.chip-other { background: #ffedd5; color: #c2410c; }

.detail-table {
  width: 100%;
  border-collapse: collapse;
  font-size: var(--goa-font-size-4, 0.875rem);
}

.detail-table th,
.detail-table td {
  padding: var(--goa-space-xs) var(--goa-space-s);
  text-align: left;
  border-bottom: 1px solid var(--goa-color-greyscale-200, #dcdcdc);
}

.detail-table th {
  background: var(--goa-color-greyscale-100, #f1f1f1);
  font-weight: 700;
}

.status-badge {
  display: inline-block;
  padding: 1px 6px;
  border-radius: 10px;
  font-size: var(--goa-font-size-3, 0.8rem);
  font-weight: 600;
}

.badge-active { background: #d1fae5; color: #065f46; }
.badge-terminated { background: #fee2e2; color: #991b1b; }
.badge-pending { background: #fef3c7; color: #b45309; }
.badge-withdrawn { background: #e5e7eb; color: #374151; }
.badge-closed { background: #d1d5db; color: #1f2937; }
.badge-other { background: #f3f4f6; color: #6b7280; }

.mono { font-family: monospace; font-size: var(--goa-font-size-3, 0.8rem); }

.more-text {
  margin-top: var(--goa-space-s);
  color: var(--goa-color-text-secondary, #666);
  font-style: italic;
  font-size: var(--goa-font-size-4, 0.875rem);
}
</style>
