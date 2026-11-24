<script setup lang="ts">
// Block "timetable": the week's classes (the Lesson collection) with the kinds to filter by.
// Drawn by components/<look>/Timetable.vue.
defineProps<{ block: BlockOf<'timetable'>; index?: number }>()
const { slots, kinds } = await useLessonSlots()
</script>

<template>
  <LookPart part="Timetable" :first="index === 0" :block="block" :slots="slots" :kinds="kinds" :anchor="anchorOf('timetable')" />
</template>
