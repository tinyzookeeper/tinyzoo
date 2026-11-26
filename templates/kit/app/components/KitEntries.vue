<script setup lang="ts">
// The entries of one of the site's own types, as the two generic blocks draw them (BlockCustomEntries,
// BlockCustomChosen): a heading and a short text, then the entries as cards, as rows or as a table. It is drawn
// inside the look's frame, its own Text part (LookPart): the container, the space above and below
// and the heading are the look's. Inside, the same markup in every look, made from what all looks
// share: texts sit in the look's `.prose-look`, colours are inherited, lines and quiet text are
// made from the text colour.
// A look may refine it with `--custom-radius` (the pictures' corners), `--custom-line` (the lines) and
// `--custom-gap` (the space between cards); each has a fallback, so no look has to.
import type { CustomCard, CustomColumns, CustomLayout, CustomPicture, CustomTable } from '../utils/customTypes'

const props = defineProps<{
  /** The block's id: the section's id is made from it. */
  id: string
  heading: string
  text: string
  layout: CustomLayout
  /** Cards side by side at most; the page shows fewer on narrow screens, one on a phone. */
  columns?: CustomColumns
  /** The shape every card's picture is cut to. */
  picture?: CustomPicture
  cards: CustomCard[]
  /** The entries as a table (customTable), drawn when the layout is a table. */
  table?: CustomTable
}>()

const NuxtLink = resolveComponent('NuxtLink')
const sectionId = computed(() => `custom-${props.id}`)
const intro = computed(() => paragraphs(props.text))
// Rows keep the column of the quiet line only when an entry has one.
const plainRows = computed(() => props.cards.every((c) => !c.meta))
// What the browser is told about a card's picture: the widest it is drawn, by the columns chosen.
const PICTURE_SIZES: Record<CustomColumns, string> = {
  2: '(min-width: 48rem) 46vw, 100vw',
  3: '(min-width: 80rem) 28rem, (min-width: 40rem) 46vw, 100vw',
  4: '(min-width: 80rem) 21rem, (min-width: 56rem) 31vw, (min-width: 32rem) 46vw, 100vw',
}
const cols = computed(() => props.columns ?? 3)
</script>

<template>
  <LookPart :id="sectionId" part="Text" :block="{ heading, body: null }" :first="false" class="custom-block" :aria-label="heading || undefined">
    <div class="custom-wrap">
      <div v-if="intro.length" class="custom-intro prose-look">
        <p v-for="(p, i) in intro" :key="i">{{ p }}</p>
      </div>

      <ul v-if="layout === 'cards'" class="custom-list custom-cards" :class="[`custom-cols-${cols}`, `custom-pic-${picture ?? 'landscape'}`]">
        <li v-for="c in cards" :key="c.id">
          <component :is="c.href ? NuxtLink : 'div'" v-bind="c.href ? { to: c.href } : {}" class="custom-card">
            <CmsImage v-if="c.image" :media="c.image" class="custom-pic" :sizes="PICTURE_SIZES[cols]" />
            <div class="custom-head prose-look">
              <h3 class="custom-title">{{ c.title }}</h3>
            </div>
            <p v-if="c.meta" class="custom-meta">{{ c.meta }}</p>
            <p v-if="c.text" class="custom-text">{{ c.text }}</p>
            <ul v-if="c.more.length" class="custom-more">
              <li v-for="(m, i) in c.more" :key="i"><span v-if="m.label" class="custom-more-label">{{ m.label }}</span> {{ m.value }}</li>
            </ul>
          </component>
        </li>
      </ul>

      <div v-else-if="layout === 'table' && table" class="custom-table-wrap" :class="`custom-table-n${Math.min(table.columns.length, 6)}`">
        <table class="custom-table" role="table">
          <thead class="custom-thead" role="rowgroup">
            <tr class="custom-hrow" role="row">
              <th v-for="col in table.columns" :key="col.key" class="custom-thcell" scope="col" role="columnheader">{{ col.label }}</th>
            </tr>
          </thead>
          <tbody class="custom-tbody" role="rowgroup">
            <tr v-for="row in table.rows" :key="row.id" class="custom-tr" role="row">
              <th class="custom-tcell custom-ttitle" scope="row" role="rowheader">
                <NuxtLink v-if="row.href" :to="row.href">{{ row.title }}</NuxtLink>
                <template v-else>{{ row.title }}</template>
              </th>
              <td v-for="col in table.columns.slice(1)" :key="col.key" class="custom-tcell" :class="{ 'custom-tempty': !row.cells[col.key] }" role="cell" :data-label="col.label">{{ row.cells[col.key] }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <ul v-else class="custom-list custom-rows" :class="{ 'custom-rows-plain': plainRows }">
        <li v-for="c in cards" :key="c.id">
          <component :is="c.href ? NuxtLink : 'div'" v-bind="c.href ? { to: c.href } : {}" class="custom-row">
            <p v-if="!plainRows" class="custom-meta">{{ c.meta }}</p>
            <div class="custom-row-main">
              <div class="custom-head prose-look">
                <h3 class="custom-title">{{ c.title }}</h3>
              </div>
              <p v-if="c.text" class="custom-text">{{ c.text }}</p>
              <ul v-if="c.more.length" class="custom-more">
                <li v-for="(m, i) in c.more" :key="i"><span v-if="m.label" class="custom-more-label">{{ m.label }}</span> {{ m.value }}</li>
              </ul>
            </div>
          </component>
        </li>
      </ul>
    </div>
  </LookPart>
</template>

<style>
/* Every rule starts with .custom-block and names two more classes: a look's own rules
   (html[data-look="…"] .prose-look h3) must not move the kit's spacing. */
.custom-block .custom-intro > :first-child { margin-top: 0; }
.custom-block .custom-intro > :last-child { margin-bottom: 0; }
.custom-block .custom-wrap .custom-list { list-style: none; margin: clamp(1.75rem, 3.5vw, 2.75rem) 0 0; padding: 0; }
.custom-block .custom-wrap .custom-list:first-child { margin-top: 0; }

/* the places of an entry */
.custom-block .custom-head .custom-title { margin: 0; }
.custom-block .custom-head.prose-look { max-width: none; }
.custom-block .custom-wrap .custom-meta { margin: 0.45rem 0 0; font-size: 0.8125rem; line-height: 1.5; letter-spacing: 0.02em; opacity: 0.68; }
.custom-block .custom-wrap .custom-text { margin: 0.6rem 0 0; opacity: 0.84; white-space: pre-line; display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 3; line-clamp: 3; overflow: hidden; }
.custom-block .custom-wrap .custom-more { list-style: none; display: flex; flex-wrap: wrap; gap: 0.2rem 1.25rem; margin: 0.8rem 0 0; padding: 0; font-size: 0.8125rem; line-height: 1.5; }
.custom-block .custom-more .custom-more-label { opacity: 0.66; }

/* cards */
/* The owner's choice is the most cards in a row (--custom-cols). A card is never narrower than
   --custom-min, so the row holds fewer on a narrower screen and one on a phone, with no breakpoint
   of the kit's own: the look's container decides. The 0.02px keeps a rounded width from dropping a column. */
.custom-block .custom-wrap .custom-cards { --custom-cols: 3; --custom-min: 16rem; --custom-col-gap: var(--custom-gap, clamp(1.5rem, 3vw, 2.5rem)); display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, max(var(--custom-min), calc((100% - (var(--custom-cols) - 1) * var(--custom-col-gap)) / var(--custom-cols) - 0.02px))), 1fr)); gap: var(--custom-gap, clamp(2rem, 3.5vw, 2.75rem)) var(--custom-col-gap); }
.custom-block .custom-wrap .custom-cols-2 { --custom-cols: 2; --custom-min: 18rem; }
.custom-block .custom-wrap .custom-cols-4 { --custom-cols: 4; --custom-min: 13rem; }
.custom-block .custom-cards .custom-card { display: block; height: 100%; color: inherit; text-decoration: none; }
.custom-block .custom-card .custom-pic { display: block; width: 100%; height: auto; aspect-ratio: 4 / 3; object-fit: cover; border-radius: var(--custom-radius, 0); margin: 0 0 1.1rem; }
.custom-block .custom-pic-square .custom-card .custom-pic { aspect-ratio: 1; }
.custom-block .custom-pic-portrait .custom-card .custom-pic { aspect-ratio: 3 / 4; }

/* rows */
.custom-block .custom-wrap .custom-rows { border-top: 1px solid var(--custom-line, color-mix(in oklab, currentColor 16%, transparent)); }
.custom-block .custom-rows > li { border-bottom: 1px solid var(--custom-line, color-mix(in oklab, currentColor 16%, transparent)); }
.custom-block .custom-rows .custom-row { display: grid; grid-template-columns: minmax(9rem, 14rem) minmax(0, 1fr); gap: 0.3rem clamp(1.5rem, 4vw, 3rem); padding-block: clamp(1.1rem, 2.2vw, 1.5rem); color: inherit; text-decoration: none; }
.custom-block .custom-rows.custom-rows-plain .custom-row { grid-template-columns: minmax(0, 1fr); }
.custom-block .custom-rows .custom-row .custom-meta { margin-top: 0.3em; }
.custom-block .custom-rows .custom-text { -webkit-line-clamp: 2; line-clamp: 2; }
@media (max-width: 40rem) {
  .custom-block .custom-rows .custom-row { grid-template-columns: minmax(0, 1fr); }
  .custom-block .custom-rows .custom-row .custom-meta { margin-top: 0; }
}

/* a table: the lines are horizontal only, the header is the quiet style of .custom-meta. The wrapper
   is a container of its own (never .custom-wrap, so cards and rows stay as they are): when it is
   narrower than about 9.5rem a column, the rows stack as "label: value" (the roles in the markup
   keep the table for screen readers). A wide table wraps only between words, so a short value (a price) never breaks; stacked, a long word may break anywhere. One block per column count (2 to 6 or more); one column never stacks. */
.custom-block .custom-wrap .custom-table-wrap { position: relative; container-type: inline-size; margin: clamp(1.75rem, 3.5vw, 2.75rem) 0 0; }
.custom-block .custom-wrap .custom-table-wrap:first-child { margin-top: 0; }
.custom-block .custom-table-wrap .custom-table { width: 100%; border-collapse: collapse; font: inherit; text-align: left; }
.custom-block .custom-table .custom-thcell { padding: 0 1.5rem 0.7rem 0; font-size: 0.8125rem; line-height: 1.5; letter-spacing: 0.02em; font-weight: 400; text-align: left; vertical-align: bottom; opacity: 0.68; border-bottom: 1px solid var(--custom-line, color-mix(in oklab, currentColor 16%, transparent)); }
.custom-block .custom-tbody .custom-tcell { padding-block: 0.85rem; padding-inline: 0 1.5rem; font: inherit; text-align: left; vertical-align: top; overflow-wrap: break-word; border-bottom: 1px solid var(--custom-line, color-mix(in oklab, currentColor 16%, transparent)); }
.custom-block .custom-tbody .custom-ttitle { font-weight: 600; }
.custom-block .custom-ttitle a { color: inherit; text-decoration: none; }
.custom-block .custom-ttitle a:hover { text-decoration: underline; text-decoration-thickness: 1px; text-underline-offset: 0.18em; }
@container (max-width: 19rem) {
  .custom-block .custom-table-n2 .custom-table, .custom-block .custom-table-n2 .custom-tbody, .custom-block .custom-table-n2 .custom-tr, .custom-block .custom-table-n2 .custom-tcell { display: block; }
  .custom-block .custom-table-n2 .custom-table { border-top: 1px solid var(--custom-line, color-mix(in oklab, currentColor 16%, transparent)); }
  .custom-block .custom-table-n2 .custom-thead { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
  .custom-block .custom-table-n2 .custom-tr { padding-block: 0.9rem; border-bottom: 1px solid var(--custom-line, color-mix(in oklab, currentColor 16%, transparent)); }
  .custom-block .custom-table-n2 .custom-tbody .custom-tcell { padding: 0.1rem 0; border-bottom: 0; overflow-wrap: anywhere; }
  .custom-block .custom-table-n2 .custom-tbody .custom-ttitle { padding-bottom: 0.3rem; }
  .custom-block .custom-table-n2 .custom-tcell.custom-tempty { display: none; }
  .custom-block .custom-table-n2 .custom-tcell[data-label]::before { content: attr(data-label) ': '; font-size: 0.8125rem; letter-spacing: 0.02em; opacity: 0.68; }
}
@container (max-width: 28.5rem) {
  .custom-block .custom-table-n3 .custom-table, .custom-block .custom-table-n3 .custom-tbody, .custom-block .custom-table-n3 .custom-tr, .custom-block .custom-table-n3 .custom-tcell { display: block; }
  .custom-block .custom-table-n3 .custom-table { border-top: 1px solid var(--custom-line, color-mix(in oklab, currentColor 16%, transparent)); }
  .custom-block .custom-table-n3 .custom-thead { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
  .custom-block .custom-table-n3 .custom-tr { padding-block: 0.9rem; border-bottom: 1px solid var(--custom-line, color-mix(in oklab, currentColor 16%, transparent)); }
  .custom-block .custom-table-n3 .custom-tbody .custom-tcell { padding: 0.1rem 0; border-bottom: 0; overflow-wrap: anywhere; }
  .custom-block .custom-table-n3 .custom-tbody .custom-ttitle { padding-bottom: 0.3rem; }
  .custom-block .custom-table-n3 .custom-tcell.custom-tempty { display: none; }
  .custom-block .custom-table-n3 .custom-tcell[data-label]::before { content: attr(data-label) ': '; font-size: 0.8125rem; letter-spacing: 0.02em; opacity: 0.68; }
}
@container (max-width: 38rem) {
  .custom-block .custom-table-n4 .custom-table, .custom-block .custom-table-n4 .custom-tbody, .custom-block .custom-table-n4 .custom-tr, .custom-block .custom-table-n4 .custom-tcell { display: block; }
  .custom-block .custom-table-n4 .custom-table { border-top: 1px solid var(--custom-line, color-mix(in oklab, currentColor 16%, transparent)); }
  .custom-block .custom-table-n4 .custom-thead { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
  .custom-block .custom-table-n4 .custom-tr { padding-block: 0.9rem; border-bottom: 1px solid var(--custom-line, color-mix(in oklab, currentColor 16%, transparent)); }
  .custom-block .custom-table-n4 .custom-tbody .custom-tcell { padding: 0.1rem 0; border-bottom: 0; overflow-wrap: anywhere; }
  .custom-block .custom-table-n4 .custom-tbody .custom-ttitle { padding-bottom: 0.3rem; }
  .custom-block .custom-table-n4 .custom-tcell.custom-tempty { display: none; }
  .custom-block .custom-table-n4 .custom-tcell[data-label]::before { content: attr(data-label) ': '; font-size: 0.8125rem; letter-spacing: 0.02em; opacity: 0.68; }
}
@container (max-width: 47.5rem) {
  .custom-block .custom-table-n5 .custom-table, .custom-block .custom-table-n5 .custom-tbody, .custom-block .custom-table-n5 .custom-tr, .custom-block .custom-table-n5 .custom-tcell { display: block; }
  .custom-block .custom-table-n5 .custom-table { border-top: 1px solid var(--custom-line, color-mix(in oklab, currentColor 16%, transparent)); }
  .custom-block .custom-table-n5 .custom-thead { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
  .custom-block .custom-table-n5 .custom-tr { padding-block: 0.9rem; border-bottom: 1px solid var(--custom-line, color-mix(in oklab, currentColor 16%, transparent)); }
  .custom-block .custom-table-n5 .custom-tbody .custom-tcell { padding: 0.1rem 0; border-bottom: 0; overflow-wrap: anywhere; }
  .custom-block .custom-table-n5 .custom-tbody .custom-ttitle { padding-bottom: 0.3rem; }
  .custom-block .custom-table-n5 .custom-tcell.custom-tempty { display: none; }
  .custom-block .custom-table-n5 .custom-tcell[data-label]::before { content: attr(data-label) ': '; font-size: 0.8125rem; letter-spacing: 0.02em; opacity: 0.68; }
}
@container (max-width: 57rem) {
  .custom-block .custom-table-n6 .custom-table, .custom-block .custom-table-n6 .custom-tbody, .custom-block .custom-table-n6 .custom-tr, .custom-block .custom-table-n6 .custom-tcell { display: block; }
  .custom-block .custom-table-n6 .custom-table { border-top: 1px solid var(--custom-line, color-mix(in oklab, currentColor 16%, transparent)); }
  .custom-block .custom-table-n6 .custom-thead { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
  .custom-block .custom-table-n6 .custom-tr { padding-block: 0.9rem; border-bottom: 1px solid var(--custom-line, color-mix(in oklab, currentColor 16%, transparent)); }
  .custom-block .custom-table-n6 .custom-tbody .custom-tcell { padding: 0.1rem 0; border-bottom: 0; overflow-wrap: anywhere; }
  .custom-block .custom-table-n6 .custom-tbody .custom-ttitle { padding-bottom: 0.3rem; }
  .custom-block .custom-table-n6 .custom-tcell.custom-tempty { display: none; }
  .custom-block .custom-table-n6 .custom-tcell[data-label]::before { content: attr(data-label) ': '; font-size: 0.8125rem; letter-spacing: 0.02em; opacity: 0.68; }
}
/* a link: the title underlined on hover, a visible ring for the keyboard */
.custom-block a.custom-card:hover .custom-title,
.custom-block a.custom-row:hover .custom-title { text-decoration: underline; text-decoration-thickness: 1px; text-underline-offset: 0.18em; }
.custom-block .custom-list a:focus-visible,
.custom-block .custom-ttitle a:focus-visible { outline: 2px solid currentColor; outline-offset: 4px; border-radius: 2px; }
</style>
