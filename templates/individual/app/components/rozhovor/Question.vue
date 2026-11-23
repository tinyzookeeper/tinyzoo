<script setup lang="ts">
// A visitor's question as this look opens a section with it: a small line above and the
// question in a speech bubble. Nothing is drawn when the block has no question.
defineProps<{ question?: string | null; kickerClass?: string }>()
const words = useSiteWords()
</script>

<template>
  <div v-if="question">
    <p class="kicker" :class="kickerClass ?? 'text-quiet'">{{ words.asked }}</p>
    <p class="bubble bubble-q mt-3">{{ czText(question) }}</p>
  </div>
</template>
