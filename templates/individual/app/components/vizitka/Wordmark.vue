<script setup lang="ts">
// The name in the header and the footer: set in the display serif. A logo uploaded in Site
// settings takes its place (the footer's is the owner's name again, as the design has it).
defineProps<{ footer?: boolean }>()
const { settings, name } = await useProfile()
</script>

<template>
  <CmsImage v-if="settings?.logo && !footer" :media="settings.logo" :alt="name" eager sizes="12rem" class="h-9 w-auto max-w-[12rem] object-contain" />
  <span v-else class="serif text-ink font-semibold tracking-[-0.015em] leading-none" :class="footer ? 'text-[1.6rem]' : 'text-[1.45rem] lg:text-[1.6rem]'" data-wordmark>{{ name }}</span>
</template>
