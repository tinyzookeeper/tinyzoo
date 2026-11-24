<script setup lang="ts">
// The time a service takes as small clock faces: a full circle is one hour, a second one begins
// for every hour after it.
defineProps<{ minutes: number }>()
</script>

<template>
  <span class="flex gap-[3px]" aria-hidden="true">
    <svg v-for="(fraction, i) in dialFractions(minutes)" :key="i" class="dial" viewBox="0 0 18 18">
      <circle v-if="fraction >= 1" cx="9" cy="9" r="7" fill="var(--brand)" />
      <path v-else :d="dialPath(fraction)" fill="var(--brand)" />
      <circle cx="9" cy="9" r="7.5" fill="none" stroke="var(--ink)" stroke-width="1" />
    </svg>
  </span>
</template>
