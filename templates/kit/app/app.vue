<script setup lang="ts">
// Nuxt UI's own words ("Close", "Previous month"…) follow the admin's language on /admin pages.
const uiLocale = useCmsUiLocale()
</script>

<template>
  <UApp :locale="uiLocale">
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
  </UApp>
</template>
