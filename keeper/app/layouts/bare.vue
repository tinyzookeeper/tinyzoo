<script setup lang="ts">
import mascot from '../assets/brand/logo/mascot.svg?url'
import mascotReversed from '../assets/brand/logo/mascot-reversed.svg?url'
</script>

<template>
  <div class="flex min-h-dvh flex-col bg-(--k-moment-bg)">
    <main class="flex flex-1 items-start justify-center px-4 pt-14 pb-10 sm:items-center sm:pt-10">
      <div class="w-full max-w-sm">
        <slot />
      </div>
    </main>
    <footer class="flex items-center justify-center gap-1.5 pb-6 text-xs text-(--k-moment-text)">
      <span class="font-semibold text-highlighted">Keeper</span>
      <span aria-hidden="true">·</span>
      <img :src="mascot" alt="" class="h-3.5 w-auto dark:hidden">
      <img :src="mascotReversed" alt="" class="hidden h-3.5 w-auto dark:inline">
      <span>tinyzoo</span>
    </footer>
  </div>
</template>
