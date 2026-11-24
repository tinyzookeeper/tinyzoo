<script setup lang="ts">
// The name of the event: a lit diode and the name in heavy type. A logo uploaded in Site
// settings takes the name's place. `large` is the footer's.
defineProps<{ large?: boolean }>()
const { settings, name } = await useEvent()
// The design's size for its own short name; a longer name steps down and may take two lines beside the menu's button.
const size = computed(() => byLength(name.value, [[14, 'text-[1.35rem] leading-none'], [30, 'text-base leading-[1.1]']], 'text-[0.85rem] leading-[1.1] line-clamp-2'))
</script>

<template>
  <span class="flex items-center gap-2.5 min-w-0">
    <span class="w-2.5 h-2.5 rounded-full bg-led shrink-0" aria-hidden="true" />
    <CmsImage v-if="settings?.logo" :media="settings.logo" :alt="name" eager sizes="12rem" class="w-auto max-w-[12rem] object-contain" :class="large ? 'h-9' : 'h-7'" data-wordmark />
    <span v-else class="font-black tracking-[-0.03em] min-w-0" :class="large ? 'text-2xl leading-none' : size" data-wordmark>{{ name }}</span>
  </span>
</template>
