<template>
  <div class="app">
    <AppHeader v-if="!hideNav" />

    <main :class="hideNav ? 'full-page' : 'main-content'">
      <router-view />
    </main>

    <AppFooter v-if="!hideNav" />
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import AppHeader from '@/components/AppHeader.vue';
import AppFooter from '@/components/AppFooter.vue';

const route = useRoute();

const hideNav = computed(() => {
  return route.meta?.hideNav === true;
});
</script>

<style scoped>
.app {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
}

.main-content {
  flex: 1;
  width: 100%;
  max-width: var(--goa-space-max-width, 1440px);
  margin: 0 auto;
  padding: var(--goa-space-l) var(--goa-space-m);
}

.full-page {
  flex: 1;
}

@media (max-width: 768px) {
  .main-content {
    padding: var(--goa-space-m) var(--goa-space-s);
  }
}
</style>
