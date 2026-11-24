<script setup lang="ts">
// The banner is told the page's language: it would otherwise go by <html lang>, which says "cs"
// on every page of this site.
const { lang } = useLang()
</script>

<template>
  <UApp>
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
    <!-- The cookie banner, in the page's language; its texts are in the admin under Settings → Cookie banner. -->
    <CmsConsent :locale="lang" />
  </UApp>
</template>
