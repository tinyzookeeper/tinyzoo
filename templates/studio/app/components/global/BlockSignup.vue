<script setup lang="ts">
// Block "signup": the trial class sign-up (the Trial form of cms.config.ts). The sign-ups
// arrive in the admin. Drawn by components/<look>/Signup.vue, its fields by <TrialFields>.
defineProps<{ block: BlockOf<'signup'>; index?: number }>()
// (all asked for before the first wait: after one, Nuxt no longer knows which request this is)
const [form, { slots }] = await Promise.all([useSiteForm('trial', DEFAULT_LANGUAGE), useLessonSlots()])
</script>

<template>
  <LookPart part="Signup" :first="index === 0" :block="block" :form="form" :slots="slots" :anchor="anchorOf('signup')" />
</template>
