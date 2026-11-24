<script setup lang="ts">
// The site's name in the look's condensed capitals; a logo from the settings takes its place.
const { settings, name } = await useSite()
</script>

<template>
  <CmsImage v-if="settings?.logo" :media="settings.logo" :alt="name" eager sizes="12rem" class="h-[1.5em] w-auto max-w-[12rem] object-contain" />
  <span v-else data-wordmark>{{ name }}</span>
</template>
