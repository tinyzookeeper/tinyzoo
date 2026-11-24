<script setup lang="ts">
// The product's mark (a half-filled circle) and its name. A logo uploaded in Site settings takes
// the place of the drawn mark.
const { settings, name } = await useSoftware()
</script>

<template>
  <CmsImage v-if="settings?.logo" :media="settings.logo" :alt="name" eager sizes="8rem" class="h-[22px] w-auto max-w-[8rem] object-contain" />
  <svg v-else viewBox="0 0 20 20" class="h-[22px] w-[22px]" aria-hidden="true"><circle cx="10" cy="10" r="8.6" fill="none" stroke="currentColor" stroke-width="1.8" /><path d="M10 1.4a8.6 8.6 0 0 1 0 17.2z" fill="currentColor" /></svg>
  <span class="text-[21px] font-semibold tracking-[-0.02em]" data-wordmark>{{ name }}</span>
</template>
