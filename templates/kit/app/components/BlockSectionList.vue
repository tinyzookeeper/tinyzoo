<script setup lang="ts">
// Block "section_list" (kitSections()): the entries of one of the site's own types, each drawn as a card
// of the owner's own design, inside the look's own frame (KitSection). The section has a heading and an
// intro text, and settings: cards or rows, how many side by side, the space, a soft surface or none.
// Nothing at all when it names no type, a type the site does not have, or the type has no entries.
//
// The card is one list of small blocks (a heading, a text, a picture, a button and groups of them), and
// each entry's card is drawn from that same list by a <CmsBlocks prefix="KitCard"> of its own: a block of
// the design appears once per card, with the same `data-cms-block` id and a different
// `data-cms-block-list` (one per <CmsBlocks>), so the editor in the preview finds the design's block in
// every card. A card is an <li class="kit-card">; while editing it carries `data-kit-card` (its place),
// `data-kit-card-collection` (the entry's type) and `data-kit-card-entry` (the entry's id; none for the
// sample card and the empty card), `data-kit-card-sample` on the sample card and `data-kit-card-empty` on
// the empty card. A block that shows nothing carries `data-kit-card-state` (unbound, missing, unfit,
// label). `.kit-card-body` holds the list: the editor reads its direction from it.
//
// Responsive by rule, with no breakpoint of its own. Cards are the cards' rule (KitEntries): at most N
// side by side, fewer on a narrower section, one on a phone. Rows stand under each other, a side picture
// beside the rest, and above it when the section is narrow (a container query on the section). When any
// card has a side picture (kit-cards-sided), the cards without one keep that column empty.
//
// Placeholders (a block that shows nothing, a sample card for a type with no entries, an empty card for a
// card with no blocks) exist only while an editor works on the page (useCmsEditing()); a visitor sees none.
const props = defineProps<{ block: Record<string, any>; index?: number }>()
const editing = useCmsEditing()
const words = useCmsEditingWords()
const custom = await useCustomTypes()
const { plan, cards } = await useCustomCard(() => props.block, custom, editing)
const look = computed(() => sectionLook(props.block))
const intro = computed(() => (plan.value.ok ? paragraphs(plan.value.text) : []))
</script>

<template>
  <KitSection v-if="plan.ok && cards.length" :id="`section-${block.id ?? index ?? ''}`" :heading="plan.heading" :narrow="look.narrow" :close="look.close" class="kit-card-section">
    <div v-if="intro.length" class="kit-card-intro prose-look" v-bind="cmsField('text')">
      <p v-for="(p, i) in intro" :key="i">{{ p }}</p>
    </div>
    <ul :class="[...cardListClasses(plan, cards), intro.length ? 'kit-cards-after-intro' : '']">
      <li
        v-for="(card, i) in cards"
        :key="card.id || `${card.sample ? 'sample' : card.empty ? 'empty' : 'card'}-${i}`"
        class="kit-card"
        :class="{ 'kit-card-sample': card.sample, 'kit-card-empty': card.empty }"
        :style="{ '--kit-card-rest': card.rest }"
        :data-kit-card="editing ? i : undefined"
        :data-kit-card-collection="editing ? card.collection : undefined"
        :data-kit-card-entry="editing && card.id ? card.id : undefined"
        :data-kit-card-sample="editing && card.sample ? '' : undefined"
        :data-kit-card-empty="editing && card.empty ? '' : undefined"
      >
        <div class="kit-card-body">
          <CmsBlocks :blocks="card.items" prefix="KitCard" />
        </div>
        <p v-if="editing && card.sample && words.sampleCard" class="kit-card-note">{{ words.sampleCard }}</p>
        <p v-if="editing && card.empty && words.emptyCard" class="kit-card-note">{{ words.emptyCard }}</p>
      </li>
    </ul>
  </KitSection>
</template>

<style>
/* Every rule starts with .kit-section and names two more classes (see KitSection): a look's own
   rules (html[data-look="…"] .prose-look h3) must not move the kit's spacing. No colour of the kit's own:
   colours are the look's text colour (currentColor) and its line (--custom-line), corners its --custom-radius.
   The list is .kit-cards with its arrangement, columns, space and surface (cardListClasses); a card is
   .kit-card, its blocks .kit-card-item with .kit-card-fill or .kit-card-content and their kind. */

/* The space: between the cards, and between the blocks of a card. */
.kit-section .kit-cards.kit-cards-gap-small { --kit-cards-gap: clamp(0.75rem, 1.2vw, 1rem); --kit-card-gap: 0.5rem; }
.kit-section .kit-cards.kit-cards-gap-medium { --kit-cards-gap: clamp(1.25rem, 2.4vw, 2rem); --kit-card-gap: 0.75rem; }
.kit-section .kit-cards.kit-cards-gap-large { --kit-cards-gap: clamp(2rem, 4.5vw, 4rem); --kit-card-gap: 1.125rem; }
.kit-section .kit-card-list.kit-card-gap-small { --kit-card-gap: 0.5rem; }
.kit-section .kit-card-list.kit-card-gap-medium { --kit-card-gap: 0.75rem; }
.kit-section .kit-card-list.kit-card-gap-large { --kit-card-gap: 1.125rem; }

/* The section's heading is the look's own; a long word in it breaks inside the word, so it never makes the page wider than a phone. */
.kit-section.kit-card-section.kit-card-section h1,
.kit-section.kit-card-section.kit-card-section h2 { overflow-wrap: anywhere; }

/* The intro and the list. */
.kit-section .kit-section-body .kit-card-intro > :first-child { margin-top: 0; }
.kit-section .kit-section-body .kit-card-intro > :last-child { margin-bottom: 0; }
.kit-section .kit-section-body > ul.kit-cards { list-style: none; margin: 0; padding: 0; }
.kit-section .kit-section-body > ul.kit-cards.kit-cards-after-intro { margin-top: clamp(1.75rem, 3.5vw, 2.75rem); }
.kit-section .kit-cards > .kit-card { min-width: 0; display: flex; flex-direction: column; list-style: none; margin: 0; }
.kit-section .kit-card > .kit-card-body { display: flex; flex-direction: column; gap: var(--kit-card-gap); flex: 1; min-width: 0; }

/* Cards: the cards' rule (KitEntries). --kit-cards-cols is the most side by side; a card is never
   narrower than --kit-cards-min, so a narrower section holds fewer and a phone one. */
.kit-section .kit-cards.kit-cards-cards { --kit-cards-cols: 3; --kit-cards-min: 16rem; display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, max(var(--kit-cards-min), calc((100% - (var(--kit-cards-cols) - 1) * var(--kit-cards-gap)) / var(--kit-cards-cols) - 0.02px))), 1fr)); gap: var(--kit-cards-gap); }
.kit-section .kit-cards-cards.kit-cards-cols-2 { --kit-cards-cols: 2; --kit-cards-min: 18rem; }
.kit-section .kit-cards-cards.kit-cards-cols-4 { --kit-cards-cols: 4; --kit-cards-min: 13rem; }

/* Rows: one entry per line. Without a surface, hairlines between them like KitEntries' rows. */
.kit-section .kit-cards.kit-cards-rows { display: flex; flex-direction: column; gap: var(--kit-cards-gap); }
.kit-section .kit-cards-rows.kit-cards-none { gap: 0; border-top: 1px solid var(--custom-line, color-mix(in oklab, currentColor 16%, transparent)); }
.kit-section .kit-cards-rows.kit-cards-none > .kit-card { padding-block: calc(var(--kit-cards-gap) * 0.6); border-bottom: 1px solid var(--custom-line, color-mix(in oklab, currentColor 16%, transparent)); }
/* A card with a side picture: the picture at the left, spanning the rows of the rest, which stand at the right. */
/* (one auto row per block of the rest, and a last row that takes what the picture is taller by, so the rest stays together at the top) */
.kit-section .kit-cards-rows .kit-card-body:has(> .kit-card-side) { display: grid; grid-template-columns: minmax(0, clamp(8rem, 30%, 18rem)) minmax(0, 1fr); grid-template-rows: repeat(var(--kit-card-rest, 1), auto) 1fr; column-gap: clamp(1rem, 3vw, 2rem); row-gap: var(--kit-card-gap); align-content: start; }
.kit-section .kit-cards-rows .kit-card-body > .kit-card-side { grid-column: 1; grid-row: 1 / -1; align-self: start; }
.kit-section .kit-cards-rows .kit-card-body:has(> .kit-card-side) > .kit-card-item:not(.kit-card-side) { grid-column: 2; }
.kit-section .kit-cards-rows .kit-card-body:has(> .kit-card-side) > .kit-card-content { justify-self: start; }
/* A card without a side picture in a list where another has one: the same two columns, its blocks in the second, so all texts line up. */
.kit-section .kit-cards-sided .kit-card-body:not(:has(> .kit-card-side)) { display: grid; grid-template-columns: minmax(0, clamp(8rem, 30%, 18rem)) minmax(0, 1fr); column-gap: clamp(1rem, 3vw, 2rem); row-gap: var(--kit-card-gap); align-content: start; }
.kit-section .kit-cards-sided .kit-card-body:not(:has(> .kit-card-side)) > .kit-card-item { grid-column: 2; }
.kit-section .kit-cards-sided .kit-card-body:not(:has(> .kit-card-side)) > .kit-card-content { justify-self: start; }
/* A narrow section puts the picture above again, and drops the empty column. */
@container (max-width: 30rem) {
  .kit-section .kit-cards-sided .kit-card-body:not(:has(> .kit-card-side)) { display: flex; flex-direction: column; }
  .kit-section .kit-cards-rows .kit-card-body:has(> .kit-card-side) { display: flex; flex-direction: column; }
}

/* The surface: a soft tint of the text colour, the look's corners. In cards a picture that is the
   card's first block bleeds to its top and side edges (no overflow: hidden, the focus ring of a button must show). */
.kit-section .kit-cards.kit-cards-soft { --kit-card-pad: clamp(1rem, 2vw, 1.5rem); }
.kit-section .kit-cards-soft > .kit-card { background: color-mix(in srgb, currentColor 6%, transparent); border-radius: var(--custom-radius, 0); padding: var(--kit-card-pad); }
.kit-section .kit-cards-cards.kit-cards-soft .kit-card-body > .kit-card-picture:first-child { margin: calc(var(--kit-card-pad) * -1) calc(var(--kit-card-pad) * -1) 0; max-width: none; }
.kit-section .kit-cards-cards.kit-cards-soft .kit-card-body > .kit-card-picture:first-child .kit-card-img { border-end-start-radius: 0; border-end-end-radius: 0; }
.kit-section .kit-cards-cards.kit-cards-soft .kit-card-body > .kit-card-picture:first-child .kit-card-ghost-frame { border-end-start-radius: 0; border-end-end-radius: 0; }

/* The blocks: never wider than their place; a long word breaks inside the word. In a column a block that
   fills stretches and one as wide as its content stands at the start. */
.kit-section .kit-card .kit-card-item { min-width: 0; max-width: 100%; overflow-wrap: anywhere; }
.kit-section .kit-card-body > .kit-card-fill { align-self: stretch; }
.kit-section .kit-card-body > .kit-card-content { align-self: flex-start; }
.kit-section .kit-card-list.kit-card-list-stack { display: flex; flex-direction: column; gap: var(--kit-card-gap); }
.kit-section .kit-card-list.kit-card-list-stack > .kit-card-content { align-self: flex-start; }
/* A row group: wraps by itself; a block that fills shares the room. */
.kit-section .kit-card-list.kit-card-list-row { display: flex; flex-flow: row wrap; align-items: baseline; gap: var(--kit-card-gap) calc(var(--kit-card-gap) * 1.5); }
.kit-section .kit-card-list-row > .kit-card-fill { flex: 1 1 min(100%, 8rem); }
.kit-section .kit-card-list-row > .kit-card-picture.kit-card-fill { flex: 1 1 min(100%, 6rem); }
.kit-section .kit-card-list-row > .kit-card-content { flex: 0 1 auto; }

/* A heading: the look's own h3 (medium), without its measure and margins; larger and smaller steps. */
.kit-section .kit-card .kit-card-heading.prose-look { max-width: none; }
.kit-section .kit-card-heading .kit-card-h { margin: 0; }
.kit-section .kit-card-heading.kit-card-h-large .kit-card-h { font-size: clamp(1.375rem, 1.15rem + 0.9vw, 1.75rem); line-height: 1.2; }
.kit-section .kit-card-heading.kit-card-h-small .kit-card-h { font-size: 1.125rem; line-height: 1.35; }

/* A text: the look's body text, several lines kept; larger and smaller steps. */
.kit-section .kit-card .kit-card-text.prose-look { margin: 0; max-width: none; }
.kit-section .kit-card-text .kit-card-p { margin: 0; white-space: pre-line; }
.kit-section .kit-card-text .kit-card-rich > :first-child { margin-top: 0; }
.kit-section .kit-card-text .kit-card-rich > :last-child { margin-bottom: 0; }
.kit-section .kit-card-text.kit-card-t-larger { font-size: clamp(1.1875rem, 1.1rem + 0.35vw, 1.375rem); line-height: 1.45; }
.kit-section .kit-card-text.kit-card-t-small { font-size: 0.8125rem; line-height: 1.5; letter-spacing: 0.02em; opacity: 0.72; }

/* A picture: cut to its shape, the look's corners. One as wide as its content is as wide as it is. */
.kit-section .kit-card-picture .kit-card-img { display: block; width: 100%; height: auto; object-fit: cover; border-radius: var(--custom-radius, 0); }
.kit-section .kit-card-picture.kit-card-content .kit-card-img { width: auto; max-width: 100%; }

/* A button: the look's main button, without the space a section's button keeps above it. */
.kit-section .kit-section-body .kit-card-button > .kit-btn { margin-top: 0; max-width: 100%; white-space: normal; overflow-wrap: anywhere; }
.kit-section .kit-section-body .kit-card-button.kit-card-fill > .kit-btn:not(.kit-btn-plain) { display: flex; width: 100%; }

/* Placeholders, only while an editor works on the page (useCmsEditing()): quiet shapes in the look's own
   text colour, so they sit in every look. */
.kit-section .kit-card-item .kit-card-chip { display: inline-flex; align-items: center; gap: 0.4rem; padding: 0.3rem 0.6rem; border: 1.5px dashed color-mix(in srgb, currentColor 40%, transparent); border-radius: max(var(--custom-radius, 0px), 6px); font-size: 0.8125rem; line-height: 1.4; font-weight: 500; font-family: inherit; letter-spacing: 0; opacity: 0.8; max-width: 100%; }
.kit-section .kit-card-item .kit-card-chip-icon { flex: none; width: 0.95rem; height: 0.95rem; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
.kit-section .kit-card-item .kit-card-chip-bar { display: block; width: 4.5rem; height: 0.75rem; border-radius: 999px; background: currentColor; opacity: 0.13; }
.kit-section .kit-card-picture .kit-card-ghost-frame { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 0.5rem; width: 100%; max-height: 16rem; border-radius: var(--custom-radius, 0); background: color-mix(in srgb, currentColor 7%, transparent); border: 1.5px dashed color-mix(in srgb, currentColor 25%, transparent); }
.kit-section .kit-card-picture .kit-card-ghost-frame svg { width: 2rem; height: 2rem; fill: none; stroke: currentColor; stroke-width: 1.5; stroke-linecap: round; stroke-linejoin: round; opacity: 0.35; }
.kit-section .kit-card-picture .kit-card-ghost-frame svg.kit-card-chip-icon { width: 0.95rem; height: 0.95rem; stroke-width: 2; opacity: 1; }
.kit-section .kit-card-button .kit-card-ghost-btn { display: inline-flex; align-items: center; justify-content: center; max-width: 100%; min-width: 8rem; min-height: 2.75rem; padding: 0.5rem 1.25rem; border: 1.5px dashed color-mix(in srgb, currentColor 35%, transparent); border-radius: max(var(--custom-radius, 0px), 6px); opacity: 0.8; }
.kit-section .kit-card-button .kit-card-ghost-btn .kit-card-chip { border: 0; padding: 0; opacity: 1; }
.kit-section .kit-card-button .kit-card-ghost-words { opacity: 0.45; user-select: none; }
.kit-section .kit-card-button.kit-card-fill > .kit-card-ghost-btn { display: flex; width: 100%; }
.kit-section .kit-card-list.kit-card-ghost-list { min-height: 3rem; min-width: min(100%, 8rem); border: 1.5px dashed color-mix(in srgb, currentColor 28%, transparent); border-radius: max(var(--custom-radius, 0px), 6px); }
.kit-section .kit-cards > .kit-card-empty { min-height: 9rem; border: 1.5px dashed color-mix(in srgb, currentColor 28%, transparent); border-radius: max(var(--custom-radius, 0px), 6px); }
.kit-section .kit-card.kit-card-sample > .kit-card-body > .kit-card-item { opacity: 0.6; }
.kit-section .kit-card .kit-card-note { margin: 0; font-size: 0.8125rem; line-height: 1.4; opacity: 0.6; }
.kit-section .kit-card-sample .kit-card-note { margin-top: var(--kit-card-gap); }
.kit-section .kit-card-empty .kit-card-note { margin: auto; padding: 1rem; text-align: center; max-width: 22rem; }
</style>
