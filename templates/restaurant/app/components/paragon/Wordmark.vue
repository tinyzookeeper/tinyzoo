<script setup lang="ts">
// The name in heavy Clarendon, with what it is and where in typewriter type beside it. A logo
// uploaded in Site settings takes the place of the name. `size` is the header's or the mobile
// menu's; `mark` is for the one that carries `data-wordmark` (the header's).
withDefaults(defineProps<{ size?: 'header' | 'panel'; mark?: boolean; tagline?: boolean }>(), { size: 'header' })
const { settings, name } = await useRestaurant()
const place = computed(() => [taglineWithAnd(settings.value?.tagline), settings.value?.city].filter(Boolean).join(', '))
</script>

<template>
  <CmsImage v-if="settings?.logo" :media="settings.logo" :alt="name" eager sizes="12rem" class="w-auto max-w-[12rem] object-contain h-[40px]" :data-wordmark="mark ? '' : undefined" />
  <span v-else class="h" :class="size === 'header' ? 'text-[2.3rem] lg:text-[2.6rem]' : 'text-[2.3rem]'" :data-wordmark="mark ? '' : undefined">{{ name }}</span>
  <span v-if="tagline && place" class="hidden sm:inline text-[.95rem] whitespace-nowrap">{{ place }}</span>
</template>
