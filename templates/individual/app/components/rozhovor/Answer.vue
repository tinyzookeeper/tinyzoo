<script setup lang="ts">
// The owner's answer under a question: their avatar (the initials of the site's name) and the
// section's heading, which this look sets as plain speech. It is the section's own heading
// (an h1 when the section opens the page), so the page has the same headings in every look.
defineProps<{ heading: string; first?: boolean; asked?: boolean; light?: boolean; avatarClass?: string }>()
const { name } = await useProfile()
</script>

<template>
  <div class="flex gap-4 items-start" :class="asked ? 'mt-6' : ''">
    <span class="avatar" :class="avatarClass" aria-hidden="true">{{ initialsOf(name) }}</span>
    <component :is="first ? 'h1' : 'h2'" class="answer pt-1" :class="light ? '!text-paper' : ''"><KitMarked :text="heading" /></component>
  </div>
</template>
