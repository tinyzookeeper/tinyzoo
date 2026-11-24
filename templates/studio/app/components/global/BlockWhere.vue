<script setup lang="ts">
// Block "where": the address from Site settings and the way there. Drawn by components/<look>/Where.vue.
defineProps<{ block: BlockOf<'where'>; index?: number }>()
</script>

<template>
  <LookPart part="Where" :first="index === 0" :block="block" :anchor="anchorOf('where')" />
</template>
