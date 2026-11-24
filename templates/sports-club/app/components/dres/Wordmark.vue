<script setup lang="ts">
// Dres's mark: the club's first letter on a black square, the name in wide capitals. A crest
// uploaded in Site settings takes the square's place.
const { settings, name } = await useSite()
</script>

<template>
  <span class="flex min-w-0 items-center gap-3">
    <CmsImage v-if="settings?.logo" :media="settings.logo" :alt="name" eager sizes="8rem" class="h-10 w-auto max-w-[8rem] shrink-0 object-contain" />
    <span v-else class="wide grid h-10 w-10 shrink-0 place-items-center bg-ink text-[17px] text-paper" aria-hidden="true">{{ name[0] }}</span>
    <span class="wide min-w-0 leading-tight" :class="byLength(name, [[20, 'text-[17px] sm:text-[19px] !leading-none'], [32, 'text-[14px] sm:text-[16px]'], [40, 'text-[12px] sm:text-[14px]']], 'text-[10px] sm:text-[12px]')" data-wordmark>{{ name }}</span>
  </span>
</template>
