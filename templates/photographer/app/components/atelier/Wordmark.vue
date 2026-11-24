<script setup lang="ts">
// The site's name in the look's type: the last word in italics ("Johana *Loudová*").
// A logo from the settings takes its place.
const { settings, name } = await useSite()
const words = computed(() => name.value.trim().split(/\s+/))
const lead = computed(() => words.value.slice(0, -1).join(' '))
const last = computed(() => words.value[words.value.length - 1] ?? '')
</script>

<template>
  <CmsImage v-if="settings?.logo" :media="settings.logo" :alt="name" eager sizes="12rem" class="h-[1.5em] w-auto max-w-[12rem] object-contain" />
  <span v-else data-wordmark>
    <template v-if="lead">{{ lead }} <em>{{ last }}</em></template>
    <template v-else>{{ last }}</template>
  </span>
</template>
