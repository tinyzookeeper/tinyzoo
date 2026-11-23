<script setup lang="ts">
// The firm's mark and its name: the cross of a laser level (a logo uploaded in Site settings
// takes its place) and the name in the heaviest weight.
const { settings, name } = await useFirm()
</script>

<template>
  <CmsImage v-if="settings?.logo" :media="settings.logo" alt="" eager sizes="8rem" class="h-5 shrink-0 w-auto max-w-[8rem] object-contain" />
  <span v-else class="relative block h-5 w-5 shrink-0" aria-hidden="true"><span class="absolute left-0 right-0 top-1/2 h-[2px] -translate-y-1/2 bg-brand" /><span class="absolute bottom-0 left-1/2 top-0 w-[2px] -translate-x-1/2 bg-brand" /></span>
  <span class="min-w-0 font-extrabold tracking-[-.03em]" :class="byLength(name, [[18, 'text-[20px]'], [32, 'text-[16px] leading-[1.1]']], 'text-[14px] leading-[1.1]')" data-wordmark>{{ name }}</span>
</template>
