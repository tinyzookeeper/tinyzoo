<script setup lang="ts">
// The name in heavy Clarendon, with what it is and where in typewriter type beside it. A logo
// uploaded in Site settings takes the place of the name. `size` is the header's or the mobile
// menu's; `mark` is for the one that carries `data-wordmark` (the header's).
withDefaults(defineProps<{ size?: 'header' | 'panel'; mark?: boolean; tagline?: boolean }>(), { size: 'header' })
const { settings, name } = await useRestaurant()
const sizes = computed(() => byLength(name.value, [[12, 'text-[2.3rem] lg:text-[2.6rem]'], [24, 'text-[1.5rem] lg:text-[1.7rem]']], 'text-[1.15rem] lg:text-[1.3rem]'))
const place = computed(() => [taglineWithAnd(settings.value?.tagline), settings.value?.city].filter(Boolean).join(', '))
</script>

<template>
  <CmsImage v-if="settings?.logo" :media="settings.logo" :alt="name" eager sizes="12rem" class="w-auto max-w-[12rem] object-contain h-[40px]" :data-wordmark="mark ? '' : undefined" />
  <span v-else class="h min-w-0 [overflow-wrap:anywhere]" :class="size === 'header' ? sizes : 'text-[2.3rem]'" :data-wordmark="mark ? '' : undefined">{{ name }}</span>
  <span v-if="tagline && place && name.length <= 12" class="hidden sm:inline text-[.95rem] whitespace-nowrap">{{ place }}</span>
</template>
