<script setup lang="ts">
// tinyzoo's mascot and wordmark, swapped for the reversed files in dark mode. Sized by the
// caller's height class on the mascot (`size="lg"` for the sign-in pages). Decorative: the
// link or heading it sits in names it.
import mascot from '../assets/brand/logo/mascot.svg?url'
import mascotReversed from '../assets/brand/logo/mascot-reversed.svg?url'
import wordmark from '../assets/brand/logo/wordmark.svg?url'
import wordmarkReversed from '../assets/brand/logo/wordmark-reversed.svg?url'

withDefaults(defineProps<{ size?: 'sm' | 'md' | 'lg'; markOnly?: boolean }>(), { size: 'md', markOnly: false })
const mark = { sm: 'h-4', md: 'h-6', lg: 'h-16' }
const word = { sm: 'h-3', md: 'h-[1.05rem]', lg: 'h-7' }
</script>

<template>
  <span class="inline-flex items-center" :class="size === 'lg' ? 'gap-3' : 'gap-2'" aria-hidden="true">
    <img :src="mascot" alt="" draggable="false" class="w-auto select-none dark:hidden" :class="mark[size]">
    <img :src="mascotReversed" alt="" draggable="false" class="hidden w-auto select-none dark:block" :class="mark[size]">
    <template v-if="!markOnly">
      <img :src="wordmark" alt="" draggable="false" class="w-auto select-none dark:hidden" :class="word[size]">
      <img :src="wordmarkReversed" alt="" draggable="false" class="hidden w-auto select-none dark:block" :class="word[size]">
    </template>
  </span>
</template>
