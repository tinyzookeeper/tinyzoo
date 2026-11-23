<script setup lang="ts">
// An entry with an address of its own (`ENTRY_PAGES`), drawn by the look's part the template
// names for it. A template that needs more than the entry (the other entries of a category,
// say) has a component of this name of its own.
defineProps<{ kind: string; part: string; entry: Record<string, any> }>()
</script>

<template>
  <LookPart :part="part" :entry="entry" />
</template>
