<script setup lang="ts">
// Keeper's mark alone (the keeper in the safari helmet), sized by a height class (`h-20`).
// It follows the colour mode; `reversed` forces the cream version, e.g. on a charcoal card.
import mark from '../assets/brand/logo/mark.svg?url'
import markReversed from '../assets/brand/logo/mark-reversed.svg?url'

defineProps<{ reversed?: boolean }>()
</script>

<template>
  <span class="flex w-fit" aria-hidden="true">
    <img v-if="reversed" :src="markReversed" alt="" draggable="false" class="h-full w-auto select-none">
    <template v-else>
      <img :src="mark" alt="" draggable="false" class="h-full w-auto select-none dark:hidden">
      <img :src="markReversed" alt="" draggable="false" class="hidden h-full w-auto select-none dark:block">
    </template>
  </span>
</template>
