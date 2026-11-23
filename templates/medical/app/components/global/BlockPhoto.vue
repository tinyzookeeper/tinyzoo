<script setup lang="ts">
// Block "photo": one wide photograph. Drawn by components/<look>/Photo.vue.
defineProps<{ block: BlockOf<'photo'>; index?: number }>()
</script>

<template>
  <LookPart part="Photo" :first="index === 0" :block="block" />
</template>
