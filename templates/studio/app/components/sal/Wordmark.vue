<script setup lang="ts">
// The studio's name in the display serif, with what it is (the tagline) small beside it. A logo
// uploaded in Site settings takes the place of the name. `plain` leaves the tagline out (the phone menu).
defineProps<{ plain?: boolean }>()
const { settings, name } = await useStudio()
</script>

<template>
  <CmsImage v-if="settings?.logo" :media="settings.logo" :alt="name" eager sizes="12rem" class="h-9 w-auto max-w-[12rem] object-contain" data-wordmark />
  <template v-else>
    <span class="font-display text-[1.75rem] leading-none" data-wordmark>{{ name }}</span>
    <span v-if="settings?.tagline && !plain" class="label hidden sm:inline">{{ settings.tagline }}</span>
  </template>
</template>
