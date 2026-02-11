<template>
  <div class="appeal-new">
    <div class="page-header">
      <h1>New Appeal</h1>
      <p>Create a new appeal case</p>
    </div>

    <goa-callout v-if="errorMsg" type="emergency" heading="Error">
      {{ errorMsg }}
    </goa-callout>

    <div class="form-container">
      <div class="form-grid">
        <!-- Settlement -->
        <goa-form-item label="Settlement" :error="errors.settlement_id" class="form-field">
          <goa-dropdown
            name="settlement"
            :value="form.settlement_id"
            @_change="(e) => form.settlement_id = e.detail.value"
            width="100%"
            placeholder="Select settlement"
          >
            <goa-dropdown-item
              v-for="s in settlements"
              :key="s.id"
              :value="s.id"
              :label="s.name"
            />
          </goa-dropdown>
        </goa-form-item>

        <!-- Issue Type -->
        <goa-form-item label="Issue Type" :error="errors.issue_type" class="form-field">
          <goa-dropdown
            name="issue_type"
            :value="form.issue_type"
            @_change="(e) => form.issue_type = e.detail.value"
            width="100%"
            placeholder="Select issue type"
          >
            <goa-dropdown-item
              v-for="t in issueTypes"
              :key="t.code"
              :value="t.name"
              :label="t.name"
            />
          </goa-dropdown>
        </goa-form-item>

        <!-- Assigned Staff -->
        <goa-form-item label="Assigned Staff" :error="errors.primary_staff" class="form-field">
          <goa-dropdown
            name="primary_staff"
            :value="form.primary_staff"
            @_change="(e) => form.primary_staff = e.detail.value"
            width="100%"
            placeholder="Select staff"
          >
            <goa-dropdown-item
              v-for="s in staffList"
              :key="s.id"
              :value="`${s.first_name} ${s.last_name}`"
              :label="`${s.first_name} ${s.last_name}`"
            />
          </goa-dropdown>
        </goa-form-item>
      </div>

      <!-- Appellant Search -->
      <goa-form-item label="Appellant" :error="errors.appellant_id" class="form-field-full">
        <div class="client-search">
          <goa-input
            name="client_search"
            :value="clientSearch"
            @_change="(e) => { clientSearch = e.detail.value; searchClients(); }"
            width="100%"
            placeholder="Search by name (min 2 characters)..."
          />
          <div v-if="clientResults.length > 0 && !selectedClient" class="search-results">
            <div
              v-for="c in clientResults"
              :key="c.id"
              class="search-result-item"
              @click="selectClient(c)"
            >
              <strong>{{ c.first_name }} {{ c.last_name }}</strong>
              <span v-if="c.email" class="client-detail"> — {{ c.email }}</span>
              <span v-if="c.settlement" class="client-detail"> | {{ c.settlement }}</span>
            </div>
          </div>
          <div v-if="selectedClient" class="selected-client">
            <span>{{ selectedClient.first_name }} {{ selectedClient.last_name }}</span>
            <span v-if="selectedClient.email"> — {{ selectedClient.email }}</span>
            <goa-button type="tertiary" size="compact" @_click="clearClient">
              Clear
            </goa-button>
          </div>
        </div>
      </goa-form-item>

      <!-- Description -->
      <goa-form-item label="Description" :error="errors.description" class="form-field-full">
        <goa-textarea
          name="description"
          :value="form.description"
          @_change="(e) => form.description = e.detail.value"
          width="100%"
          rows="4"
          placeholder="Describe the appeal..."
        />
        <span class="char-count">{{ (form.description || '').length }}/2000</span>
      </goa-form-item>

      <!-- Legal Description -->
      <goa-form-item label="Legal Description (Optional)" class="form-field-full">
        <goa-textarea
          name="legal_description"
          :value="form.legal_description"
          @_change="(e) => form.legal_description = e.detail.value"
          width="100%"
          rows="2"
          placeholder="Legal land description..."
        />
      </goa-form-item>

      <!-- Actions -->
      <div class="form-actions">
        <goa-button type="primary" @_click="handleSubmit" :disabled="saving">
          {{ saving ? 'Creating...' : 'Create Appeal' }}
        </goa-button>
        <goa-button type="tertiary" @_click="$router.push('/appeals')">
          Cancel
        </goa-button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import api from '@/services/api.js';

const router = useRouter();

const settlements = ref([]);
const issueTypes = ref([]);
const staffList = ref([]);
const clientResults = ref([]);
const selectedClient = ref(null);
const clientSearch = ref('');
const saving = ref(false);
const errorMsg = ref('');

let searchTimeout = null;

const form = reactive({
  settlement_id: '',
  issue_type: '',
  description: '',
  legal_description: '',
  primary_staff: '',
  appellant_id: ''
});

const errors = reactive({
  settlement_id: '',
  issue_type: '',
  description: '',
  primary_staff: '',
  appellant_id: ''
});

async function loadLookups() {
  try {
    const [settlementsRes, issueTypesRes, staffRes] = await Promise.all([
      api.get('/lookups/settlements'),
      api.get('/lookups/issue-types'),
      api.get('/lookups/staff')
    ]);
    settlements.value = settlementsRes.data;
    issueTypes.value = issueTypesRes.data;
    staffList.value = staffRes.data;
  } catch {
    errorMsg.value = 'Failed to load form data';
  }
}

function searchClients() {
  if (searchTimeout) clearTimeout(searchTimeout);
  if (clientSearch.value.length < 2) {
    clientResults.value = [];
    return;
  }
  searchTimeout = setTimeout(async () => {
    try {
      const response = await api.get(`/clients/search?q=${encodeURIComponent(clientSearch.value)}`);
      clientResults.value = response.data;
    } catch {
      clientResults.value = [];
    }
  }, 300);
}

function selectClient(client) {
  selectedClient.value = client;
  form.appellant_id = client.id;
  clientResults.value = [];
  clientSearch.value = `${client.first_name} ${client.last_name}`;
  errors.appellant_id = '';
}

function clearClient() {
  selectedClient.value = null;
  form.appellant_id = '';
  clientSearch.value = '';
  clientResults.value = [];
}

function validate() {
  let valid = true;
  errors.settlement_id = '';
  errors.issue_type = '';
  errors.description = '';
  errors.primary_staff = '';
  errors.appellant_id = '';

  if (!form.settlement_id) { errors.settlement_id = 'Settlement is required'; valid = false; }
  if (!form.issue_type) { errors.issue_type = 'Issue type is required'; valid = false; }
  if (!form.description?.trim()) { errors.description = 'Description is required'; valid = false; }
  if (form.description && form.description.length > 2000) { errors.description = 'Max 2000 characters'; valid = false; }
  if (!form.primary_staff) { errors.primary_staff = 'Assigned staff is required'; valid = false; }
  if (!form.appellant_id) { errors.appellant_id = 'Appellant is required'; valid = false; }

  return valid;
}

async function handleSubmit() {
  if (!validate()) return;

  saving.value = true;
  errorMsg.value = '';

  try {
    const response = await api.post('/appeals', {
      settlement_id: form.settlement_id,
      issue_type: form.issue_type,
      description: form.description.trim(),
      legal_description: form.legal_description?.trim() || null,
      primary_staff: form.primary_staff,
      appellant_id: form.appellant_id
    });

    if (response.success) {
      router.push(`/appeals/${response.appeal.id}`);
    }
  } catch (err) {
    errorMsg.value = err.response?.data?.message || 'Failed to create appeal';
  } finally {
    saving.value = false;
  }
}

onMounted(loadLookups);
</script>

<style scoped>
.appeal-new {
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

.form-container {
  background: white;
  border: 1px solid var(--goa-color-greyscale-200, #dcdcdc);
  border-radius: var(--goa-border-radius-m, 4px);
  padding: var(--goa-space-xl);
  max-width: 800px;
}

.form-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: var(--goa-space-m);
}

.form-field-full {
  margin-top: var(--goa-space-m);
}

.client-search {
  position: relative;
}

.search-results {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  background: white;
  border: 1px solid var(--goa-color-greyscale-200, #dcdcdc);
  border-top: none;
  border-radius: 0 0 4px 4px;
  max-height: 200px;
  overflow-y: auto;
  z-index: 100;
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
}

.search-result-item {
  padding: var(--goa-space-s) var(--goa-space-m);
  cursor: pointer;
  border-bottom: 1px solid var(--goa-color-greyscale-100, #f1f1f1);
}

.search-result-item:hover {
  background: var(--goa-color-greyscale-100, #f1f1f1);
}

.client-detail {
  color: var(--goa-color-text-secondary, #666);
  font-size: var(--goa-font-size-4, 0.875rem);
}

.selected-client {
  display: flex;
  align-items: center;
  gap: var(--goa-space-s);
  margin-top: var(--goa-space-xs);
  padding: var(--goa-space-s);
  background: var(--goa-color-greyscale-100, #f1f1f1);
  border-radius: var(--goa-border-radius-s, 4px);
}

.char-count {
  font-size: var(--goa-font-size-3, 0.8rem);
  color: var(--goa-color-text-secondary, #666);
  margin-top: var(--goa-space-2xs);
}

.form-actions {
  margin-top: var(--goa-space-l);
  display: flex;
  gap: var(--goa-space-s);
}
</style>
