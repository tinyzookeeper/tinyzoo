<script setup lang="ts">
import type { ComponentPublicInstance } from 'vue'
// The frame of one of the kit's sections (Text and picture, Questions): the look's own Text part
// with the section's heading, and the section's content inside `.kit-section-body`. The container,
// the space above and below and the heading are the look's; the settings every section has
// (a narrow width, close to the section above) are the kit's, in the rules below.
// KitEntries is the frame of Cards and has the same two rules for itself. The heading is marked for the
// editor in the preview (useFrameHeading), so it is typed right in the page.
// Beside KitEntries' variables, a look may set `--custom-close` (the space kept above a section
// close to the one above; 0 when left out) and `--custom-center: auto` (the narrow columns stand in
// the middle, for a look that centres its headings).
const frame = ref<ComponentPublicInstance | null>(null)
const body = ref<HTMLElement | null>(null)
useFrameHeading(frame, body)
defineProps<{
  /** The section's id on the page. */
  id: string
  heading: string
  narrow?: boolean
  close?: boolean
}>()
</script>

<template>
  <LookPart ref="frame" :id="id" part="Text" :block="{ heading, body: null }" :first="false" class="kit-section" :class="{ 'kit-section-narrow': narrow, 'kit-section-close': close, 'kit-section-bare': !heading }" :aria-label="heading || undefined">
    <div ref="body" class="kit-section-body">
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
/* bare: a section with no heading (Layout has none of its own). Some looks keep the heading in a
   wrapper of its own, which stays when the heading is missing: a line under it (Výkres), a sheet
   (Paragon). So an element of the frame left empty before the section's body is not drawn. */
.kit-section.kit-section-bare > :empty:not(.kit-section-body),
.kit-section.kit-section-bare > :not(.kit-section-body) > :empty:not(.kit-section-body) { display: none; }
</style>
