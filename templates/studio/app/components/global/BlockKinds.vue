<script setup lang="ts">
// Block "kinds": the kinds of classes, each with how many classes it has in the week.
// Drawn by components/<look>/Kinds.vue.
defineProps<{ block: BlockOf<'kinds'>; index?: number }>()
const { slots, kinds } = await useLessonSlots()
</script>

<template>
  <LookPart part="Kinds" :first="index === 0" :block="block" :kinds="kinds" :slots="slots" :anchor="anchorOf('kinds')" />
</template>
