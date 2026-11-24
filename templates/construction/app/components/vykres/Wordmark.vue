<script setup lang="ts">
// The firm's mark and its name: a small drawn house (a logo uploaded in Site settings takes its
// place) and the name in the expanded light family.
const { settings, name } = await useFirm()
</script>

<template>
  <CmsImage v-if="settings?.logo" :media="settings.logo" alt="" eager sizes="8rem" class="h-6 shrink-0 w-auto max-w-[8rem] object-contain" />
  <svg v-else viewBox="0 0 34 24" class="h-6 w-[34px] shrink-0" aria-hidden="true"><path d="M1 23h32" stroke="currentColor" stroke-width="1" /><path d="M6 23V11L17 3l11 8v12" fill="none" stroke="currentColor" stroke-width="2" /><path d="M6 11h22" stroke="var(--brand)" stroke-width="2" /></svg>
  <span class="min-w-0 font-display font-medium tracking-[-.01em]" :class="byLength(name, [[18, 'text-[19px]'], [32, 'text-[15px] leading-[1.15]']], 'text-[13px] leading-[1.15]')" data-wordmark>{{ name }}</span>
</template>
