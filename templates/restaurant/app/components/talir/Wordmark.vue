<script setup lang="ts">
// The name in expanded black capitals, with what it is and where in condensed ones beside it. A
// logo uploaded in Site settings takes the place of the name. `size` is the header's or the mobile
// menu's; `mark` is for the one that carries `data-wordmark` (the header's).
withDefaults(defineProps<{ size?: 'header' | 'panel'; mark?: boolean; tagline?: boolean }>(), { size: 'header' })
const { settings, name } = await useRestaurant()
// A longer name steps down in size and drops the tagline beside it, and may wrap, so it never pushes the menu off the screen.
const sizes = computed(() => byLength(name.value, [[12, 'text-[1.9rem] lg:text-[2.1rem] !tracking-[-.02em]'], [24, 'text-[1.25rem] lg:text-[1.5rem]']], 'text-[1rem] lg:text-[1.15rem]'))
const place = computed(() => [taglineWithAnd(settings.value?.tagline), settings.value?.city].filter(Boolean).join(', '))
</script>

<template>
  <CmsImage v-if="settings?.logo" :media="settings.logo" :alt="name" eager sizes="12rem" class="w-auto max-w-[12rem] object-contain h-[40px]" :data-wordmark="mark ? '' : undefined" />
  <span v-else class="wide min-w-0 [overflow-wrap:anywhere]" :class="size === 'header' ? sizes : 'text-[1.9rem]'" :data-wordmark="mark ? '' : undefined">{{ name }}</span>
  <span v-if="tagline && place && name.length <= 12" class="cap hidden sm:inline whitespace-nowrap">{{ place }}</span>
</template>
