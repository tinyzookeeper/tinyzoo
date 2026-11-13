<script setup lang="ts">
// The "tinyzoo" wordmark: near-black, cream in dark mode.
</script>

<template>
  <span class="inline-flex" aria-hidden="true">
    <img :src="cmsBrand.wordmarkUrl" alt="" class="h-full w-auto dark:hidden" draggable="false">
    <img :src="cmsBrand.wordmarkReversedUrl" alt="" class="h-full w-auto hidden dark:block" draggable="false">
  </span>
</template>
