<script setup lang="ts">
// Block "section_layout" (kitSections()): small blocks (a heading, a text, a picture, a button) and
// groups of them in a row, a stack or a grid, drawn by the kit for every look inside the look's own
// frame (KitSection), with no heading of its own. Nothing at all when every small block is empty.
//
// The lists are drawn by <CmsBlocks prefix="KitLayout">: a small block of type `heading` is
// <KitLayoutHeading>, a group <KitLayoutGroup>, which draws its own list the same way. So the editor
// in the preview finds each of them by the marks <CmsBlocks> writes on its one root element. The
// element that holds a list is the flex or grid container itself; <CmsBlocks> adds no wrapper.
//
// Responsive by rule, with no breakpoint of its own. A row wraps: a block that fills shares the room
// and is never narrower than about 16rem (a picture 14rem), so on a narrow section the blocks go
// under each other; a block as wide as its content keeps its width and never forces overflow. A grid
// is the cards' rule (KitEntries): at most N side by side, fewer on a narrower section, one on a
// phone. A stack is a column. The space between is one of three steps.
//
// While an editor works on the page (useCmsEditing()), empty blocks are drawn as quiet placeholders
// of their kind and an empty section or group as a dashed box, so that a block just added can be seen
// and selected; the editor in the preview draws "Add a block" in an empty one. A visitor sees none.
const props = defineProps<{ block: Record<string, any>; index?: number }>()
const editing = useCmsEditing()
const plan = computed(() => layoutPlan(props.block, editing.value))
const look = computed(() => sectionLook(props.block))
</script>

<template>
  <KitSection v-if="plan" :id="`section-${block.id ?? index ?? ''}`" heading="" :narrow="look.narrow" :close="look.close" class="kit-lay-section">
    <div :class="[...layoutClasses(plan), plan.items.length ? '' : 'kit-lay-ghost-list']">
      <CmsBlocks :blocks="plan.items" prefix="KitLayout" />
    </div>
  </KitSection>
</template>

<style>
/* Every rule starts with .kit-section and names two more classes (see KitSection): a look's own
   rules (html[data-look="…"] .prose-look h3) must not move the kit's spacing.
   A list of small blocks is .kit-lay with its arrangement, space and alignment; each small block's
   root is .kit-lay-item with .kit-lay-fill or .kit-lay-content and its kind (.kit-lay-heading …). */

/* The space between: three steps, each growing a little with the screen. */
.kit-section .kit-lay.kit-lay-gap-small { --kit-lay-gap: clamp(0.75rem, 1.2vw, 1rem); }
.kit-section .kit-lay.kit-lay-gap-medium { --kit-lay-gap: clamp(1.25rem, 2.4vw, 2rem); }
.kit-section .kit-lay.kit-lay-gap-large { --kit-lay-gap: clamp(2rem, 4.5vw, 4rem); }
.kit-section .kit-lay .kit-lay-item { min-width: 0; overflow-wrap: anywhere; }
/* A text keeps the look's measure (its .prose-look); everything else is never wider than its place. */
.kit-section .kit-lay .kit-lay-item:not(.kit-lay-text) { max-width: 100%; }

/* A row: wraps by itself. A block that fills is never narrower than --kit-lay-min unless the row is. */
.kit-section .kit-lay.kit-lay-row { display: flex; flex-flow: row wrap; gap: var(--kit-lay-gap); align-items: flex-start; }
.kit-section .kit-lay-row.kit-lay-align-center { align-items: center; }
.kit-section .kit-lay-row.kit-lay-align-end { align-items: flex-end; }
.kit-section .kit-lay-row > .kit-lay-item { --kit-lay-min: 16rem; }
.kit-section .kit-lay-row > .kit-lay-picture { --kit-lay-min: 14rem; }
.kit-section .kit-lay-row > .kit-lay-fill { flex: 1 1 min(100%, var(--kit-lay-min)); }
.kit-section .kit-lay-row > .kit-lay-content { flex: 0 1 auto; }

/* A stack: a column. A block that fills takes the whole width (a text keeps the look's measure);
   one as wide as its content stands at the alignment. The text follows the alignment too. */
.kit-section .kit-lay.kit-lay-stack { display: flex; flex-direction: column; gap: var(--kit-lay-gap); align-items: stretch; text-align: start; }
.kit-section .kit-lay-stack.kit-lay-align-center { text-align: center; }
.kit-section .kit-lay-stack.kit-lay-align-end { text-align: end; }
.kit-section .kit-lay-stack > .kit-lay-content { align-self: flex-start; }
.kit-section .kit-lay-stack.kit-lay-align-center > .kit-lay-content { align-self: center; }
.kit-section .kit-lay-stack.kit-lay-align-end > .kit-lay-content { align-self: flex-end; }

/* A grid: the cards' rule (KitEntries). --kit-lay-cols is the most side by side; a cell is never
   narrower than --kit-lay-cell, so a narrower section holds fewer and a phone one. */
.kit-section .kit-lay.kit-lay-grid { --kit-lay-cols: 3; --kit-lay-cell: 16rem; display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, max(var(--kit-lay-cell), calc((100% - (var(--kit-lay-cols) - 1) * var(--kit-lay-gap)) / var(--kit-lay-cols) - 0.02px))), 1fr)); gap: var(--kit-lay-gap); align-items: start; text-align: start; }
.kit-section .kit-lay-grid.kit-lay-cols-2 { --kit-lay-cols: 2; --kit-lay-cell: 18rem; }
.kit-section .kit-lay-grid.kit-lay-cols-4 { --kit-lay-cols: 4; --kit-lay-cell: 13rem; }
.kit-section .kit-lay-grid.kit-lay-align-center { justify-items: center; text-align: center; }
.kit-section .kit-lay-grid.kit-lay-align-end { justify-items: end; text-align: end; }
.kit-section .kit-lay-grid > .kit-lay-fill { justify-self: stretch; }

/* A row inside a centred (or end-aligned) stack or grid stands in the middle (at the end) too. */
.kit-section .kit-lay-align-center > .kit-lay-row { justify-content: center; }
.kit-section .kit-lay-align-end > .kit-lay-row { justify-content: flex-end; }

/* A heading: the look's h2 (large) or h3 (medium, small) from .prose-look, without its margins and
   its measure; small is a quieter h3. */
.kit-section .kit-lay .kit-lay-heading.prose-look { max-width: none; }
.kit-section .kit-lay-heading .kit-lay-h { margin: 0; }
.kit-section .kit-lay-heading.kit-lay-h-small .kit-lay-h { font-size: 1.125rem; line-height: 1.35; }

/* A text: the look's body text. It keeps the look's measure; in a stack it stands at the alignment. */
.kit-section .kit-lay .kit-lay-text.prose-look { margin: 0; }
.kit-section .kit-lay-text.prose-look > :first-child { margin-top: 0; }
.kit-section .kit-lay-text.prose-look > :last-child { margin-bottom: 0; }
.kit-section .kit-lay-stack > .kit-lay-text.prose-look { margin-inline: 0 auto; }
.kit-section .kit-lay-stack.kit-lay-align-center > .kit-lay-text.prose-look { margin-inline: auto; }
.kit-section .kit-lay-stack.kit-lay-align-end > .kit-lay-text.prose-look { margin-inline: auto 0; }
.kit-section .kit-lay-grid.kit-lay-align-center > .kit-lay-text.prose-look { margin-inline: auto; }
.kit-section .kit-lay-grid.kit-lay-align-end > .kit-lay-text.prose-look { margin-inline: auto 0; }

/* A picture: cut to its shape, the look's corners. One as wide as its content is as wide as it is. */
.kit-section .kit-lay-picture .kit-lay-img { display: block; width: 100%; height: auto; object-fit: cover; border-radius: var(--custom-radius, 0); }
.kit-section .kit-lay-picture.kit-lay-content .kit-lay-img { width: auto; max-width: 100%; }

/* A button: the look's main button, without the space a section's button keeps above it. A long
   label wraps inside it. One that fills is as wide as its place. */
.kit-section .kit-lay .kit-lay-button > .kit-btn { margin-top: 0; max-width: 100%; white-space: normal; overflow-wrap: anywhere; }
.kit-section .kit-lay .kit-lay-button.kit-lay-fill > .kit-btn:not(.kit-btn-plain) { display: flex; width: 100%; }

/* Placeholders, only while an editor works on the page (useCmsEditing()): quiet shapes in the
   look's own text colour, so they sit in every look. An empty list is a dashed box with room for
   the editor's "Add a block"; an empty block is a ghost of its kind. */
.kit-section .kit-lay.kit-lay-ghost-list { min-height: 7rem; min-width: min(100%, 12rem); border: 1.5px dashed color-mix(in srgb, currentColor 28%, transparent); border-radius: max(var(--custom-radius, 0px), 6px); }
.kit-section .kit-lay .kit-lay-group.kit-lay-ghost-list { min-height: 5.5rem; }
.kit-section .kit-lay .kit-lay-ghost-bar { display: block; height: 0.75rem; border-radius: 999px; background: currentColor; opacity: 0.13; }
.kit-section .kit-lay-text.kit-lay-ghost { display: flex; flex-direction: column; gap: 0.6rem; padding-block: 0.3rem; min-width: min(100%, 14rem); }
.kit-section .kit-lay-text.kit-lay-ghost .kit-lay-ghost-short { width: 62%; }
.kit-section .kit-lay-heading.kit-lay-ghost { min-width: min(100%, 12rem); padding-block: 0.25rem; }
.kit-section .kit-lay-heading.kit-lay-ghost .kit-lay-ghost-title { width: min(100%, 18rem); height: 1.6rem; border-radius: 6px; }
.kit-section .kit-lay-heading.kit-lay-h-large .kit-lay-ghost-title { height: 2.1rem; }
.kit-section .kit-lay-heading.kit-lay-h-small .kit-lay-ghost-title { height: 1.15rem; }
.kit-section .kit-lay-picture .kit-lay-ghost-frame { display: grid; place-items: center; width: 100%; min-width: min(100%, 12rem); max-height: 16rem; border-radius: var(--custom-radius, 0); background: color-mix(in srgb, currentColor 7%, transparent); border: 1.5px dashed color-mix(in srgb, currentColor 25%, transparent); }
.kit-section .kit-lay-picture .kit-lay-ghost-frame svg { width: 2rem; height: 2rem; fill: none; stroke: currentColor; stroke-width: 1.5; stroke-linecap: round; stroke-linejoin: round; opacity: 0.35; }
.kit-section .kit-lay-button .kit-lay-ghost-btn { display: inline-flex; align-items: center; justify-content: center; min-width: 8rem; min-height: 2.75rem; padding: 0.5rem 1.25rem; border: 1.5px dashed color-mix(in srgb, currentColor 35%, transparent); border-radius: max(var(--custom-radius, 0px), 6px); opacity: 0.8; }
.kit-section .kit-lay-button .kit-lay-ghost-btn .kit-lay-ghost-bar { width: 4.5rem; }
.kit-section .kit-lay .kit-lay-button.kit-lay-fill > .kit-lay-ghost-btn { display: flex; width: 100%; }
</style>
