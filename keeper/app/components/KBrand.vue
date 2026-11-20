<script setup lang="ts">
// Keeper's mark and wordmark, swapped for the reversed files in dark mode. `signature` adds
// tinyzoo's own logo after it, quietly and at the size the tinyzoo admin signs with (mascot
// h-3, wordmark h-2.5, 70 %), so it is clear which family Keeper belongs to. Decorative:
// the place it sits in names it (a link's aria-label, a heading, an sr-only line).
import mark from '../assets/brand/logo/mark.svg?url'
import markReversed from '../assets/brand/logo/mark-reversed.svg?url'
import wordmark from '../assets/brand/logo/wordmark.svg?url'
import wordmarkReversed from '../assets/brand/logo/wordmark-reversed.svg?url'
import tzMascot from '../assets/brand/tinyzoo/mascot.svg?url'
import tzMascotReversed from '../assets/brand/tinyzoo/mascot-reversed.svg?url'
import tzWordmark from '../assets/brand/tinyzoo/wordmark.svg?url'
import tzWordmarkReversed from '../assets/brand/tinyzoo/wordmark-reversed.svg?url'

withDefaults(defineProps<{ signature?: boolean }>(), { signature: false })
</script>

<template>
  <span class="inline-flex items-center gap-2" aria-hidden="true">
    <span class="inline-flex items-center gap-1">
      <img :src="mark" alt="" draggable="false" class="h-3.5 w-auto select-none dark:hidden">
      <img :src="markReversed" alt="" draggable="false" class="hidden h-3.5 w-auto select-none dark:block">
      <!-- The wordmark's box runs to the p's descender, so it drops a little to sit level with the mark. -->
      <img :src="wordmark" alt="" draggable="false" class="h-3 w-auto translate-y-0.5 select-none dark:hidden">
      <img :src="wordmarkReversed" alt="" draggable="false" class="hidden h-3 w-auto translate-y-0.5 select-none dark:block">
    </span>
    <span v-if="signature" class="inline-flex items-center gap-1.5 opacity-70">
      <span class="text-[10px] text-dimmed">·</span>
      <img :src="tzMascot" alt="" draggable="false" class="h-3 w-auto select-none dark:hidden">
      <img :src="tzMascotReversed" alt="" draggable="false" class="hidden h-3 w-auto select-none dark:block">
      <img :src="tzWordmark" alt="" draggable="false" class="h-2.5 w-auto select-none dark:hidden">
      <img :src="tzWordmarkReversed" alt="" draggable="false" class="hidden h-2.5 w-auto select-none dark:block">
    </span>
  </span>
</template>
