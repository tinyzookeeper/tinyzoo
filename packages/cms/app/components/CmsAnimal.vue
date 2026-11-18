<script setup lang="ts">
// One of tinyzoo's animals at a moment (cmsCharacter: 'owl', 'hedgehog'…). Decorative: hidden from
// screen readers, never focusable, sized by the class it is given (`h-20 w-auto`), like an <img>.
//
// tinyzoo's own look and the built-in accents: the drawn file as an <img>, the colourful family as
// always. A brand colour: the same drawing inline, its body and face taken from --cms-animal-body and
// --cms-animal-face (src/theme.ts writes them with the accent), so the server renders it in the brand's
// shade with no flash and it follows light and dark mode. Whether animals are shown at all
// (`cms.admin.animals`) is the caller's choice: it leaves out the animal and its room together.
const props = withDefaults(defineProps<{
  name: string
  set?: 'muted' | 'bright'
  /** Draw it in the brand's colours. Default: when the admin's accent is a brand colour (the design-system page sets it itself). */
  tint?: boolean
}>(), { set: 'muted', tint: undefined })

const theme = props.tint === undefined ? useCmsAdminTheme() : null
const tinted = computed(() => props.tint ?? theme?.value.accent.kind === 'brand')
const character = computed(() => cmsCharacter(props.name, props.set))

// Loaded before the first render (the server and the hydrating browser draw the same thing);
// a later change of animal or accent keeps the last drawing until the next one is there.
const drawing = shallowRef(tinted.value ? await cmsAnimalDrawing(props.name, props.set) : null)
watch([tinted, () => props.name, () => props.set], async ([on, name, set]) => {
  const next = on ? await cmsAnimalDrawing(name, set) : null
  if (tinted.value === on && props.name === name && props.set === set) drawing.value = next
})
</script>

<template>
  <!-- eslint-disable-next-line vue/no-v-html -- tinyzoo's own animal files, fills replaced by classes (src/themeAnimals.ts) -->
  <svg v-if="tinted && drawing" :viewBox="drawing.viewBox" xmlns="http://www.w3.org/2000/svg" class="cms-animal select-none" aria-hidden="true" focusable="false" :data-character="character.name" v-html="drawing.inner" />
  <img v-else :src="character.url" alt="" class="select-none" draggable="false" :data-character="character.name">
</template>
