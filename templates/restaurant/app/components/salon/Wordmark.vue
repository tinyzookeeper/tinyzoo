<script setup lang="ts">
// The restaurant's name set large in the serif, with what it is in small spaced capitals under
// it. A logo uploaded in Site settings takes the place of the name. `size` is the header's, the
// mobile menu's or the footer's; `mark` is for the one that carries `data-wordmark` (the header's).
withDefaults(defineProps<{ size?: 'header' | 'panel' | 'footer'; mark?: boolean; tagline?: boolean }>(), { size: 'header' })
const { settings, name } = await useRestaurant()
const SIZES = { header: 'text-[2.5rem] lg:text-[2.9rem]', panel: 'text-[2.5rem]', footer: 'text-[3rem]' }
</script>

<template>
  <CmsImage v-if="settings?.logo" :media="settings.logo" :alt="name" eager sizes="12rem" class="w-auto max-w-[12rem] object-contain" :class="size === 'footer' ? 'h-[52px]' : 'h-[44px]'" :data-wordmark="mark ? '' : undefined" />
  <span v-else class="block font-display font-medium leading-none" :class="[SIZES[size], size === 'header' ? 'tracking-[-.01em]' : '']" :data-wordmark="mark ? '' : undefined">{{ name }}</span>
  <span v-if="tagline && settings?.tagline" class="label block text-brand text-[.62rem]" :class="size === 'footer' ? 'mt-2' : 'mt-1.5'">{{ settings.tagline }}</span>
</template>
