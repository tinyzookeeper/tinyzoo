<script setup lang="ts">
// The salon's name in capitals with wide tracking, painted on the glass (a cream fill and a hard
// shade to the lower right). A logo uploaded in Site settings takes its place. `large` is the
// footer's.
defineProps<{ large?: boolean }>()
const { settings, name } = await useSalon()
</script>

<template>
  <CmsImage v-if="settings?.logo" :media="settings.logo" :alt="name" eager sizes="12rem" class="w-auto max-w-[12rem] object-contain" :class="large ? 'h-16' : 'h-9'" :data-wordmark="large ? undefined : ''" />
  <span
    v-else class="block font-display uppercase text-cream leading-none tracking-[.3em] pl-[.3em] lettering"
    :class="large
      ? byLength(name, [[10, 'text-[34px] sm:text-[64px]']], 'text-[22px] sm:text-[36px] tracking-[.2em]')
      : byLength(name, [[10, 'text-[22px] md:text-[30px]'], [24, 'text-[15px] md:text-[18px] tracking-[.2em]']], 'text-[13px] md:text-[14px] tracking-[.12em]')" :data-wordmark="large ? undefined : ''"
  >{{ name }}</span>
</template>
