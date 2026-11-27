<script setup lang="ts">
// The button of a section: in the look's own main button (its `button` classes), else a plain link
// with an arrow, for a look that has no button of its own. `field` names the block's field of its
// text, for the editor in the preview (cmsField): the text is then typed right in the page. `external`
// is passed on to the link; with `to` empty a span of the same classes is drawn (a card's sample).
defineProps<{ to: string; label: string; field?: string; external?: boolean }>()
const classes = await useLookButton()
</script>

<template>
  <span v-if="to === ''" class="kit-btn" :class="classes || 'kit-btn-plain'" v-bind="field ? cmsField(field) : {}">{{ label }}</span>
  <NuxtLink v-else :to="to" class="kit-btn" :class="classes || 'kit-btn-plain'" :external="external || undefined" v-bind="field ? cmsField(field) : {}">{{ label }}</NuxtLink>
</template>

<style>
.kit-section .kit-section-body .kit-btn { display: inline-flex; align-items: center; justify-content: center; margin-top: 1.75rem; max-width: 100%; text-align: center; overflow-wrap: anywhere; }
.kit-section .kit-section-body .kit-btn-plain { display: inline-block; text-align: left; color: inherit; text-decoration: underline; text-decoration-thickness: 1px; text-underline-offset: 0.2em; font-weight: 600; }
.kit-section .kit-section-body .kit-btn-plain::after { content: ' \2192'; }
.kit-section .kit-section-body .kit-btn-plain:focus-visible { outline: 2px solid currentColor; outline-offset: 4px; border-radius: 2px; }
</style>
