<script setup lang="ts">
// The site's name in the look's serif, with a dot of the brand colour in front; a logo from
// the settings takes its place.
const { settings, name } = await useSite()
</script>

<template>
  <CmsImage v-if="settings?.logo" :media="settings.logo" :alt="name" eager sizes="12rem" class="h-[1.6em] w-auto max-w-[12rem] object-contain" />
  <span v-else class="inline-flex items-center gap-2.5"><span class="w-[0.62em] h-[0.62em] rounded-full bg-brand shrink-0" aria-hidden="true" /><span data-wordmark>{{ name }}</span></span>
</template>
