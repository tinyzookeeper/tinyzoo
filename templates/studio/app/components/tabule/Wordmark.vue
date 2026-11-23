<script setup lang="ts">
// The studio's name in wide capitals. A logo uploaded in Site settings takes its place.
const { settings, name } = await useStudio()
</script>

<template>
  <CmsImage v-if="settings?.logo" :media="settings.logo" :alt="name" eager sizes="12rem" class="h-9 w-auto max-w-[12rem] object-contain" data-wordmark />
  <span v-else data-wordmark>{{ name }}</span>
</template>
