<template>
  <goa-app-header :heading="appName" :url="homeUrl" data-testid="app-header">
    <!-- Navigation items -->
    <a v-for="link in visibleLinks" :key="link.path" :href="link.path" :class="{ 'active': isCurrentRoute(link.path) }"
      @click.prevent="navigateTo(link.path)">
      {{ link.name }}
    </a>

    <!-- Sign In / Sign Out as navigation link -->
    <a v-if="authState.isAuthenticated" href="#" @click.prevent="handleLogout">
      Sign Out ({{ authState.user?.first_name }})
    </a>
    <a v-else href="/login" @click.prevent="navigateTo('/login')">
      Sign In
    </a>
  </goa-app-header>
</template>

<script setup>
  import { computed } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { authState, logout } from '@/services/auth.js';

const router = useRouter();
const route = useRoute();

const appName = 'Metis Settlements Appeal Tribunal';
const homeUrl = '/';

const publicLinks = [
  { name: 'Home', path: '/' },
  { name: 'Services', path: '/services' },
  { name: 'Decisions', path: '/decisions' },
  { name: 'Hearings', path: '/hearings' },
  { name: 'File an Appeal', path: '/submit-appeal' },
  { name: 'About', path: '/about' },
  { name: 'Contact', path: '/contact' }
];

const userLinks = [
  { name: 'My Cases', path: '/my-cases' },
  { name: 'Decisions', path: '/decisions' },
  { name: 'Hearings', path: '/hearings' },
  { name: 'Profile', path: '/profile' },
  { name: 'About', path: '/about' },
  { name: 'Contact', path: '/contact' }
];

const boardLinks = [
  { name: 'Appeals', path: '/appeals' },
  { name: 'Decisions', path: '/decisions' },
  { name: 'Hearings', path: '/hearings' },
  { name: 'Profile', path: '/profile' },
  { name: 'About', path: '/about' },
  { name: 'Contact', path: '/contact' }
];

const authenticatedLinks = [
  { name: 'Dashboard', path: '/dashboard' },
  { name: 'Appeals', path: '/appeals' },
  { name: 'Submissions', path: '/submissions' },
  { name: 'Clients', path: '/clients' },
  { name: 'Organizations', path: '/organizations' },
  { name: 'Documents', path: '/documents' },
  { name: 'Digitize', path: '/digitize' },
  { name: 'Land Access', path: '/lap' },
  { name: 'Content', path: '/admin/content' },
  { name: 'Profile', path: '/profile' },
  { name: 'About', path: '/about' },
  { name: 'Contact', path: '/contact' }
];

const adminLinks = [
  { name: 'Dashboard', path: '/dashboard' },
  { name: 'Appeals', path: '/appeals' },
  { name: 'Submissions', path: '/submissions' },
  { name: 'Clients', path: '/clients' },
  { name: 'Organizations', path: '/organizations' },
  { name: 'Documents', path: '/documents' },
  { name: 'Digitize', path: '/digitize' },
  { name: 'Land Access', path: '/lap' },
  { name: 'Content', path: '/admin/content' },
  { name: 'Users', path: '/admin/users' },
  { name: 'Profile', path: '/profile' },
  { name: 'About', path: '/about' },
  { name: 'Contact', path: '/contact' }
];

const visibleLinks = computed(() => {
  if (!authState.isAuthenticated) return publicLinks;
  if (authState.user?.role === 'admin') return adminLinks;
  if (authState.user?.role === 'user') return userLinks;
  if (authState.user?.role === 'board_member') return boardLinks;
  return authenticatedLinks;
});

const isCurrentRoute = (path) => {
  return route.path === path;
};

const navigateTo = (path) => {
  router.push(path);
};

const handleLogout = async () => {
  await logout();
  router.push('/');
};
</script>

<style scoped>
  a {
    color: var(--goa-color-text-default);
    text-decoration: none;
    padding: var(--goa-space-xs) var(--goa-space-s);
    border-radius: var(--goa-border-radius-s);
    transition: background-color 0.2s ease;
  }

  a:hover {
    background-color: var(--goa-color-greyscale-100);
  }

  a.active {
    font-weight: var(--goa-font-weight-bold);
    color: var(--goa-color-interactive-default);
    position: relative;
  }

  a.active::after {
    content: '';
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    height: 2px;
    background-color: var(--goa-color-interactive-default);
  }
</style>