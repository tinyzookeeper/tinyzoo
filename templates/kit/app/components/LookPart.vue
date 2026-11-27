<script setup lang="ts">
// One part of the website in the site's look: `part="Hero"` draws the template's
// components/<look>/Hero.vue, whichever look the site's settings name. Everything else given
// to it (the block, the data) goes on to that component.
//
// Every look has the same parts with the same props: that is what lets a site change its look
// and keep its content. A part missing from a look is a mistake of the template, said in
// development.
//
// Each part is loaded on its own, only when a page of its look needs it (app/utils/design.ts).
// It is loaded before this component draws, on the server and in the browser alike, so the
// page the browser takes over is the one the server sent.
import type { Component } from 'vue'

defineOptions({ inheritAttrs: false })
const props = defineProps<{ part: string }>()
const design = useDesign()
const look = await useLookId()
const component = shallowRef<Component | null>(await design.loadPart(look.value, props.part))
if (!component.value && import.meta.dev) console.warn(`[look] ${design.id}: components/${look.value}/${props.part}.vue is missing`)
// The admin's live preview changes the look in place: the new look's part takes over once it has loaded.
watch(look, async (id) => { component.value = await design.loadPart(id, props.part) })
</script>

<template>
  <component :is="component" v-if="component" v-bind="$attrs">
    <template v-if="$slots.default" #default><slot /></template>
  </component>
</template>
