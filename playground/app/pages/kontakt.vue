<script setup lang="ts">
// A website page with a CMS form: fields, labels and the thank-you message come from
// cms.config (ContactForm); messages show up in the admin under "Contact form".
useHead({ title: 'Kontakt' })
</script>

<template>
  <main class="mx-auto max-w-xl px-4 py-16">
    <h1 class="text-3xl font-bold mb-2">Kontakt</h1>
    <p class="text-muted mb-8">Napište nám, ozveme se do dvou dnů.</p>
    <CmsForm name="contactForm" />
  </main>
</template>
