<script setup lang="ts">
// The entries of one of the site's own types, as the two generic blocks draw them (BlockXEntries,
// BlockXChosen): a heading and a short text, then the entries as cards or as rows. The same
// markup in every look, which it takes from what all looks share: headings and texts sit in the
// look's `.prose-look`, colours are inherited, lines and quiet text are made from the text colour.
// A look may refine it with `--x-radius` (the pictures' corners), `--x-line` (the lines) and
// `--x-gap` (the space between cards); each has a fallback, so no look has to.
import type { CustomCard } from '../utils/customTypes'

const props = defineProps<{
  /** The block's id: the heading's id is made from it. */
  id: string
  heading: string
  text: string
  layout: 'cards' | 'rows'
  cards: CustomCard[]
}>()

const NuxtLink = resolveComponent('NuxtLink')
const headingId = computed(() => `x-${props.id}`)
const intro = computed(() => paragraphs(props.text))
// Rows keep the column of the quiet line only when an entry has one.
const plainRows = computed(() => props.cards.every((c) => !c.meta))
</script>

<template>
  <section class="x-block" :aria-labelledby="heading ? headingId : undefined">
    <div class="x-wrap">
      <div v-if="heading || intro.length" class="x-intro prose-look">
        <h2 v-if="heading" :id="headingId">{{ heading }}</h2>
        <p v-for="(p, i) in intro" :key="i">{{ p }}</p>
      </div>

      <ul v-if="layout === 'cards'" class="x-list x-cards">
        <li v-for="c in cards" :key="c.id">
          <component :is="c.href ? NuxtLink : 'div'" v-bind="c.href ? { to: c.href } : {}" class="x-card">
            <CmsImage v-if="c.image" :media="c.image" class="x-pic" sizes="(min-width: 80rem) 24rem, (min-width: 48rem) 46vw, 100vw" />
            <div class="x-head prose-look">
              <h3 class="x-title">{{ c.title }}</h3>
            </div>
            <p v-if="c.meta" class="x-meta">{{ c.meta }}</p>
            <p v-if="c.text" class="x-text">{{ c.text }}</p>
            <ul v-if="c.more.length" class="x-more">
              <li v-for="(m, i) in c.more" :key="i"><span v-if="m.label" class="x-more-label">{{ m.label }}</span> {{ m.value }}</li>
            </ul>
          </component>
        </li>
      </ul>

      <ul v-else class="x-list x-rows" :class="{ 'x-rows-plain': plainRows }">
        <li v-for="c in cards" :key="c.id">
          <component :is="c.href ? NuxtLink : 'div'" v-bind="c.href ? { to: c.href } : {}" class="x-row">
            <p v-if="!plainRows" class="x-meta">{{ c.meta }}</p>
            <div class="x-row-main">
              <div class="x-head prose-look">
                <h3 class="x-title">{{ c.title }}</h3>
              </div>
              <p v-if="c.text" class="x-text">{{ c.text }}</p>
              <ul v-if="c.more.length" class="x-more">
                <li v-for="(m, i) in c.more" :key="i"><span v-if="m.label" class="x-more-label">{{ m.label }}</span> {{ m.value }}</li>
              </ul>
            </div>
          </component>
        </li>
      </ul>
    </div>
  </section>
</template>

<style>
/* Every rule starts with .x-block and names two more classes: a look's own rules
   (html[data-look="…"] .prose-look h3) must not move the kit's spacing. */
.x-block { padding-block: clamp(3rem, 7vw, 6rem); }
.x-block .x-wrap { box-sizing: border-box; max-width: 80rem; margin-inline: auto; padding-inline: clamp(1.25rem, 4vw, 2.5rem); }
.x-block .x-intro > :first-child { margin-top: 0; }
.x-block .x-intro > :last-child { margin-bottom: 0; }
.x-block .x-wrap .x-list { list-style: none; margin: clamp(1.75rem, 3.5vw, 2.75rem) 0 0; padding: 0; }
.x-block .x-wrap .x-list:first-child { margin-top: 0; }

/* the places of an entry */
.x-block .x-head .x-title { margin: 0; }
.x-block .x-head.prose-look { max-width: none; }
.x-block .x-wrap .x-meta { margin: 0.45rem 0 0; font-size: 0.8125rem; line-height: 1.5; letter-spacing: 0.02em; opacity: 0.68; }
.x-block .x-wrap .x-text { margin: 0.6rem 0 0; opacity: 0.84; white-space: pre-line; display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 3; line-clamp: 3; overflow: hidden; }
.x-block .x-wrap .x-more { list-style: none; display: flex; flex-wrap: wrap; gap: 0.2rem 1.25rem; margin: 0.8rem 0 0; padding: 0; font-size: 0.8125rem; line-height: 1.5; }
.x-block .x-more .x-more-label { opacity: 0.66; }

/* cards */
.x-block .x-wrap .x-cards { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 20rem), 1fr)); gap: var(--x-gap, clamp(2rem, 3.5vw, 2.75rem)) var(--x-gap, clamp(1.5rem, 3vw, 2.5rem)); }
.x-block .x-cards .x-card { display: block; height: 100%; color: inherit; text-decoration: none; }
.x-block .x-card .x-pic { display: block; width: 100%; height: auto; aspect-ratio: 4 / 3; object-fit: cover; border-radius: var(--x-radius, 0); margin: 0 0 1.1rem; }

/* rows */
.x-block .x-wrap .x-rows { border-top: 1px solid var(--x-line, color-mix(in oklab, currentColor 16%, transparent)); }
.x-block .x-rows > li { border-bottom: 1px solid var(--x-line, color-mix(in oklab, currentColor 16%, transparent)); }
.x-block .x-rows .x-row { display: grid; grid-template-columns: minmax(9rem, 14rem) minmax(0, 1fr); gap: 0.3rem clamp(1.5rem, 4vw, 3rem); padding-block: clamp(1.1rem, 2.2vw, 1.5rem); color: inherit; text-decoration: none; }
.x-block .x-rows.x-rows-plain .x-row { grid-template-columns: minmax(0, 1fr); }
.x-block .x-rows .x-row .x-meta { margin-top: 0.3em; }
.x-block .x-rows .x-text { -webkit-line-clamp: 2; line-clamp: 2; }
@media (max-width: 40rem) {
  .x-block .x-rows .x-row { grid-template-columns: minmax(0, 1fr); }
  .x-block .x-rows .x-row .x-meta { margin-top: 0; }
}

/* a link: the title underlined on hover, a visible ring for the keyboard */
.x-block a.x-card:hover .x-title,
.x-block a.x-row:hover .x-title { text-decoration: underline; text-decoration-thickness: 1px; text-underline-offset: 0.18em; }
.x-block .x-list a:focus-visible { outline: 2px solid currentColor; outline-offset: 4px; border-radius: 2px; }
</style>
