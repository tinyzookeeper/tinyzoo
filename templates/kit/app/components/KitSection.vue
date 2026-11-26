<script setup lang="ts">
// The frame of one of the kit's sections (Text and picture, Questions): the look's own Text part
// with the section's heading, and the section's content inside `.kit-section-body`. The container,
// the space above and below and the heading are the look's; the settings every section has
// (a narrow width, close to the section above) are the kit's, in the rules below.
// KitEntries is the frame of Cards and has the same two rules for itself.
// Beside KitEntries' variables, a look may set `--custom-close` (the space kept above a section
// close to the one above; 0 when left out) and `--custom-center: auto` (the narrow columns stand in
// the middle, for a look that centres its headings).
defineProps<{
  /** The section's id on the page. */
  id: string
  heading: string
  narrow?: boolean
  close?: boolean
}>()
</script>

<template>
  <LookPart :id="id" part="Text" :block="{ heading, body: null }" :first="false" class="kit-section" :class="{ 'kit-section-narrow': narrow, 'kit-section-close': close }" :aria-label="heading || undefined">
    <div class="kit-section-body">
      <slot />
    </div>
  </LookPart>
</template>

<style>
/* Every rule starts with .kit-section and names two more classes: a look's own rules
   (html[data-look="…"] .prose-look h3) must not move the kit's spacing. */
.kit-section .kit-section-body { container-type: inline-size; }
/* narrow: the content is at most a readable width, at the left like the look's own text */
.kit-section.kit-section-narrow .kit-section-body { max-width: 44rem; margin-inline: var(--custom-center, 0); }
/* close: no space above. A look keeps that space as padding on its Text root (most), on the first
   element inside it (Software's wrapper) or as a margin or a line on it, so one rule clears the
   padding, the margin and the line of the root and of its first child. A look that keeps its space
   above a section only (none below) sets --custom-close, so the two sections do not touch. */
.kit-section.kit-section-close,
.kit-section.kit-section-close > :first-child { padding-top: 0; margin-top: 0; border-top-width: 0; }
.kit-section.kit-section-close.kit-section-close { padding-top: var(--custom-close, 0); }
</style>
