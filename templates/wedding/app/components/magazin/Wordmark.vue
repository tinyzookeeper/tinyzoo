<script setup lang="ts">
// The couple's monogram: "A a Š", the word between the initials in the look's italic tone. A
// monogram uploaded in Site settings takes its place.
const { settings, name, couple, words } = await useWedding()
</script>

<template>
  <CmsImage v-if="settings?.logo" :media="settings.logo" :alt="name" eager sizes="8rem" class="h-[1.9em] w-auto max-w-[8rem] object-contain" />
  <span v-else data-monogram>
    <template v-for="(letter, i) in couple.initials" :key="i"><template v-if="i">&thinsp;<em class="text-brand">{{ words.and }}</em>&thinsp;</template>{{ letter }}</template>
  </span>
</template>
