import { createRouter, createWebHistory } from 'vue-router';
import { authState } from '@/services/auth.js';
import Home from '@/views/Home.vue';

const routes = [
  // Public routes
  {
    path: '/',
    name: 'Home',
    component: Home
  },
  {
    path: '/services',
    name: 'Services',
    component: () => import('@/views/Services.vue')
  },
  {
    path: '/about',
    name: 'About',
    component: () => import('@/views/About.vue')
  },
  {
    path: '/contact',
    name: 'Contact',
    component: () => import('@/views/Contact.vue')
  },
  {
    path: '/submit-appeal',
    name: 'SubmitAppeal',
    component: () => import('@/views/SubmitAppeal.vue')
  },
  {
    path: '/decisions',
    name: 'Decisions',
    component: () => import('@/views/PublicDecisions.vue')
  },
  {
    path: '/hearings',
    name: 'Hearings',
    component: () => import('@/views/HearingSchedule.vue')
  },

  // Auth routes
  {
    path: '/login',
    name: 'Login',
    component: () => import('@/views/Login.vue'),
    meta: { hideNav: true }
  },

  // Protected routes — any authenticated user
  {
    path: '/profile',
    name: 'Profile',
    component: () => import('@/views/Profile.vue'),
    meta: { requiresAuth: true }
  },

  // Staff & Admin only
  {
    path: '/dashboard',
    name: 'Dashboard',
    component: () => import('@/views/Dashboard.vue'),
    meta: { requiresAuth: true, allowedRoles: ['admin', 'staff'] }
  },
  {
    path: '/annual-report',
    name: 'AnnualReport',
    component: () => import('@/views/AnnualReport.vue'),
    meta: { requiresAuth: true, allowedRoles: ['admin', 'staff'] }
  },
  {
    path: '/clients',
    name: 'Clients',
    component: () => import('@/views/ClientsList.vue'),
    meta: { requiresAuth: true, allowedRoles: ['admin', 'staff'] }
  },
  {
    path: '/organizations',
    name: 'Organizations',
    component: () => import('@/views/OrganizationsList.vue'),
    meta: { requiresAuth: true, allowedRoles: ['admin', 'staff'] }
  },
  {
    path: '/submissions',
    name: 'Submissions',
    component: () => import('@/views/SubmissionsList.vue'),
    meta: { requiresAuth: true, allowedRoles: ['admin', 'staff'] }
  },
  {
    path: '/documents',
    name: 'Documents',
    component: () => import('@/views/DocumentSearch.vue'),
    meta: { requiresAuth: true, allowedRoles: ['admin', 'staff'] }
  },
  {
    path: '/digitize',
    name: 'Digitize',
    component: () => import('@/views/DigitizeFiles.vue'),
    meta: { requiresAuth: true, allowedRoles: ['admin', 'staff'] }
  },
  {
    path: '/lap',
    name: 'LapApplications',
    component: () => import('@/views/LapApplications.vue'),
    meta: { requiresAuth: true, allowedRoles: ['admin', 'staff'] }
  },
  {
    path: '/lap/map',
    name: 'LapMap',
    component: () => import('@/views/LapMap.vue'),
    meta: { requiresAuth: true, allowedRoles: ['admin', 'staff'] }
  },
  {
    path: '/admin/content',
    name: 'ContentManager',
    component: () => import('@/views/ContentManager.vue'),
    meta: { requiresAuth: true, allowedRoles: ['admin', 'staff'] }
  },

  // Staff, Admin & Board Member
  {
    path: '/appeals',
    name: 'Appeals',
    component: () => import('@/views/Appeals.vue'),
    meta: { requiresAuth: true, allowedRoles: ['admin', 'staff', 'board_member'] }
  },
  {
    path: '/appeals/new',
    name: 'AppealNew',
    component: () => import('@/views/AppealNew.vue'),
    meta: { requiresAuth: true, allowedRoles: ['admin', 'staff'] }
  },
  {
    path: '/appeals/:id',
    name: 'AppealDetail',
    component: () => import('@/views/AppealDetail.vue'),
    meta: { requiresAuth: true, allowedRoles: ['admin', 'staff', 'board_member'] }
  },

  // Public user only
  {
    path: '/my-cases',
    name: 'MyCases',
    component: () => import('@/views/MyCases.vue'),
    meta: { requiresAuth: true, allowedRoles: ['user'] }
  },

  // Admin only
  {
    path: '/admin/users',
    name: 'UserManagement',
    component: () => import('@/views/UserManagement.vue'),
    meta: { requiresAuth: true, allowedRoles: ['admin'] }
  }
];

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes
});

// Role-based default landing page
function getDefaultRoute(role) {
  if (role === 'admin' || role === 'staff') return '/dashboard';
  if (role === 'board_member') return '/appeals';
  if (role === 'user') return '/my-cases';
  return '/';
}

// Navigation guard
router.beforeEach((to, from, next) => {
  if (to.meta.requiresAuth && !authState.isAuthenticated) {
    next({ name: 'Login', query: { redirect: to.fullPath } });
  } else if (to.meta.allowedRoles && !to.meta.allowedRoles.includes(authState.user?.role)) {
    next(getDefaultRoute(authState.user?.role));
  } else if (to.name === 'Login' && authState.isAuthenticated) {
    next(getDefaultRoute(authState.user?.role));
  } else {
    next();
  }
});

export default router;
