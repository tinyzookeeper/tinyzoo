<script setup lang="ts">
// The project's mark and name: a drawn orchard (two trees in a square, as on a plan) unless a
// mark is uploaded in Site settings, then the name, then on a tablet the line beside it.
const { settings, name } = await useSite()
</script>

<template>
  <span class="flex items-center gap-3 min-h-11 min-w-0">
    <CmsImage v-if="settings?.logo" :media="settings.logo" alt="" eager sizes="3rem" class="h-[34px] w-auto shrink-0" />
    <svg v-else class="shrink-0" width="34" height="34" viewBox="0 0 34 34" fill="none" stroke="currentColor" stroke-width="1" aria-hidden="true"><rect x=".5" y=".5" width="33" height="33" /><circle cx="12" cy="13" r="6.5" /><circle cx="23" cy="21" r="5" /><path d="M12 13v20M23 21v12" /></svg>
    <span class="font-display leading-none tracking-tight min-w-0" :class="byLength(name, [[18, 'text-[1.45rem]'], [30, 'text-[1.25rem]']], 'text-[1.1rem]')" data-wordmark>{{ name }}</span>
    <span v-if="settings?.tagline && name.length <= 20" class="label hidden sm:inline xl:hidden shrink-0 pl-3 border-l border-line whitespace-nowrap">{{ settings.tagline }}</span>
  </span>
</template>
