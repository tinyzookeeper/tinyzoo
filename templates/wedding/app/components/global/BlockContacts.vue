<script setup lang="ts">
// Block "contacts": who to call on the day. Drawn by components/<look>/Contacts.vue.
defineProps<{ block: BlockOf<'contacts'>; index?: number }>()
const items = await useContacts()
</script>

<template>
  <LookPart part="Contacts" :first="index === 0" :block="block" :items="items" :anchor="anchorOf('contacts')" />
</template>
