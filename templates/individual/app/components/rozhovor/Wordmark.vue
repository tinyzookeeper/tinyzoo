<script setup lang="ts">
// The name in the header and the footer: a small rounded speech-bubble mark and the name in
// the display face. A logo uploaded in Site settings takes the place of both in the header.
defineProps<{ footer?: boolean }>()
const { settings, name } = await useProfile()
</script>

<template>
  <CmsImage v-if="settings?.logo && !footer" :media="settings.logo" :alt="name" eager sizes="12rem" class="h-9 w-auto max-w-[12rem] object-contain" />
  <span v-else class="inline-flex items-center gap-3">
    <span class="w-[1.15rem] h-[1.15rem] bg-brand rounded-[0.45rem_0.45rem_0.45rem_0.1rem]" aria-hidden="true" />
    <span class="serif text-ink font-bold tracking-[-0.03em] leading-none" :class="footer ? 'text-[1.5rem]' : 'text-[1.35rem] lg:text-[1.5rem]'" data-wordmark>{{ name }}</span>
  </span>
</template>
