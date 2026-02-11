<template>
  <div class="home">
    <goa-hero-banner>
      <h1>{{ heroContent.title || 'Metis Settlements Appeal Tribunal' }}</h1>
      <p>{{ heroContent.body || 'Access tribunal services, search decisions, and file appeals online' }}</p>
      <goa-button type="primary" @click="exploreServices">
        Explore Services
      </goa-button>
    </goa-hero-banner>

    <section class="services-grid">
      <h2>Tribunal Services</h2>

      <div class="grid">
        <goa-card
          v-for="service in featuredServices"
          :key="service.id"
          class="service-card"
        >
          <div class="card-content">
            <goa-icon :type="service.icon" size="large"></goa-icon>
            <h3>{{ service.name }}</h3>
            <p>{{ service.description }}</p>
            <goa-button
              type="secondary"
              @click="viewService(service.id)"
            >
              Learn More
            </goa-button>
          </div>
        </goa-card>
      </div>
    </section>

    <section class="appeal-cta">
      <div class="cta-card">
        <h2>{{ ctaContent.title || 'Ready to File an Appeal?' }}</h2>
        <p>{{ ctaContent.body || 'You can submit your appeal online. The process is simple and takes about 10 minutes. You will need details about the decision you are appealing.' }}</p>
        <goa-button type="primary" @click="router.push('/submit-appeal')">
          File an Appeal Online
        </goa-button>
      </div>
    </section>

    <section class="info-section">
      <goa-callout type="information">
        <h3>{{ infoContent.title || 'About the Tribunal' }}</h3>
        <p>{{ infoContent.body || 'The Metis Settlements Appeal Tribunal is an independent, quasi-judicial body that hears appeals related to land, membership, and other matters under the Metis Settlements Act. We serve the 8 Metis Settlements across Alberta.' }}</p>
      </goa-callout>
    </section>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import api, { servicesAPI } from '@/services/api';

const router = useRouter();
const featuredServices = ref([]);
const loading = ref(true);

// CMS content with fallbacks
const heroContent = ref({});
const ctaContent = ref({});
const infoContent = ref({});

onMounted(async () => {
  // Load services and CMS content in parallel
  const servicesPromise = servicesAPI.getAll()
    .then(r => { featuredServices.value = r.data || []; })
    .catch(() => {
      featuredServices.value = [
        { id: '1', name: 'Appeal Management', description: 'File and track appeals through the 5-stage workflow', icon: 'briefcase' },
        { id: '2', name: 'Public Decisions', description: 'Search and view published MSAT tribunal decisions', icon: 'document' }
      ];
    });

  const contentPromise = api.get('/public/content/home')
    .then(r => {
      if (r.success && r.data) {
        r.data.forEach(block => {
          if (block.section_key === 'hero') heroContent.value = block;
          else if (block.section_key === 'cta') ctaContent.value = block;
          else if (block.section_key === 'info') infoContent.value = block;
        });
      }
    })
    .catch(() => { /* use hardcoded fallbacks */ });

  await Promise.all([servicesPromise, contentPromise]);
  loading.value = false;
});

const exploreServices = () => {
  router.push('/services');
};

const viewService = (id) => {
  router.push(`/services?id=${id}`);
};
</script>

<style scoped>
.home {
  display: flex;
  flex-direction: column;
  gap: var(--goa-space-xl);
}

.services-grid {
  padding: var(--goa-space-l) 0;
}

.services-grid h2 {
  font-size: var(--goa-font-size-6);
  font-weight: var(--goa-font-weight-bold);
  margin-bottom: var(--goa-space-l);
  color: var(--goa-color-text-default);
}

.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: var(--goa-space-m);
}

.service-card {
  height: 100%;
}

.card-content {
  display: flex;
  flex-direction: column;
  gap: var(--goa-space-s);
  padding: var(--goa-space-m);
}

.card-content h3 {
  font-size: var(--goa-font-size-5);
  font-weight: var(--goa-font-weight-bold);
  color: var(--goa-color-text-default);
}

.card-content p {
  color: var(--goa-color-text-secondary);
  flex: 1;
}

.appeal-cta {
  padding: var(--goa-space-l) 0;
}

.cta-card {
  background: var(--goa-color-greyscale-100, #f1f1f1);
  border-left: 4px solid var(--goa-color-interactive-default, #0070c4);
  padding: var(--goa-space-xl);
  border-radius: var(--goa-border-radius-m, 4px);
}

.cta-card h2 {
  font-size: var(--goa-font-size-6);
  font-weight: var(--goa-font-weight-bold);
  color: var(--goa-color-text-default);
  margin-bottom: var(--goa-space-s);
}

.cta-card p {
  color: var(--goa-color-text-secondary);
  margin-bottom: var(--goa-space-l);
}

.info-section {
  padding: var(--goa-space-l) 0;
}

@media (max-width: 768px) {
  .grid {
    grid-template-columns: 1fr;
  }
}
</style>
