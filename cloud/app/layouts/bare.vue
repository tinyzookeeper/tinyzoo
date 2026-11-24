<script setup lang="ts">
// Signing in and the e-mail links: one calm column on cream.
const t = useT()
const { locale, setLocale } = useLocale()
const other = computed(() => (locale.value === 'cs' ? 'en' : 'cs'))
</script>

<template>
  <div class="flex min-h-dvh flex-col bg-(--z-moment-bg)">
    <header class="flex items-center justify-between px-4 py-4 sm:px-6">
      <NuxtLink to="/" class="flex items-center rounded-md py-1" :aria-label="t('nav.home')"><ZLogo /></NuxtLink>
      <UButton color="neutral" variant="ghost" class="px-2 font-medium uppercase" :aria-label="t('nav.language')" @click="setLocale(other)">{{ other }}</UButton>
    </header>
    <main class="flex flex-1 items-start justify-center px-4 pt-8 pb-12 sm:items-center sm:pt-0">
      <div class="w-full max-w-sm">
        <slot />
      </div>
    </main>
  </div>
</template>
