<script setup lang="ts">
// The magazine's name, or the logo uploaded in Site settings in its place.
const { settings, name } = await useBlog()
</script>

<template>
  <CmsImage v-if="settings?.logo" :media="settings.logo" :alt="name" eager sizes="12rem" class="h-[1em] w-auto max-w-[12rem] object-contain" />
  <template v-else>{{ name }}</template>
</template>
