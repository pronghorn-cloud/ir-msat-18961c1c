import { createApp } from 'vue';
import App from './App.vue';
import router from './router';
import { initAuth } from './services/auth.js';

// Import GoA Web Components styles
import '@abgov/web-components/index.css';

// Import custom styles
import './assets/styles/main.css';

// Import GoA Web Components
import '@abgov/web-components';

// Initialize auth state from localStorage
initAuth();

const app = createApp(App);

app.use(router);

app.mount('#app');
