<script setup lang="ts">
// Block "Contact form": the ContactForm from cms.config.ts; messages arrive in the admin.
defineProps<{ block: { heading?: string | null } }>()
const locale = useSiteLocale()
</script>

<template>
  <section class="mx-auto max-w-xl px-4 py-12">
    <h2 v-if="block.heading" class="text-2xl font-semibold mb-6">{{ block.heading }}</h2>
    <CmsForm name="contactForm" :locale="locale" />
  </section>
</template>
