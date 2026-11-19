<script setup lang="ts">
withDefaults(defineProps<{ collapsed?: boolean }>(), { collapsed: false })
</script>

<template>
  <NuxtLink to="/" class="flex items-center gap-2.5 min-w-0 rounded-md focus-visible:outline-2 focus-visible:outline-offset-2" aria-label="Keeper, all sites">
    <img src="/favicon.svg" alt="" class="size-7 shrink-0">
    <span v-if="!collapsed" class="font-display font-bold text-[17px] text-highlighted truncate">Keeper</span>
  </NuxtLink>
</template>
