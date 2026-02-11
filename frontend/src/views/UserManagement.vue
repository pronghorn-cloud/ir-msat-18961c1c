<template>
  <div class="user-management">
    <div class="page-header">
      <h1>User Management</h1>
      <p>Create, edit, and manage user accounts</p>
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
        Create User
      </goa-button>
    </div>

    <!-- Users table -->
    <div class="table-container">
      <table class="users-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Email</th>
            <th>Role</th>
            <th>Status</th>
            <th>Last Login</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="loading">
            <td colspan="6" class="center-text">Loading users...</td>
          </tr>
          <tr v-else-if="users.length === 0">
            <td colspan="6" class="center-text">No users found</td>
          </tr>
          <tr v-for="user in users" :key="user.id" :class="{ 'blocked-row': !user.is_active }">
            <td>{{ user.first_name }} {{ user.last_name }}</td>
            <td>{{ user.email }}</td>
            <td>
              <span class="role-badge" :class="'role-' + user.role">
                {{ formatRole(user.role) }}
              </span>
            </td>
            <td>
              <span class="status-badge" :class="user.is_active ? 'status-active' : 'status-blocked'">
                {{ user.is_active ? 'Active' : 'Blocked' }}
              </span>
            </td>
            <td>{{ user.last_login ? new Date(user.last_login).toLocaleString() : '—' }}</td>
            <td class="actions-cell">
              <goa-button type="tertiary" size="compact" @_click="openEditForm(user)">
                Edit
              </goa-button>
              <goa-button
                v-if="user.is_active && user.id !== currentUserId"
                type="tertiary" size="compact"
                @_click="handleBlock(user)"
              >
                Block
              </goa-button>
              <goa-button
                v-if="!user.is_active"
                type="tertiary" size="compact"
                @_click="handleUnblock(user)"
              >
                Unblock
              </goa-button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Create/Edit Modal -->
    <div v-if="showForm" class="modal-overlay" @click.self="closeForm">
      <div class="modal-content">
        <h2>{{ editingUser ? 'Edit User' : 'Create User' }}</h2>

        <goa-callout v-if="formError" type="emergency" heading="Error">
          {{ formError }}
        </goa-callout>

        <goa-form-item label="Email" :error="formErrors.email">
          <goa-input
            name="email"
            :value="formData.email"
            @_change="(e) => formData.email = e.detail.value"
            width="100%"
            :disabled="!!editingUser"
          />
        </goa-form-item>

        <goa-form-item label="First Name" :error="formErrors.first_name">
          <goa-input
            name="first_name"
            :value="formData.first_name"
            @_change="(e) => formData.first_name = e.detail.value"
            width="100%"
          />
        </goa-form-item>

        <goa-form-item label="Last Name" :error="formErrors.last_name">
          <goa-input
            name="last_name"
            :value="formData.last_name"
            @_change="(e) => formData.last_name = e.detail.value"
            width="100%"
          />
        </goa-form-item>

        <goa-form-item label="Role" :error="formErrors.role">
          <goa-dropdown
            name="role"
            :value="formData.role"
            @_change="(e) => formData.role = e.detail.value"
            width="100%"
          >
            <goa-dropdown-item value="admin" label="Admin" />
            <goa-dropdown-item value="staff" label="Staff" />
            <goa-dropdown-item value="board_member" label="Board Member" />
            <goa-dropdown-item value="user" label="User" />
          </goa-dropdown>
        </goa-form-item>

        <goa-form-item v-if="!editingUser" label="Password" :error="formErrors.password">
          <goa-input
            type="password"
            name="password"
            :value="formData.password"
            @_change="(e) => formData.password = e.detail.value"
            width="100%"
          />
        </goa-form-item>

        <div class="form-actions">
          <goa-button type="primary" @_click="handleSubmit" :disabled="saving">
            {{ saving ? 'Saving...' : (editingUser ? 'Save Changes' : 'Create User') }}
          </goa-button>
          <goa-button type="tertiary" @_click="closeForm">
            Cancel
          </goa-button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue';
import { authState } from '@/services/auth.js';
import api from '@/services/api.js';

const users = ref([]);
const loading = ref(true);
const successMsg = ref('');
const errorMsg = ref('');
const currentUserId = authState.user?.id;

// Form state
const showForm = ref(false);
const editingUser = ref(null);
const saving = ref(false);
const formError = ref('');

const formData = reactive({
  email: '',
  first_name: '',
  last_name: '',
  role: 'staff',
  password: ''
});

const formErrors = reactive({
  email: '',
  first_name: '',
  last_name: '',
  role: '',
  password: ''
});

function formatRole(role) {
  const map = { admin: 'Admin', staff: 'Staff', board_member: 'Board Member', user: 'User' };
  return map[role] || role;
}

async function loadUsers() {
  loading.value = true;
  try {
    const response = await api.get('/admin/users');
    if (response.success) {
      users.value = response.users;
    }
  } catch (err) {
    errorMsg.value = err.response?.data?.message || 'Failed to load users';
  } finally {
    loading.value = false;
  }
}

function clearFormErrors() {
  formErrors.email = '';
  formErrors.first_name = '';
  formErrors.last_name = '';
  formErrors.role = '';
  formErrors.password = '';
  formError.value = '';
}

function openCreateForm() {
  editingUser.value = null;
  formData.email = '';
  formData.first_name = '';
  formData.last_name = '';
  formData.role = 'staff';
  formData.password = '';
  clearFormErrors();
  successMsg.value = '';
  errorMsg.value = '';
  showForm.value = true;
}

function openEditForm(user) {
  editingUser.value = user;
  formData.email = user.email;
  formData.first_name = user.first_name;
  formData.last_name = user.last_name;
  formData.role = user.role;
  formData.password = '';
  clearFormErrors();
  successMsg.value = '';
  errorMsg.value = '';
  showForm.value = true;
}

function closeForm() {
  showForm.value = false;
  editingUser.value = null;
}

function validateForm() {
  clearFormErrors();
  let valid = true;

  if (!editingUser.value && !formData.email.trim()) {
    formErrors.email = 'Email is required';
    valid = false;
  }
  if (!formData.first_name.trim()) {
    formErrors.first_name = 'First name is required';
    valid = false;
  }
  if (!formData.last_name.trim()) {
    formErrors.last_name = 'Last name is required';
    valid = false;
  }
  if (!formData.role) {
    formErrors.role = 'Role is required';
    valid = false;
  }
  if (!editingUser.value && !formData.password) {
    formErrors.password = 'Password is required';
    valid = false;
  }
  if (!editingUser.value && formData.password && formData.password.length < 6) {
    formErrors.password = 'Password must be at least 6 characters';
    valid = false;
  }

  return valid;
}

async function handleSubmit() {
  if (!validateForm()) return;

  saving.value = true;
  formError.value = '';

  try {
    if (editingUser.value) {
      const response = await api.put(`/admin/users/${editingUser.value.id}`, {
        first_name: formData.first_name.trim(),
        last_name: formData.last_name.trim(),
        role: formData.role
      });
      if (response.success) {
        successMsg.value = 'User updated successfully';
        closeForm();
        await loadUsers();
      }
    } else {
      const response = await api.post('/admin/users', {
        email: formData.email.trim(),
        first_name: formData.first_name.trim(),
        last_name: formData.last_name.trim(),
        role: formData.role,
        password: formData.password
      });
      if (response.success) {
        successMsg.value = 'User created successfully';
        closeForm();
        await loadUsers();
      }
    }
  } catch (err) {
    formError.value = err.response?.data?.message || 'Operation failed';
  } finally {
    saving.value = false;
  }
}

async function handleBlock(user) {
  successMsg.value = '';
  errorMsg.value = '';
  try {
    const response = await api.put(`/admin/users/${user.id}/block`);
    if (response.success) {
      successMsg.value = `${user.first_name} ${user.last_name} has been blocked`;
      await loadUsers();
    }
  } catch (err) {
    errorMsg.value = err.response?.data?.message || 'Failed to block user';
  }
}

async function handleUnblock(user) {
  successMsg.value = '';
  errorMsg.value = '';
  try {
    const response = await api.put(`/admin/users/${user.id}/unblock`);
    if (response.success) {
      successMsg.value = `${user.first_name} ${user.last_name} has been unblocked`;
      await loadUsers();
    }
  } catch (err) {
    errorMsg.value = err.response?.data?.message || 'Failed to unblock user';
  }
}

onMounted(loadUsers);
</script>

<style scoped>
.user-management {
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
}

.table-container {
  background: white;
  border: 1px solid var(--goa-color-greyscale-200, #dcdcdc);
  border-radius: var(--goa-border-radius-m, 4px);
  overflow-x: auto;
}

.users-table {
  width: 100%;
  border-collapse: collapse;
}

.users-table th,
.users-table td {
  padding: var(--goa-space-s) var(--goa-space-m);
  text-align: left;
  border-bottom: 1px solid var(--goa-color-greyscale-200, #dcdcdc);
}

.users-table th {
  background: var(--goa-color-greyscale-100, #f1f1f1);
  font-weight: var(--goa-font-weight-bold, 700);
  font-size: var(--goa-font-size-4, 0.875rem);
  color: var(--goa-color-text-secondary, #333);
}

.users-table tbody tr:hover {
  background: var(--goa-color-greyscale-100, #f9f9f9);
}

.blocked-row {
  opacity: 0.6;
}

.center-text {
  text-align: center;
  padding: var(--goa-space-xl) !important;
  color: var(--goa-color-text-secondary, #666);
}

.role-badge {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 12px;
  font-size: var(--goa-font-size-3, 0.8rem);
  font-weight: var(--goa-font-weight-bold, 700);
}

.role-admin { background: #e8d5f5; color: #6b21a8; }
.role-staff { background: #dbeafe; color: #1d4ed8; }
.role-board_member { background: #fef3c7; color: #b45309; }
.role-user { background: #e5e7eb; color: #374151; }

.status-badge {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 12px;
  font-size: var(--goa-font-size-3, 0.8rem);
  font-weight: var(--goa-font-weight-bold, 700);
}

.status-active { background: #d1fae5; color: #065f46; }
.status-blocked { background: #fee2e2; color: #991b1b; }

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
  max-width: 480px;
  max-height: 90vh;
  overflow-y: auto;
}

.modal-content h2 {
  font-size: var(--goa-font-size-6, 1.25rem);
  margin-bottom: var(--goa-space-m);
  padding-bottom: var(--goa-space-s);
  border-bottom: 1px solid var(--goa-color-greyscale-200, #dcdcdc);
}

.form-actions {
  margin-top: var(--goa-space-m);
  display: flex;
  gap: var(--goa-space-s);
}
</style>
