<script setup lang="ts">
// Block "courses": the courses that open for sign-up (Deka colours each by its kind). Drawn by
// components/<look>/Courses.vue.
defineProps<{ block: BlockOf<'courses'>; index?: number }>()
// (both asked for before the first wait: after one, Nuxt no longer knows which request this is)
const [courses, kinds] = await Promise.all([useCourses(), useKinds()])
</script>

<template>
  <LookPart part="Courses" :first="index === 0" :block="block" :courses="courses" :kinds="kinds" :anchor="anchorOf('courses')" />
</template>
