<script setup lang="ts">
// tinyzoo's mascot, in the brand's charcoal — cream with charcoal eyes in dark mode.
</script>

<template>
  <span class="inline-flex" aria-hidden="true">
    <img :src="cmsBrand.mascotUrl" alt="" class="h-full w-auto dark:hidden" draggable="false">
    <img :src="cmsBrand.mascotReversedUrl" alt="" class="h-full w-auto hidden dark:block" draggable="false">
  </span>
</template>
