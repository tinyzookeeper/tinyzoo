<script setup lang="ts">
// Keeper's mark and wordmark, swapped for the reversed files in dark mode. `signature` adds
// the small "· tinyzoo" that says which family Keeper belongs to. Decorative: the place it
// sits in names it (a link's aria-label, a heading).
import mark from '../assets/brand/logo/mark.svg?url'
import markReversed from '../assets/brand/logo/mark-reversed.svg?url'
import wordmark from '../assets/brand/logo/wordmark.svg?url'
import wordmarkReversed from '../assets/brand/logo/wordmark-reversed.svg?url'

withDefaults(defineProps<{ signature?: boolean; wordmark?: boolean }>(), { signature: false, wordmark: true })
</script>

<template>
  <span class="inline-flex items-center gap-1.5" aria-hidden="true">
    <img :src="mark" alt="" draggable="false" class="h-4 w-auto select-none dark:hidden">
    <img :src="markReversed" alt="" draggable="false" class="hidden h-4 w-auto select-none dark:inline">
    <template v-if="wordmark">
      <!-- The wordmark's box runs to the p's descender, so it drops a little to sit on the text's baseline. -->
      <img :src="wordmark" alt="" draggable="false" class="h-[0.9375rem] w-auto translate-y-[0.1875rem] select-none dark:hidden">
      <img :src="wordmarkReversed" alt="" draggable="false" class="hidden h-[0.9375rem] w-auto translate-y-[0.1875rem] select-none dark:inline">
    </template>
    <span v-if="signature" class="text-xs text-dimmed">· tinyzoo</span>
  </span>
</template>
