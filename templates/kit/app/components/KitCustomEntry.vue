<script setup lang="ts">
// The page of one entry of the site's own type (`/kurzy/python`), the same in every look: the
// title, the picture, the short facts (dates, numbers, choices, links, yes/no, short texts) as
// one quiet list, then the texts, rich text, galleries and files in the type's order. It takes
// the look as KitEntries does: headings and texts in the look's `.prose-look`, colours inherited,
// lines and quiet text made from the text colour, `--x-radius` and `--x-line` when a look sets them.
import type { CustomType } from '../utils/customTypes'

const props = defineProps<{ entry: Record<string, any>; type: CustomType }>()
const custom = await useCustomTypes()
const view = computed(() => customEntryView(props.entry, props.type, { lang: custom.lang, types: custom.types.value }))
const words = computed(() => kitEntryWords(custom.lang))
</script>

<template>
  <article class="x-block x-entry">
    <div class="x-wrap">
      <header class="x-entry-head prose-look">
        <h1 class="x-entry-title">{{ view.title }}</h1>
      </header>
      <CmsImage v-if="view.image" :media="view.image" class="x-entry-pic" eager sizes="(min-width: 80rem) 75rem, 100vw" />
      <div class="x-entry-body" :class="{ 'x-entry-plain': !view.facts.length }">
        <ul v-if="view.facts.length" class="x-facts">
          <li v-for="f in view.facts" :key="f.key">
            <span v-if="f.label" class="x-fact-label">{{ f.label }}</span>
            <span class="x-fact-value">{{ f.value }}</span>
          </li>
        </ul>
        <div v-if="view.parts.length" class="x-entry-main">
          <template v-for="p in view.parts" :key="p.key">
            <div v-if="p.kind === 'text'" class="x-entry-part x-entry-text prose-look">
              <p v-for="(t, i) in p.paragraphs" :key="i">{{ t }}</p>
            </div>
            <CmsContent v-else-if="p.kind === 'rich'" :doc="p.doc" class="x-entry-part prose-look" />
            <section v-else-if="p.kind === 'gallery'" class="x-entry-part" :aria-label="p.label">
              <ul class="x-gallery">
                <li v-for="(m, i) in p.items" :key="m.id ?? i">
                  <figure>
                    <CmsImage :media="m" class="x-gallery-pic" sizes="(min-width: 64rem) 22rem, (min-width: 36rem) 45vw, 100vw" />
                    <figcaption v-if="m.caption">{{ m.caption }}</figcaption>
                  </figure>
                </li>
              </ul>
            </section>
            <p v-else-if="p.kind === 'file'" class="x-entry-part x-entry-file">
              <a :href="p.file.url" download>{{ words.download }}<span class="x-file-name">{{ p.name }}</span></a>
            </p>
          </template>
        </div>
      </div>
    </div>
  </article>
</template>

<style>
/* Every rule starts with .x-entry and names two more classes, as in KitEntries. */
.x-entry { padding-block: clamp(2.5rem, 6vw, 5rem) clamp(3rem, 7vw, 6rem); }
.x-entry .x-wrap { box-sizing: border-box; max-width: 80rem; margin-inline: auto; padding-inline: clamp(1.25rem, 4vw, 2.5rem); }
.x-entry .x-entry-head .x-entry-title { margin: 0; overflow-wrap: break-word; hyphens: auto; }
.x-entry .x-wrap .x-entry-pic { display: block; width: 100%; height: auto; aspect-ratio: 16 / 9; object-fit: cover; border-radius: var(--x-radius, 0); margin: clamp(1.75rem, 4vw, 3rem) 0 0; }
.x-entry .x-wrap .x-entry-body { display: grid; grid-template-columns: minmax(0, 1fr); gap: clamp(2rem, 4vw, 3rem); margin-top: clamp(2rem, 4.5vw, 3.5rem); }
@media (min-width: 56rem) {
  .x-entry .x-wrap .x-entry-body { grid-template-columns: minmax(12rem, 17rem) minmax(0, 44rem); gap: clamp(3rem, 6vw, 6rem); }
  .x-entry .x-wrap .x-entry-body.x-entry-plain { grid-template-columns: minmax(0, 44rem); }
}

/* the facts: label above value, a hairline between them */
.x-entry .x-wrap .x-facts { list-style: none; margin: 0; padding: 0; border-top: 1px solid var(--x-line, color-mix(in oklab, currentColor 16%, transparent)); align-self: start; }
.x-entry .x-facts > li { display: flex; flex-direction: column; gap: 0.15rem; padding-block: 0.75rem; border-bottom: 1px solid var(--x-line, color-mix(in oklab, currentColor 16%, transparent)); }
.x-entry .x-facts .x-fact-label { font-size: 0.8125rem; line-height: 1.5; letter-spacing: 0.02em; opacity: 0.68; }

/* the texts, the gallery, the file */
.x-entry .x-entry-main > .x-entry-part + .x-entry-part { margin-top: clamp(1.75rem, 3.5vw, 2.5rem); }
.x-entry .x-entry-main > .x-entry-part:first-child > :first-child { margin-top: 0; }
.x-entry .x-entry-main .x-entry-text > p + p { margin-top: 1em; }
.x-entry .x-entry-part .x-gallery { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 13rem), 1fr)); gap: var(--x-gap, clamp(0.75rem, 2vw, 1.25rem)); }
.x-entry .x-gallery figure { margin: 0; }
.x-entry .x-gallery .x-gallery-pic { display: block; width: 100%; height: auto; aspect-ratio: 4 / 3; object-fit: cover; border-radius: var(--x-radius, 0); }
.x-entry .x-gallery figcaption { margin-top: 0.5rem; font-size: 0.8125rem; line-height: 1.5; opacity: 0.68; }
.x-entry .x-entry-file a { color: inherit; text-decoration: underline; text-decoration-thickness: 1px; text-underline-offset: 0.2em; }
.x-entry .x-entry-file .x-file-name { opacity: 0.68; margin-left: 0.6em; }
.x-entry .x-entry-file a:focus-visible { outline: 2px solid currentColor; outline-offset: 4px; border-radius: 2px; }
</style>
