<script setup lang="ts">
// Nuxt UI's own words ("Close", "Previous month"…) follow the admin's language on /admin pages.
const uiLocale = useCmsUiLocale()
// The cookie banner: tinyzoo's own by default; ?banner=custom shows one built on useConsent()
// only, ?banner=slots <CmsConsent> with slots, ?banner=none no banner at all.
const route = useRoute()
const banner = computed(() => String(route.query.banner ?? ''))
</script>

<template>
  <UApp :locale="uiLocale">
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
    <!-- The cookie banner (tinyzoo/consent): shown on the website until a visitor chooses, never in the admin. -->
    <CookieBanner v-if="banner === 'custom'" />
    <CookieBannerSlots v-else-if="banner === 'slots'" />
    <CmsConsent v-else-if="banner !== 'none'" />
  </UApp>
</template>
