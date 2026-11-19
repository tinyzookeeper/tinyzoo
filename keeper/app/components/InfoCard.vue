<script setup lang="ts">
defineProps<{ title: string; icon: string }>()
</script>

<template>
  <section class="rounded-xl border border-default bg-default p-4 sm:p-5">
    <header class="mb-3 flex items-center gap-2">
      <span class="inline-flex size-7 items-center justify-center rounded-lg bg-elevated text-toned">
        <UIcon :name="icon" class="size-4" />
      </span>
      <h2 class="text-sm font-semibold text-highlighted">{{ title }}</h2>
      <div class="ml-auto"><slot name="aside" /></div>
    </header>
    <slot />
  </section>
</template>
