<script setup lang="ts">
// The product's mark (a lamp, half in the evening colour) and its name. A logo uploaded in Site
// settings takes the place of the drawn mark.
const { settings, name } = await useSoftware()
</script>

<template>
  <CmsImage v-if="settings?.logo" :media="settings.logo" :alt="name" eager sizes="8rem" class="h-7 w-auto max-w-[8rem] object-contain" />
  <svg v-else viewBox="0 0 24 24" class="h-7 w-7" aria-hidden="true"><circle cx="12" cy="12" r="11" fill="var(--lamp)" /><path d="M12 1a11 11 0 0 1 0 22z" fill="var(--brand)" /></svg>
  <span class="font-display text-[27px] font-bold leading-none" data-wordmark>{{ name }}</span>
</template>
