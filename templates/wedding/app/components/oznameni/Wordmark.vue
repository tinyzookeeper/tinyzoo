<script setup lang="ts">
// The couple's monogram: "A & Š", the ampersand in the look's italic. A monogram uploaded in
// Site settings takes its place.
const { settings, name, couple } = await useWedding()
</script>

<template>
  <CmsImage v-if="settings?.logo" :media="settings.logo" :alt="name" eager sizes="8rem" class="h-[1.6em] w-auto max-w-[8rem] object-contain" />
  <span v-else class="inline-flex items-center gap-[0.3em]" data-monogram>
    <template v-for="(letter, i) in couple.initials" :key="i"><span v-if="i" class="amp text-[0.85em]">&amp;</span>{{ letter }}</template>
  </span>
</template>
