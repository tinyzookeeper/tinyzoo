<script setup lang="ts">
// The restaurant's name set large in the serif, with what it is in small spaced capitals under
// it. A logo uploaded in Site settings takes the place of the name. `size` is the header's, the
// mobile menu's or the footer's; `mark` is for the one that carries `data-wordmark` (the header's).
withDefaults(defineProps<{ size?: 'header' | 'panel' | 'footer'; mark?: boolean; tagline?: boolean }>(), { size: 'header' })
const { settings, name } = await useRestaurant()
// A longer name steps down in size and may wrap, so it never pushes the menu's button off the screen.
const SIZES = computed(() => ({
  header: byLength(name.value, [[12, 'text-[2.5rem] lg:text-[2.9rem]'], [24, 'text-[1.7rem] lg:text-[2.1rem]']], 'text-[1.3rem] lg:text-[1.6rem]'),
  panel: byLength(name.value, [[12, 'text-[2.5rem]'], [24, 'text-[1.7rem]']], 'text-[1.3rem]'),
  footer: byLength(name.value, [[12, 'text-[3rem]'], [24, 'text-[2rem]']], 'text-[1.5rem]'),
}))
</script>

<template>
  <CmsImage v-if="settings?.logo" :media="settings.logo" :alt="name" eager sizes="12rem" class="w-auto max-w-[12rem] object-contain" :class="size === 'footer' ? 'h-[52px]' : 'h-[44px]'" :data-wordmark="mark ? '' : undefined" />
  <span v-else class="block font-display font-medium leading-none" :class="[SIZES[size], 'min-w-0 [overflow-wrap:anywhere]', size === 'header' ? 'tracking-[-.01em]' : '']" :data-wordmark="mark ? '' : undefined">{{ name }}</span>
  <span v-if="tagline && settings?.tagline" class="label block text-brand text-[.62rem]" :class="size === 'footer' ? 'mt-2' : 'mt-1.5'">{{ settings.tagline }}</span>
</template>
