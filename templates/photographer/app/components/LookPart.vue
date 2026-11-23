<script setup lang="ts">
// One part of the website in the site's look: `part="Hero"` draws components/atelier/Hero.vue,
// components/negativ/Hero.vue or components/zapisnik/Hero.vue, whichever look the site's
// settings name. Everything else given to it (the block, the data) goes on to that component.
//
// Every look has the same parts with the same props: that is what lets a site change its look
// and keep its content. A part missing from a look is a mistake of the template, said in
// development.
import type { Component } from 'vue'

defineOptions({ inheritAttrs: false })
const props = defineProps<{ part: string }>()

const files = import.meta.glob<Component>('./{atelier,negativ,zapisnik}/*.vue', { eager: true, import: 'default' })
const look = await useLookId()
const component = computed(() => {
  const found = files[`./${look.value}/${props.part}.vue`]
  if (!found && import.meta.dev) console.warn(`[look] components/${look.value}/${props.part}.vue is missing`)
  return found ?? null
})
</script>

<template>
  <component :is="component" v-if="component" v-bind="$attrs" />
</template>
