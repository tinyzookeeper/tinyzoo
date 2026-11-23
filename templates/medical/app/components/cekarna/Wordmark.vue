<script setup lang="ts">
// The practice's mark and name. A logo uploaded in Site settings takes the place of the drawn mark.
const { settings, name } = await useMedical()
</script>

<template>
  <CmsImage v-if="settings?.logo" :media="settings.logo" :alt="name" eager sizes="10rem" class="h-[38px] w-auto max-w-[10rem] object-contain shrink-0" />
  <svg v-else class="shrink-0" width="38" height="38" viewBox="0 0 38 38" aria-hidden="true"><rect width="38" height="38" rx="12" fill="var(--brand)" /><path d="M19 9.5c4.6 2.2 8 5.6 8 9.800 0 3.700-3 6.200-6.600 6.400L19 29.500l-1.400-3.800C14 25.500 11 23 11 19.300c0-4.200 3.400-7.600 8-9.800Z" fill="var(--brand-ink)" /><path d="M19 14v11" stroke="var(--brand)" stroke-width="1.7" stroke-linecap="round" /></svg>
  <span class="font-display text-[1.2rem] sm:text-[1.3rem] font-semibold tracking-[-0.02em] leading-[1.1]" data-wordmark>{{ tidyText(name) }}</span>
</template>
