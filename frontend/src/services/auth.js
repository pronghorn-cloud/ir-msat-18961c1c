import { reactive } from 'vue';
import api from './api.js';

// Reactive auth state — shared across all components
export const authState = reactive({
  user: null,
  token: null,
  isAuthenticated: false,
  loading: true
});

// Initialize auth state from localStorage on app load
export function initAuth() {
  const token = localStorage.getItem('msat_token');
  const user = localStorage.getItem('msat_user');

  if (token && user) {
    try {
      authState.token = token;
      authState.user = JSON.parse(user);
      authState.isAuthenticated = true;
    } catch {
      clearAuth();
    }
  }
  authState.loading = false;
}

function clearAuth() {
  authState.user = null;
  authState.token = null;
  authState.isAuthenticated = false;
  localStorage.removeItem('msat_token');
  localStorage.removeItem('msat_refresh_token');
  localStorage.removeItem('msat_user');
}

export async function login(email, password) {
  const response = await api.post('/auth/login', { email, password });

  if (response.success) {
    authState.user = response.user;
    authState.token = response.token;
    authState.isAuthenticated = true;

    localStorage.setItem('msat_token', response.token);
    localStorage.setItem('msat_refresh_token', response.refreshToken);
    localStorage.setItem('msat_user', JSON.stringify(response.user));
  }

  return response;
}

export async function logout() {
  try {
    await api.post('/auth/logout');
  } catch {
    // Logout even if API call fails
  }
  clearAuth();
}

export async function refreshToken() {
  const refresh = localStorage.getItem('msat_refresh_token');
  if (!refresh) {
    clearAuth();
    return false;
  }

  try {
    const response = await api.post('/auth/refresh', { refreshToken: refresh });
    if (response.success) {
      authState.token = response.token;
      localStorage.setItem('msat_token', response.token);
      localStorage.setItem('msat_refresh_token', response.refreshToken);
      return true;
    }
  } catch {
    clearAuth();
  }
  return false;
}

export function hasRole(...roles) {
  return authState.user && roles.includes(authState.user.role);
}
