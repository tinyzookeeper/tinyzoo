<script setup lang="ts">
// One part of the website in the site's look: `part="Hero"` draws the template's
// components/<look>/Hero.vue, whichever look the site's settings name. Everything else given
// to it (the block, the data) goes on to that component.
//
// Every look has the same parts with the same props: that is what lets a site change its look
// and keep its content. A part missing from a look is a mistake of the template, said in
// development.
import type { Component } from 'vue'

defineOptions({ inheritAttrs: false })
const props = defineProps<{ part: string }>()

// Every folder of the template's components is a look, except `global` (the blocks). `#site`
// is the template's folder.
const files = import.meta.glob<Component>(['#site/app/components/*/*.vue', '!#site/app/components/global/*.vue'], { eager: true, import: 'default' })
const parts = new Map(Object.entries(files).map(([file, component]) => [file.split('/').slice(-2).join('/'), component]))
const look = await useLookId()
const component = computed(() => {
  const found = parts.get(`${look.value}/${props.part}.vue`)
  if (!found && import.meta.dev) console.warn(`[look] components/${look.value}/${props.part}.vue is missing`)
  return found ?? null
})
</script>

<template>
  <component :is="component" v-if="component" v-bind="$attrs" />
</template>
