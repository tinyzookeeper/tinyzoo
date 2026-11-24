<script setup lang="ts">
const { locale } = useLocale()
useHead({ htmlAttrs: { lang: locale }, titleTemplate: (title) => (title ? `${title} · tinyzoo` : 'tinyzoo') })
</script>

<template>
  <UApp :toaster="{ position: 'bottom-right' }">
    <NuxtLoadingIndicator color="#C8644F" :height="2" />
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
  </UApp>
</template>
