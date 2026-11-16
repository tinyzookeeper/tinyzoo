<script setup lang="ts">
// Block "Text": rich text written in the admin.
defineProps<{ block: { body?: any } }>()
</script>

<template>
  <section class="mx-auto max-w-5xl px-4 py-10">
    <CmsContent :doc="block.body" class="prose max-w-3xl" />
  </section>
</template>
