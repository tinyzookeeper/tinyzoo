<script setup lang="ts">
// The time rail beside a section: an icon for the hour, the time, and a few words under it. A
// section without a time keeps the column (and its rule) empty, so the content stays aligned.
defineProps<{ time?: string | null; note?: string | null }>()
</script>

<template>
  <div class="rail">
    <p v-if="time" class="rail-in"><UIcon :name="momentIcon(time)" class="size-[22px]" aria-hidden="true" /><span class="time">{{ time }}</span><span v-if="note" class="what">{{ note }}</span></p>
  </div>
</template>
