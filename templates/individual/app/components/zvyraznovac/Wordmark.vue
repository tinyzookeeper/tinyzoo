<script setup lang="ts">
// The name in the header and the footer, set in the heaviest weight. A logo uploaded in Site
// settings takes its place in the header.
defineProps<{ footer?: boolean }>()
const { settings, name } = await useProfile()
</script>

<template>
  <CmsImage v-if="settings?.logo && !footer" :media="settings.logo" :alt="name" eager sizes="12rem" class="h-9 w-auto max-w-[12rem] object-contain" />
  <span v-else class="font-black tracking-[-0.04em] leading-none" :class="footer ? 'text-[1.45rem]' : 'text-[1.3rem] lg:text-[1.45rem]'" data-wordmark>{{ name }}</span>
</template>
