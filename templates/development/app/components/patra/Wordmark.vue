<script setup lang="ts">
// The project's mark and name: four bars stacked like floors, the top one set back (the brand
// colour), unless a mark is uploaded in Site settings; then the name in the serif.
const { settings, name } = await useSite()
</script>

<template>
  <span class="flex items-center gap-3 min-h-11 min-w-0">
    <CmsImage v-if="settings?.logo" :media="settings.logo" alt="" eager sizes="3rem" class="h-[26px] w-auto shrink-0" />
    <svg v-else class="shrink-0" width="26" height="26" viewBox="0 0 26 26" aria-hidden="true" fill="var(--brand)"><rect x="5" y="1" width="16" height="3.5" rx="1" /><rect x="0" y="8" width="26" height="3.5" rx="1" /><rect x="0" y="15" width="26" height="3.5" rx="1" /><rect x="0" y="22" width="26" height="3.5" rx="1" /></svg>
    <span class="serif leading-none min-w-0" :class="byLength(name, [[16, 'text-[1.75rem]'], [28, 'text-[1.4rem]']], 'text-[1.2rem]')" data-wordmark>{{ name }}</span>
  </span>
</template>
