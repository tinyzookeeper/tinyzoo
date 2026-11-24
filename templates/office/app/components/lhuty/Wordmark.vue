<script setup lang="ts">
// Lhůty's name: a small ruler mark (a logo from Site settings takes its place), the name in
// Plex Serif and, under it, a line in small mono capitals.
const { settings, name } = await useOffice()
</script>

<template>
  <CmsImage v-if="settings?.logo" :media="settings.logo" alt="" eager sizes="6rem" class="h-[26px] w-auto max-w-24 object-contain" />
  <svg v-else width="26" height="22" viewBox="0 0 26 22" aria-hidden="true" class="text-brand"><path d="M1 22V2M7 22v-8M13 22V8M19 22v-8M25 22V2" stroke="currentColor" stroke-width="2" /></svg>
  <span class="leading-tight">
    <span class="block font-display text-[21px] font-medium" data-wordmark>{{ name }}</span>
    <span v-if="settings?.tagline" class="block font-mono text-[11px] uppercase tracking-[.12em] text-quiet">{{ settings.tagline }}</span>
  </span>
</template>
