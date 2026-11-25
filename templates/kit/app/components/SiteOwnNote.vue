<script setup lang="ts">
// For the editor in the admin's preview only; a published page never carries it (the layout
// shows it only for ?preview). It is fixed at the top of the window, so it never moves a
// look's layout and is not hidden under a header that is fixed or absolute.
defineProps<{ given: string; shown: string }>()
const words = useSiteWords()
</script>

<template>
  <p role="status" class="pointer-events-none fixed inset-x-0 top-0 z-[1000] bg-amber-100 px-4 py-1.5 text-center text-xs text-amber-900">{{ words.ownColorShown(given, shown) }}</p>
</template>
