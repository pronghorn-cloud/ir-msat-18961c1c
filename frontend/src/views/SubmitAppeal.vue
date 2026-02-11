<template>
  <div class="submit-appeal">
    <header class="page-header">
      <h1>File an Appeal Online</h1>
      <p>Submit your appeal to the Metis Settlements Appeal Tribunal</p>
    </header>

    <!-- Success state -->
    <div v-if="submitted" class="success-container">
      <goa-callout type="success" heading="Appeal Submitted Successfully">
        <p>Your appeal has been received. Your reference number is:</p>
        <p class="reference-number">{{ referenceNumber }}</p>
        <p>Please save this reference number for your records. You will need it when contacting us about your appeal.</p>
        <p v-if="docsUploaded > 0">{{ docsUploaded }} document(s) uploaded successfully.</p>
      </goa-callout>
      <div class="success-actions">
        <goa-button type="primary" @_click="$router.push('/')">Return to Home</goa-button>
        <goa-button type="secondary" @_click="resetForm">Submit Another Appeal</goa-button>
      </div>
    </div>

    <!-- Form wizard -->
    <div v-else>
      <!-- Step indicator -->
      <div class="step-indicator">
        <div
          v-for="(label, idx) in stepLabels"
          :key="idx"
          class="step-item"
          :class="{ active: currentStep === idx + 1, completed: currentStep > idx + 1 }"
        >
          <div class="step-circle">
            <span v-if="currentStep > idx + 1">&#10003;</span>
            <span v-else>{{ idx + 1 }}</span>
          </div>
          <span class="step-label">{{ label }}</span>
        </div>
      </div>

      <!-- Error banner -->
      <goa-callout v-if="errorMsg" type="emergency" heading="Error">
        {{ errorMsg }}
      </goa-callout>

      <div class="form-container">
        <!-- Step 1: Your Information -->
        <div v-show="currentStep === 1">
          <h2>Step 1: Your Information</h2>
          <p class="step-description">Please provide your contact details.</p>

          <div class="form-grid">
            <goa-form-item label="Full Name" requirement="required" :error="errors.full_name">
              <goa-input
                name="full_name"
                :value="form.full_name"
                @_change="(e) => { form.full_name = e.detail.value; errors.full_name = ''; }"
                width="100%"
                placeholder="Your full legal name"
              />
            </goa-form-item>

            <goa-form-item label="MSGC Member ID (Optional)">
              <goa-input
                name="member_id"
                :value="form.member_id"
                @_change="(e) => form.member_id = e.detail.value"
                width="100%"
                placeholder="e.g. M-12345"
              />
            </goa-form-item>
          </div>

          <goa-form-item label="Settlement" requirement="required" :error="errors.settlement">
            <goa-dropdown
              name="settlement"
              :value="form.settlement"
              @_change="(e) => { form.settlement = e.detail.value; errors.settlement = ''; }"
              width="100%"
              placeholder="Select your settlement"
            >
              <goa-dropdown-item
                v-for="s in settlements"
                :key="s"
                :value="s"
                :label="s"
              />
            </goa-dropdown>
          </goa-form-item>

          <div class="form-grid">
            <goa-form-item label="Phone (Optional)">
              <goa-input
                name="phone"
                :value="form.phone"
                @_change="(e) => form.phone = e.detail.value"
                width="100%"
                type="tel"
                placeholder="780-555-0100"
              />
            </goa-form-item>

            <goa-form-item label="Email (Optional)">
              <goa-input
                name="email"
                :value="form.email"
                @_change="(e) => form.email = e.detail.value"
                width="100%"
                type="email"
                placeholder="you@example.com"
              />
            </goa-form-item>
          </div>

          <goa-form-item label="Mailing Address (Optional)">
            <goa-textarea
              name="address"
              :value="form.address"
              @_change="(e) => form.address = e.detail.value"
              width="100%"
              rows="2"
              placeholder="Street address, city, province, postal code"
            />
          </goa-form-item>
        </div>

        <!-- Step 2: Appeal Details -->
        <div v-show="currentStep === 2">
          <h2>Step 2: Appeal Details</h2>
          <p class="step-description">Describe the decision you are appealing.</p>

          <goa-form-item label="Issue Type" requirement="required" :error="errors.issue_type">
            <goa-dropdown
              name="issue_type"
              :value="form.issue_type"
              @_change="(e) => { form.issue_type = e.detail.value; errors.issue_type = ''; }"
              width="100%"
              placeholder="Select the type of issue"
            >
              <goa-dropdown-item
                v-for="t in issueTypes"
                :key="t"
                :value="t"
                :label="t"
              />
            </goa-dropdown>
          </goa-form-item>

          <div class="form-grid">
            <goa-form-item label="Date of Decision (Optional)">
              <input
                type="date"
                class="goa-date-input"
                v-model="form.decision_date"
              />
            </goa-form-item>

            <goa-form-item label="Decision Maker (Optional)">
              <goa-input
                name="decision_maker"
                :value="form.decision_maker"
                @_change="(e) => form.decision_maker = e.detail.value"
                width="100%"
                placeholder="Name of person/body that made the decision"
              />
            </goa-form-item>
          </div>

          <goa-form-item label="Description of Appeal" requirement="required" :error="errors.description">
            <goa-textarea
              name="description"
              :value="form.description"
              @_change="(e) => { form.description = e.detail.value; errors.description = ''; }"
              width="100%"
              rows="6"
              placeholder="Please describe the decision you are appealing and why you believe it should be reviewed..."
            />
            <span class="char-count">{{ (form.description || '').length }}/5000</span>
          </goa-form-item>
        </div>

        <!-- Step 3: Supporting Documents -->
        <div v-show="currentStep === 3">
          <h2>Step 3: Supporting Documents</h2>
          <p class="step-description">Upload any supporting documents (optional). Accepted: PDF, DOC, DOCX, JPG, PNG. Max 50 MB each, up to 10 files.</p>

          <div class="file-upload-area">
            <input
              ref="fileInput"
              type="file"
              multiple
              accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
              @change="handleFileSelect"
              class="file-input-hidden"
            />
            <goa-button type="secondary" @_click="$refs.fileInput.click()">
              Choose Files
            </goa-button>
            <span class="file-hint">or drag and drop files here</span>
          </div>

          <div v-if="files.length > 0" class="file-list">
            <div v-for="(file, idx) in files" :key="idx" class="file-item">
              <div class="file-info">
                <span class="file-icon">{{ fileIcon(file.name) }}</span>
                <span class="file-name">{{ file.name }}</span>
                <span class="file-size">{{ formatFileSize(file.size) }}</span>
              </div>
              <goa-button type="tertiary" size="compact" @_click="removeFile(idx)">
                Remove
              </goa-button>
            </div>
          </div>
          <p v-else class="no-files-msg">No files selected. You can continue without uploading documents.</p>
        </div>

        <!-- Step 4: Review & Submit -->
        <div v-show="currentStep === 4">
          <h2>Step 4: Review & Submit</h2>
          <p class="step-description">Please review your information before submitting.</p>

          <div class="review-section">
            <h3>Your Information</h3>
            <div class="review-grid">
              <div class="review-item">
                <span class="review-label">Full Name</span>
                <span class="review-value">{{ form.full_name }}</span>
              </div>
              <div v-if="form.member_id" class="review-item">
                <span class="review-label">Member ID</span>
                <span class="review-value">{{ form.member_id }}</span>
              </div>
              <div class="review-item">
                <span class="review-label">Settlement</span>
                <span class="review-value">{{ form.settlement }}</span>
              </div>
              <div v-if="form.phone" class="review-item">
                <span class="review-label">Phone</span>
                <span class="review-value">{{ form.phone }}</span>
              </div>
              <div v-if="form.email" class="review-item">
                <span class="review-label">Email</span>
                <span class="review-value">{{ form.email }}</span>
              </div>
              <div v-if="form.address" class="review-item">
                <span class="review-label">Address</span>
                <span class="review-value">{{ form.address }}</span>
              </div>
            </div>
          </div>

          <div class="review-section">
            <h3>Appeal Details</h3>
            <div class="review-grid">
              <div class="review-item">
                <span class="review-label">Issue Type</span>
                <span class="review-value">{{ form.issue_type }}</span>
              </div>
              <div v-if="form.decision_date" class="review-item">
                <span class="review-label">Decision Date</span>
                <span class="review-value">{{ form.decision_date }}</span>
              </div>
              <div v-if="form.decision_maker" class="review-item">
                <span class="review-label">Decision Maker</span>
                <span class="review-value">{{ form.decision_maker }}</span>
              </div>
            </div>
            <div class="review-item full-width">
              <span class="review-label">Description</span>
              <span class="review-value description-preview">{{ form.description }}</span>
            </div>
          </div>

          <div v-if="files.length > 0" class="review-section">
            <h3>Documents ({{ files.length }})</h3>
            <ul class="review-files">
              <li v-for="(file, idx) in files" :key="idx">
                {{ file.name }} ({{ formatFileSize(file.size) }})
              </li>
            </ul>
          </div>

          <div class="declarations">
            <h3>Declarations</h3>
            <goa-form-item :error="errors.declaration_truthful">
              <goa-checkbox
                name="declaration_truthful"
                :checked="form.declaration_truthful"
                @_change="(e) => { form.declaration_truthful = e.detail.checked; errors.declaration_truthful = ''; }"
                text="I declare that the information provided is true and accurate to the best of my knowledge."
              />
            </goa-form-item>
            <goa-form-item :error="errors.declaration_deadlines">
              <goa-checkbox
                name="declaration_deadlines"
                :checked="form.declaration_deadlines"
                @_change="(e) => { form.declaration_deadlines = e.detail.checked; errors.declaration_deadlines = ''; }"
                text="I acknowledge the filing deadlines set by the Metis Settlements Act and understand that late filings may not be accepted."
              />
            </goa-form-item>
          </div>
        </div>

        <!-- Navigation buttons -->
        <div class="step-actions">
          <goa-button v-if="currentStep > 1" type="secondary" @_click="prevStep">
            Previous
          </goa-button>
          <div class="spacer"></div>
          <goa-button v-if="currentStep < 4" type="primary" @_click="nextStep">
            Next
          </goa-button>
          <goa-button v-if="currentStep === 4" type="primary" @_click="handleSubmit" :disabled="submitting">
            {{ submitting ? 'Submitting...' : 'Submit Appeal' }}
          </goa-button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import api from '@/services/api.js';

const router = useRouter();

const stepLabels = ['Your Information', 'Appeal Details', 'Documents', 'Review & Submit'];
const currentStep = ref(1);
const submitting = ref(false);
const submitted = ref(false);
const referenceNumber = ref('');
const docsUploaded = ref(0);
const errorMsg = ref('');

const settlements = ref([]);
const issueTypes = ref([]);
const files = ref([]);
const fileInput = ref(null);

const form = reactive({
  full_name: '',
  member_id: '',
  settlement: '',
  phone: '',
  email: '',
  address: '',
  issue_type: '',
  decision_date: '',
  decision_maker: '',
  description: '',
  declaration_truthful: false,
  declaration_deadlines: false
});

const errors = reactive({
  full_name: '',
  settlement: '',
  issue_type: '',
  description: '',
  declaration_truthful: '',
  declaration_deadlines: ''
});

async function loadLookups() {
  try {
    const [settlementsRes, issueTypesRes] = await Promise.all([
      api.get('/public/settlements'),
      api.get('/public/issue-types')
    ]);
    settlements.value = settlementsRes.data || [];
    issueTypes.value = issueTypesRes.data || [];
  } catch {
    errorMsg.value = 'Failed to load form data. Please refresh the page.';
  }
}

function validateStep(step) {
  let valid = true;

  if (step === 1) {
    errors.full_name = '';
    errors.settlement = '';
    if (!form.full_name?.trim()) { errors.full_name = 'Full name is required'; valid = false; }
    if (!form.settlement) { errors.settlement = 'Settlement is required'; valid = false; }
  }

  if (step === 2) {
    errors.issue_type = '';
    errors.description = '';
    if (!form.issue_type) { errors.issue_type = 'Issue type is required'; valid = false; }
    if (!form.description?.trim()) { errors.description = 'Description is required'; valid = false; }
    if (form.description && form.description.length > 5000) { errors.description = 'Max 5000 characters'; valid = false; }
  }

  if (step === 4) {
    errors.declaration_truthful = '';
    errors.declaration_deadlines = '';
    if (!form.declaration_truthful) { errors.declaration_truthful = 'You must confirm this declaration'; valid = false; }
    if (!form.declaration_deadlines) { errors.declaration_deadlines = 'You must acknowledge the filing deadlines'; valid = false; }
  }

  return valid;
}

function nextStep() {
  if (validateStep(currentStep.value)) {
    currentStep.value++;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
}

function prevStep() {
  currentStep.value--;
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function handleFileSelect(event) {
  const selected = Array.from(event.target.files);
  const remaining = 10 - files.value.length;
  if (remaining <= 0) {
    errorMsg.value = 'Maximum 10 files allowed';
    return;
  }
  const toAdd = selected.slice(0, remaining);
  files.value.push(...toAdd);
  event.target.value = '';
}

function removeFile(idx) {
  files.value.splice(idx, 1);
}

async function handleSubmit() {
  if (!validateStep(4)) return;

  submitting.value = true;
  errorMsg.value = '';

  try {
    const formData = new FormData();
    formData.append('full_name', form.full_name.trim());
    if (form.member_id?.trim()) formData.append('member_id', form.member_id.trim());
    formData.append('settlement', form.settlement);
    if (form.phone?.trim()) formData.append('phone', form.phone.trim());
    if (form.email?.trim()) formData.append('email', form.email.trim());
    if (form.address?.trim()) formData.append('address', form.address.trim());
    formData.append('issue_type', form.issue_type);
    if (form.decision_date) formData.append('decision_date', form.decision_date);
    if (form.decision_maker?.trim()) formData.append('decision_maker', form.decision_maker.trim());
    formData.append('description', form.description.trim());
    formData.append('declaration_truthful', 'true');
    formData.append('declaration_deadlines', 'true');

    for (const file of files.value) {
      formData.append('files', file);
    }

    const response = await api.post('/public/submissions', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 60000
    });

    if (response.success) {
      referenceNumber.value = response.reference_number;
      docsUploaded.value = response.documents_uploaded || 0;
      submitted.value = true;
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  } catch (err) {
    errorMsg.value = err.response?.data?.message || 'Failed to submit appeal. Please try again.';
  } finally {
    submitting.value = false;
  }
}

function resetForm() {
  Object.assign(form, {
    full_name: '', member_id: '', settlement: '', phone: '', email: '', address: '',
    issue_type: '', decision_date: '', decision_maker: '', description: '',
    declaration_truthful: false, declaration_deadlines: false
  });
  Object.keys(errors).forEach(k => errors[k] = '');
  files.value = [];
  currentStep.value = 1;
  submitted.value = false;
  referenceNumber.value = '';
  docsUploaded.value = 0;
  errorMsg.value = '';
}

function formatFileSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / 1048576).toFixed(1) + ' MB';
}

function fileIcon(name) {
  const ext = name.split('.').pop()?.toLowerCase();
  const icons = { pdf: 'PDF', doc: 'DOC', docx: 'DOC', jpg: 'IMG', jpeg: 'IMG', png: 'IMG' };
  return icons[ext] || 'FILE';
}

onMounted(loadLookups);
</script>

<style scoped>
.submit-appeal {
  max-width: 800px;
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

/* Step indicator */
.step-indicator {
  display: flex;
  justify-content: space-between;
  margin-bottom: var(--goa-space-xl);
  position: relative;
}

.step-indicator::before {
  content: '';
  position: absolute;
  top: 16px;
  left: 40px;
  right: 40px;
  height: 2px;
  background: var(--goa-color-greyscale-200, #dcdcdc);
  z-index: 0;
}

.step-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--goa-space-xs);
  z-index: 1;
  flex: 1;
}

.step-circle {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: var(--goa-font-weight-bold);
  font-size: var(--goa-font-size-3);
  background: var(--goa-color-greyscale-200, #dcdcdc);
  color: var(--goa-color-text-secondary);
  transition: all 0.2s;
}

.step-item.active .step-circle {
  background: var(--goa-color-interactive-default, #0070c4);
  color: white;
}

.step-item.completed .step-circle {
  background: var(--goa-color-status-success, #2e8540);
  color: white;
}

.step-label {
  font-size: var(--goa-font-size-2, 0.75rem);
  color: var(--goa-color-text-secondary);
  text-align: center;
}

.step-item.active .step-label {
  color: var(--goa-color-interactive-default, #0070c4);
  font-weight: var(--goa-font-weight-bold);
}

/* Form container */
.form-container {
  background: white;
  border: 1px solid var(--goa-color-greyscale-200, #dcdcdc);
  border-radius: var(--goa-border-radius-m, 4px);
  padding: var(--goa-space-xl);
}

.form-container h2 {
  font-size: var(--goa-font-size-6);
  font-weight: var(--goa-font-weight-bold);
  margin-bottom: var(--goa-space-xs);
}

.step-description {
  color: var(--goa-color-text-secondary);
  margin-bottom: var(--goa-space-l);
}

.form-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--goa-space-m);
}

.char-count {
  font-size: var(--goa-font-size-3, 0.8rem);
  color: var(--goa-color-text-secondary);
  margin-top: var(--goa-space-2xs);
}

.goa-date-input {
  width: 100%;
  padding: 8px 12px;
  font-size: var(--goa-font-size-4, 1rem);
  border: 1px solid var(--goa-color-greyscale-400, #999);
  border-radius: var(--goa-border-radius-s, 4px);
  font-family: inherit;
}

/* File upload */
.file-upload-area {
  display: flex;
  align-items: center;
  gap: var(--goa-space-m);
  padding: var(--goa-space-l);
  border: 2px dashed var(--goa-color-greyscale-300, #ccc);
  border-radius: var(--goa-border-radius-m, 4px);
  background: var(--goa-color-greyscale-100, #f1f1f1);
  margin-bottom: var(--goa-space-l);
}

.file-input-hidden {
  display: none;
}

.file-hint {
  color: var(--goa-color-text-secondary);
  font-size: var(--goa-font-size-3);
}

.file-list {
  display: flex;
  flex-direction: column;
  gap: var(--goa-space-s);
}

.file-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--goa-space-s) var(--goa-space-m);
  background: var(--goa-color-greyscale-100, #f1f1f1);
  border-radius: var(--goa-border-radius-s, 4px);
}

.file-info {
  display: flex;
  align-items: center;
  gap: var(--goa-space-s);
}

.file-icon {
  font-weight: var(--goa-font-weight-bold);
  font-size: var(--goa-font-size-2);
  color: var(--goa-color-interactive-default, #0070c4);
  background: white;
  padding: 2px 6px;
  border-radius: 3px;
  border: 1px solid var(--goa-color-greyscale-200);
}

.file-name {
  font-size: var(--goa-font-size-4);
}

.file-size {
  font-size: var(--goa-font-size-3);
  color: var(--goa-color-text-secondary);
}

.no-files-msg {
  color: var(--goa-color-text-secondary);
  font-style: italic;
}

/* Review section */
.review-section {
  margin-bottom: var(--goa-space-l);
  padding-bottom: var(--goa-space-l);
  border-bottom: 1px solid var(--goa-color-greyscale-200, #dcdcdc);
}

.review-section h3 {
  font-size: var(--goa-font-size-5);
  font-weight: var(--goa-font-weight-bold);
  margin-bottom: var(--goa-space-m);
  color: var(--goa-color-text-default);
}

.review-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--goa-space-s) var(--goa-space-l);
}

.review-item {
  display: flex;
  flex-direction: column;
  gap: var(--goa-space-2xs);
}

.review-item.full-width {
  margin-top: var(--goa-space-s);
}

.review-label {
  font-size: var(--goa-font-size-3);
  font-weight: var(--goa-font-weight-bold);
  color: var(--goa-color-text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.review-value {
  font-size: var(--goa-font-size-4);
  color: var(--goa-color-text-default);
}

.description-preview {
  white-space: pre-wrap;
  background: var(--goa-color-greyscale-100, #f1f1f1);
  padding: var(--goa-space-s);
  border-radius: var(--goa-border-radius-s, 4px);
  max-height: 150px;
  overflow-y: auto;
}

.review-files {
  list-style: none;
  padding: 0;
  margin: 0;
}

.review-files li {
  padding: var(--goa-space-xs) 0;
  border-bottom: 1px solid var(--goa-color-greyscale-100);
  font-size: var(--goa-font-size-4);
}

/* Declarations */
.declarations {
  margin-bottom: var(--goa-space-l);
}

.declarations h3 {
  font-size: var(--goa-font-size-5);
  font-weight: var(--goa-font-weight-bold);
  margin-bottom: var(--goa-space-m);
}

/* Step navigation */
.step-actions {
  display: flex;
  align-items: center;
  gap: var(--goa-space-m);
  margin-top: var(--goa-space-xl);
  padding-top: var(--goa-space-l);
  border-top: 1px solid var(--goa-color-greyscale-200, #dcdcdc);
}

.spacer {
  flex: 1;
}

/* Success */
.success-container {
  max-width: 600px;
  margin: 0 auto;
}

.reference-number {
  font-size: var(--goa-font-size-7, 1.5rem);
  font-weight: var(--goa-font-weight-bold);
  color: var(--goa-color-interactive-default, #0070c4);
  margin: var(--goa-space-m) 0;
}

.success-actions {
  display: flex;
  gap: var(--goa-space-m);
  margin-top: var(--goa-space-l);
}

@media (max-width: 768px) {
  .form-grid {
    grid-template-columns: 1fr;
  }

  .review-grid {
    grid-template-columns: 1fr;
  }

  .step-indicator {
    gap: var(--goa-space-2xs);
  }

  .step-label {
    font-size: 0.65rem;
  }

  .step-indicator::before {
    left: 20px;
    right: 20px;
  }
}
</style>
