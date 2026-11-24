<script setup lang="ts">
// The magazine's name in lowercase beside a clock face at a quarter past, or the logo uploaded in
// Site settings in its place. `size` is the dial's width (a class) and `text` the name's size classes.
// (The header's name is what the cloud measures: data-wordmark; the footer's is not marked.)
const props = withDefaults(defineProps<{ size?: string; text?: string; heading?: boolean; marked?: boolean }>(), { size: '[--size:2.1rem]', text: 'text-[1.9rem] lg:text-[2.3rem]', heading: false, marked: false })
const { settings, name } = await useBlog()
</script>

<template>
  <span class="flex items-center gap-3">
    <span class="dial" :class="size" style="--m:15" aria-hidden="true" />
    <CmsImage v-if="settings?.logo" :media="settings.logo" :alt="name" eager sizes="12rem" class="h-[1.2em] w-auto max-w-[12rem] object-contain" :class="text" :data-wordmark="marked ? '' : undefined" />
    <component :is="heading ? 'h1' : 'span'" v-else class="font-black lowercase leading-none tracking-[-0.045em]" :class="text" :data-wordmark="marked ? '' : undefined">{{ name }}</component>
  </span>
</template>
