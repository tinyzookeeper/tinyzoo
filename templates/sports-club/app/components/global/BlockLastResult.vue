<script setup lang="ts">
// Block "lastResult": the last result of the main team, its last five matches and its place in
// the table. Drawn by components/<look>/LastResult.vue.
defineProps<{ block: BlockOf<'lastResult'>; index?: number }>()
const last = await useLastResult()
</script>

<template>
  <LookPart part="LastResult" :first="index === 0" :block="block" :last="last" />
</template>
