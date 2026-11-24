<script setup lang="ts">
// The project's mark and name: a half sun over a line of ground, unless a mark is uploaded in
// Site settings; then the name in the serif.
const { settings, name } = await useSite()
</script>

<template>
  <span class="flex items-center gap-2.5 min-h-11 min-w-0">
    <CmsImage v-if="settings?.logo" :media="settings.logo" alt="" eager sizes="3rem" class="h-[34px] w-auto shrink-0" />
    <svg v-else class="shrink-0" width="34" height="34" viewBox="0 0 34 34" aria-hidden="true"><path d="M3 21a14 14 0 0 1 28 0z" fill="var(--sun)" /><path d="M1 25.5h32" stroke="var(--brand)" stroke-width="2" stroke-linecap="round" /><path d="M8 30h18" stroke="var(--brand)" stroke-width="2" stroke-linecap="round" /></svg>
    <span class="serif leading-none sm:whitespace-nowrap min-w-0" :class="byLength(name, [[16, 'text-[1.7rem]'], [30, 'text-[1.4rem]']], 'text-[1.2rem]')" data-wordmark>{{ name }}</span>
  </span>
</template>
