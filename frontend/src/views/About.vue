<template>
  <div class="about">
    <header class="page-header">
      <h1>About the Metis Settlements Appeal Tribunal</h1>
    </header>

    <section class="content">
      <goa-callout type="information">
        <h2>{{ mandateContent.title || 'Our Mandate' }}</h2>
        <p>{{ mandateContent.body || 'The Metis Settlements Appeal Tribunal (MSAT) is an independent, quasi-judicial body established under the Metis Settlements Act. We hear appeals related to land, membership, compensation, and other matters affecting the 8 Metis Settlements in Alberta.' }}</p>
      </goa-callout>

      <div class="info-blocks">
        <div class="info-block">
          <h3>{{ settlementsContent.title || 'The 8 Metis Settlements' }}</h3>
          <p>{{ settlementsContent.body || 'Buffalo Lake, East Prairie, Elizabeth, Fishing Lake, Gift Lake, Kikino, Paddle Prairie, and Peavine - home to over 6,000 Metis Settlement members across Alberta.' }}</p>
        </div>

        <div class="info-block">
          <h3>{{ processContent.title || 'Appeal Process' }}</h3>
          <p>{{ processContent.body || 'Appeals follow a 5-stage process: Receipt, Mediation/Conciliation, Information Gathering, Hearing Package Preparation, and Hearing & Decision.' }}</p>
        </div>

        <div class="info-block">
          <h3>{{ lapContent.title || 'Land Access Panel' }}</h3>
          <p>{{ lapContent.body || 'The Land Access Panel handles applications related to oil and gas access on Metis Settlement lands, ensuring fair resolution between operators and settlement members.' }}</p>
        </div>
      </div>

      <section class="contact-section">
        <h2>{{ ctaContent.title || 'Get in Touch' }}</h2>
        <p>{{ ctaContent.body || 'Have questions about the appeal process? We are here to help.' }}</p>
        <goa-button type="primary" @click="goToContact">
          Contact Us
        </goa-button>
      </section>
    </section>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import api from '@/services/api.js';

const router = useRouter();

// CMS content with fallbacks
const mandateContent = ref({});
const settlementsContent = ref({});
const processContent = ref({});
const lapContent = ref({});
const ctaContent = ref({});

onMounted(async () => {
  try {
    const response = await api.get('/public/content/about');
    if (response.success && response.data) {
      response.data.forEach(block => {
        if (block.section_key === 'mandate') mandateContent.value = block;
        else if (block.section_key === 'settlements') settlementsContent.value = block;
        else if (block.section_key === 'process') processContent.value = block;
        else if (block.section_key === 'lap') lapContent.value = block;
        else if (block.section_key === 'cta') ctaContent.value = block;
      });
    }
  } catch {
    /* use hardcoded fallbacks */
  }
});

const goToContact = () => {
  router.push('/contact');
};
</script>

<style scoped>
.about {
  max-width: 900px;
  margin: 0 auto;
}

.page-header {
  margin-bottom: var(--goa-space-xl);
}

.page-header h1 {
  font-size: var(--goa-font-size-7);
  font-weight: var(--goa-font-weight-bold);
  color: var(--goa-color-text-default);
}

.content {
  display: flex;
  flex-direction: column;
  gap: var(--goa-space-xl);
}

.content h2 {
  font-size: var(--goa-font-size-6);
  font-weight: var(--goa-font-weight-bold);
  color: var(--goa-color-text-default);
  margin-bottom: var(--goa-space-m);
}

.info-blocks {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: var(--goa-space-l);
  margin-top: var(--goa-space-l);
}

.info-block {
  padding: var(--goa-space-l);
  border: 1px solid var(--goa-color-greyscale-200);
  border-radius: var(--goa-border-radius-m);
  background-color: var(--goa-color-greyscale-white);
}

.info-block h3 {
  font-size: var(--goa-font-size-5);
  font-weight: var(--goa-font-weight-bold);
  color: var(--goa-color-text-default);
  margin-bottom: var(--goa-space-s);
}

.info-block p {
  color: var(--goa-color-text-secondary);
  line-height: 1.6;
}

.contact-section {
  padding: var(--goa-space-xl);
  background-color: var(--goa-color-greyscale-100);
  border-radius: var(--goa-border-radius-m);
  text-align: center;
}

.contact-section p {
  margin-bottom: var(--goa-space-m);
  color: var(--goa-color-text-secondary);
}
</style>
