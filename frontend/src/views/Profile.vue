<template>
  <div class="profile">
    <div class="page-header">
      <h1>My Profile</h1>
      <p>Manage your account settings</p>
    </div>

    <!-- User Info Section -->
    <div class="profile-section">
      <div class="section-header">
        <h2>Account Information</h2>
        <goa-button v-if="!editingProfile" type="tertiary" size="compact" @_click="startEditProfile">
          Edit Profile
        </goa-button>
      </div>

      <goa-callout v-if="profileSuccess" type="success" heading="Success">
        {{ profileSuccess }}
      </goa-callout>

      <goa-callout v-if="profileError" type="emergency" heading="Error">
        {{ profileError }}
      </goa-callout>

      <!-- View Mode -->
      <div v-if="!editingProfile" class="info-grid">
        <div class="info-item">
          <span class="info-label">First Name</span>
          <span class="info-value">{{ user?.first_name || '—' }}</span>
        </div>
        <div class="info-item">
          <span class="info-label">Last Name</span>
          <span class="info-value">{{ user?.last_name || '—' }}</span>
        </div>
        <div class="info-item">
          <span class="info-label">Email</span>
          <span class="info-value">{{ user?.email || '—' }}</span>
        </div>
        <div class="info-item">
          <span class="info-label">Role</span>
          <span class="info-value">{{ user?.role || '—' }}</span>
        </div>
        <div class="info-item">
          <span class="info-label">Last Login</span>
          <span class="info-value">{{ user?.last_login ? new Date(user.last_login).toLocaleString() : '—' }}</span>
        </div>
      </div>

      <!-- Edit Mode -->
      <div v-else class="edit-form">
        <goa-form-item label="First Name" :error="profileErrors.first_name">
          <goa-input
            name="first_name"
            :value="profileForm.first_name"
            @_change="(e) => profileForm.first_name = e.detail.value"
            width="100%"
          />
        </goa-form-item>

        <goa-form-item label="Last Name" :error="profileErrors.last_name">
          <goa-input
            name="last_name"
            :value="profileForm.last_name"
            @_change="(e) => profileForm.last_name = e.detail.value"
            width="100%"
          />
        </goa-form-item>

        <div class="info-item" style="margin-top: var(--goa-space-s);">
          <span class="info-label">Email</span>
          <span class="info-value">{{ user?.email }}</span>
        </div>

        <div class="info-item" style="margin-top: var(--goa-space-s);">
          <span class="info-label">Role</span>
          <span class="info-value">{{ user?.role }}</span>
        </div>

        <div class="form-actions">
          <goa-button type="primary" @_click="saveProfile" :disabled="savingProfile">
            {{ savingProfile ? 'Saving...' : 'Save Changes' }}
          </goa-button>
          <goa-button type="tertiary" @_click="cancelEditProfile">
            Cancel
          </goa-button>
        </div>
      </div>
    </div>

    <!-- Change Password Section -->
    <div class="profile-section">
      <h2>Change Password</h2>

      <goa-callout v-if="successMessage" type="success" heading="Success">
        {{ successMessage }}
      </goa-callout>

      <goa-callout v-if="errorMessage" type="emergency" heading="Error">
        {{ errorMessage }}
      </goa-callout>

      <form @submit.prevent="handleChangePassword" class="password-form">
        <goa-form-item label="Current Password" :error="errors.currentPassword">
          <goa-input
            type="password"
            name="currentPassword"
            :value="form.currentPassword"
            @_change="(e) => form.currentPassword = e.detail.value"
            width="100%"
          />
        </goa-form-item>

        <goa-form-item label="New Password" :error="errors.newPassword">
          <goa-input
            type="password"
            name="newPassword"
            :value="form.newPassword"
            @_change="(e) => form.newPassword = e.detail.value"
            width="100%"
          />
        </goa-form-item>

        <goa-form-item label="Confirm New Password" :error="errors.confirmPassword">
          <goa-input
            type="password"
            name="confirmPassword"
            :value="form.confirmPassword"
            @_change="(e) => form.confirmPassword = e.detail.value"
            width="100%"
          />
        </goa-form-item>

        <div class="form-actions">
          <goa-button type="primary" @_click="handleChangePassword" :disabled="loading">
            {{ loading ? 'Changing...' : 'Change Password' }}
          </goa-button>
        </div>
      </form>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue';
import { authState } from '@/services/auth.js';
import api from '@/services/api.js';

const user = ref(null);
const loading = ref(false);
const successMessage = ref('');
const errorMessage = ref('');

// Profile edit state
const editingProfile = ref(false);
const savingProfile = ref(false);
const profileSuccess = ref('');
const profileError = ref('');

const profileForm = reactive({
  first_name: '',
  last_name: ''
});

const profileErrors = reactive({
  first_name: '',
  last_name: ''
});

// Password form state
const form = reactive({
  currentPassword: '',
  newPassword: '',
  confirmPassword: ''
});

const errors = reactive({
  currentPassword: '',
  newPassword: '',
  confirmPassword: ''
});

onMounted(async () => {
  try {
    const response = await api.get('/auth/me');
    if (response.success) {
      user.value = response.user;
    }
  } catch {
    user.value = authState.user;
  }
});

// Profile edit functions
function startEditProfile() {
  profileForm.first_name = user.value?.first_name || '';
  profileForm.last_name = user.value?.last_name || '';
  profileErrors.first_name = '';
  profileErrors.last_name = '';
  profileSuccess.value = '';
  profileError.value = '';
  editingProfile.value = true;
}

function cancelEditProfile() {
  editingProfile.value = false;
  profileErrors.first_name = '';
  profileErrors.last_name = '';
  profileError.value = '';
}

async function saveProfile() {
  profileErrors.first_name = '';
  profileErrors.last_name = '';
  profileError.value = '';
  profileSuccess.value = '';

  let valid = true;
  if (!profileForm.first_name.trim()) {
    profileErrors.first_name = 'First name is required';
    valid = false;
  }
  if (!profileForm.last_name.trim()) {
    profileErrors.last_name = 'Last name is required';
    valid = false;
  }
  if (!valid) return;

  savingProfile.value = true;

  try {
    const response = await api.put('/auth/profile', {
      first_name: profileForm.first_name.trim(),
      last_name: profileForm.last_name.trim()
    });

    if (response.success) {
      user.value = response.user;
      editingProfile.value = false;
      profileSuccess.value = 'Profile updated successfully';

      // Update auth state and localStorage so header reflects new name
      authState.user = {
        ...authState.user,
        first_name: response.user.first_name,
        last_name: response.user.last_name
      };
      localStorage.setItem('msat_user', JSON.stringify(authState.user));
    }
  } catch (err) {
    profileError.value = err.response?.data?.message || 'Failed to update profile';
  } finally {
    savingProfile.value = false;
  }
}

// Password functions
function clearMessages() {
  successMessage.value = '';
  errorMessage.value = '';
  errors.currentPassword = '';
  errors.newPassword = '';
  errors.confirmPassword = '';
}

function validate() {
  let valid = true;
  clearMessages();

  if (!form.currentPassword) {
    errors.currentPassword = 'Current password is required';
    valid = false;
  }

  if (!form.newPassword) {
    errors.newPassword = 'New password is required';
    valid = false;
  } else if (form.newPassword.length < 6) {
    errors.newPassword = 'Password must be at least 6 characters';
    valid = false;
  }

  if (!form.confirmPassword) {
    errors.confirmPassword = 'Please confirm your new password';
    valid = false;
  } else if (form.newPassword !== form.confirmPassword) {
    errors.confirmPassword = 'Passwords do not match';
    valid = false;
  }

  return valid;
}

async function handleChangePassword() {
  if (!validate()) return;

  loading.value = true;
  clearMessages();

  try {
    const response = await api.put('/auth/change-password', {
      currentPassword: form.currentPassword,
      newPassword: form.newPassword
    });

    if (response.success) {
      successMessage.value = 'Password changed successfully';
      form.currentPassword = '';
      form.newPassword = '';
      form.confirmPassword = '';
    }
  } catch (err) {
    errorMessage.value = err.response?.data?.message || 'Failed to change password';
  } finally {
    loading.value = false;
  }
}
</script>

<style scoped>
.profile {
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

.profile-section {
  background: white;
  border: 1px solid var(--goa-color-greyscale-200, #dcdcdc);
  border-radius: var(--goa-border-radius-m, 4px);
  padding: var(--goa-space-l);
  margin-bottom: var(--goa-space-l);
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--goa-space-m);
  padding-bottom: var(--goa-space-s);
  border-bottom: 1px solid var(--goa-color-greyscale-200, #dcdcdc);
}

.section-header h2 {
  font-size: var(--goa-font-size-6, 1.25rem);
  margin: 0;
}

.profile-section > h2 {
  font-size: var(--goa-font-size-6, 1.25rem);
  margin-bottom: var(--goa-space-m);
  padding-bottom: var(--goa-space-s);
  border-bottom: 1px solid var(--goa-color-greyscale-200, #dcdcdc);
}

.info-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: var(--goa-space-m);
}

.info-item {
  display: flex;
  flex-direction: column;
  gap: var(--goa-space-2xs);
}

.info-label {
  font-size: var(--goa-font-size-4, 0.875rem);
  color: var(--goa-color-text-secondary, #666);
  font-weight: var(--goa-font-weight-bold, 700);
}

.info-value {
  font-size: var(--goa-font-size-5, 1rem);
}

.edit-form {
  max-width: 400px;
}

.password-form {
  max-width: 400px;
  margin-top: var(--goa-space-m);
}

.form-actions {
  margin-top: var(--goa-space-m);
  display: flex;
  gap: var(--goa-space-s);
}
</style>
