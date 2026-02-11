<template>
  <div class="login-page">
    <div class="login-container">
      <div class="login-header">
        <h1>Metis Settlements Appeal Tribunal</h1>
        <p>Sign in to access the case management system</p>
      </div>

      <div class="login-card">
        <h2>Sign In</h2>

        <div v-if="error" class="error-banner">
          <goa-callout type="emergency" heading="Sign in failed">
            {{ error }}
          </goa-callout>
        </div>

        <form @submit.prevent="handleLogin">
          <goa-form-item label="Email" :error="emailError">
            <goa-input
              name="email"
              type="email"
              :value="email"
              placeholder="Enter your email"
              @_change="onEmailChange"
              width="100%"
            ></goa-input>
          </goa-form-item>

          <goa-form-item label="Password" :error="passwordError">
            <goa-input
              name="password"
              type="password"
              :value="password"
              placeholder="Enter your password"
              @_change="onPasswordChange"
              width="100%"
            ></goa-input>
          </goa-form-item>

          <div class="login-actions">
            <goa-button
              type="primary"
              @_click="handleLogin"
              :disabled="loading"
              width="100%"
            >
              {{ loading ? 'Signing in...' : 'Sign In' }}
            </goa-button>
          </div>
        </form>

        <div class="login-divider">
          <span>or</span>
        </div>

        <div class="sso-section">
          <goa-button
            type="secondary"
            width="100%"
            @_click="handleSSO"
            :disabled="true"
          >
            Sign in with Microsoft (Coming Soon)
          </goa-button>
        </div>

        <div class="login-help">
          <p>Test credentials:</p>
          <ul>
            <li><strong>Admin:</strong> admin@msat.gov.ab.ca / admin123</li>
            <li><strong>Staff:</strong> staff@msat.gov.ab.ca / staff123</li>
          </ul>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { login } from '@/services/auth.js';

const router = useRouter();

const email = ref('');
const password = ref('');
const error = ref('');
const emailError = ref('');
const passwordError = ref('');
const loading = ref(false);

const onEmailChange = (e) => {
  email.value = e.detail.value;
  emailError.value = '';
};

const onPasswordChange = (e) => {
  password.value = e.detail.value;
  passwordError.value = '';
};

const handleLogin = async () => {
  // Validate
  error.value = '';
  emailError.value = '';
  passwordError.value = '';

  if (!email.value) {
    emailError.value = 'Email is required';
    return;
  }
  if (!password.value) {
    passwordError.value = 'Password is required';
    return;
  }

  loading.value = true;
  try {
    const response = await login(email.value, password.value);
    if (response.success) {
      // Redirect based on role
      const role = response.user.role;
      if (role === 'admin' || role === 'superadmin') {
        router.push('/dashboard');
      } else if (role === 'staff') {
        router.push('/dashboard');
      } else if (role === 'board_member') {
        router.push('/dashboard');
      } else {
        router.push('/dashboard');
      }
    }
  } catch (err) {
    const msg = err.response?.data?.message || 'Sign in failed. Please try again.';
    error.value = msg;
  } finally {
    loading.value = false;
  }
};

const handleSSO = () => {
  // Microsoft SSO - to be implemented when Entra ID credentials are provided
};
</script>

<style scoped>
.login-page {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 100vh;
  background-color: var(--goa-color-greyscale-100, #f1f1f1);
  padding: var(--goa-space-l);
}

.login-container {
  width: 100%;
  max-width: 460px;
}

.login-header {
  text-align: center;
  margin-bottom: var(--goa-space-l);
}

.login-header h1 {
  font-size: var(--goa-font-size-7, 1.5rem);
  color: var(--goa-color-text-default, #333);
  margin-bottom: var(--goa-space-xs);
}

.login-header p {
  color: var(--goa-color-text-secondary, #666);
  font-size: var(--goa-font-size-4, 0.875rem);
}

.login-card {
  background: white;
  border-radius: var(--goa-border-radius-m, 4px);
  padding: var(--goa-space-xl, 2rem);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.12);
}

.login-card h2 {
  font-size: var(--goa-font-size-6, 1.25rem);
  margin-bottom: var(--goa-space-l);
  text-align: center;
}

.error-banner {
  margin-bottom: var(--goa-space-m);
}

.login-actions {
  margin-top: var(--goa-space-l);
}

.login-divider {
  display: flex;
  align-items: center;
  margin: var(--goa-space-l) 0;
  color: var(--goa-color-text-secondary, #666);
}

.login-divider::before,
.login-divider::after {
  content: '';
  flex: 1;
  height: 1px;
  background-color: var(--goa-color-greyscale-200, #dcdcdc);
}

.login-divider span {
  padding: 0 var(--goa-space-m);
  font-size: var(--goa-font-size-3, 0.8rem);
}

.login-help {
  margin-top: var(--goa-space-l);
  padding: var(--goa-space-m);
  background-color: var(--goa-color-greyscale-100, #f1f1f1);
  border-radius: var(--goa-border-radius-s, 2px);
  font-size: var(--goa-font-size-3, 0.8rem);
}

.login-help p {
  margin-bottom: var(--goa-space-xs);
  font-weight: var(--goa-font-weight-bold, 700);
}

.login-help ul {
  list-style: none;
  padding: 0;
  margin: 0;
}

.login-help li {
  padding: var(--goa-space-2xs) 0;
}
</style>
