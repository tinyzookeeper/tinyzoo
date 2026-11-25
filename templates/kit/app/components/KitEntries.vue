<script setup lang="ts">
// The entries of one of the site's own types, as the two generic blocks draw them (BlockCustomEntries,
// BlockCustomChosen): a heading and a short text, then the entries as cards or as rows. It is drawn
// inside the look's frame, its own Text part (LookPart): the container, the space above and below
// and the heading are the look's. Inside, the same markup in every look, made from what all looks
// share: texts sit in the look's `.prose-look`, colours are inherited, lines and quiet text are
// made from the text colour.
// A look may refine it with `--custom-radius` (the pictures' corners), `--custom-line` (the lines) and
// `--custom-gap` (the space between cards); each has a fallback, so no look has to.
import type { CustomCard } from '../utils/customTypes'

const props = defineProps<{
  /** The block's id: the section's id is made from it. */
  id: string
  heading: string
  text: string
  layout: 'cards' | 'rows'
  cards: CustomCard[]
}>()

const NuxtLink = resolveComponent('NuxtLink')
const sectionId = computed(() => `custom-${props.id}`)
const intro = computed(() => paragraphs(props.text))
// Rows keep the column of the quiet line only when an entry has one.
const plainRows = computed(() => props.cards.every((c) => !c.meta))
</script>

<template>
  <LookPart :id="sectionId" part="Text" :block="{ heading, body: null }" :first="false" class="custom-block" :aria-label="heading || undefined">
    <div class="custom-wrap">
      <div v-if="intro.length" class="custom-intro prose-look">
        <p v-for="(p, i) in intro" :key="i">{{ p }}</p>
      </div>

      <ul v-if="layout === 'cards'" class="custom-list custom-cards">
        <li v-for="c in cards" :key="c.id">
          <component :is="c.href ? NuxtLink : 'div'" v-bind="c.href ? { to: c.href } : {}" class="custom-card">
            <CmsImage v-if="c.image" :media="c.image" class="custom-pic" sizes="(min-width: 80rem) 24rem, (min-width: 48rem) 46vw, 100vw" />
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
.custom-block .custom-wrap .custom-cards { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 20rem), 1fr)); gap: var(--custom-gap, clamp(2rem, 3.5vw, 2.75rem)) var(--custom-gap, clamp(1.5rem, 3vw, 2.5rem)); }
.custom-block .custom-cards .custom-card { display: block; height: 100%; color: inherit; text-decoration: none; }
.custom-block .custom-card .custom-pic { display: block; width: 100%; height: auto; aspect-ratio: 4 / 3; object-fit: cover; border-radius: var(--custom-radius, 0); margin: 0 0 1.1rem; }

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

/* a link: the title underlined on hover, a visible ring for the keyboard */
.custom-block a.custom-card:hover .custom-title,
.custom-block a.custom-row:hover .custom-title { text-decoration: underline; text-decoration-thickness: 1px; text-underline-offset: 0.18em; }
.custom-block .custom-list a:focus-visible { outline: 2px solid currentColor; outline-offset: 4px; border-radius: 2px; }
</style>
