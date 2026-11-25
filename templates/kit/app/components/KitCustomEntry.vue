<script setup lang="ts">
// The page of one entry of the site's own type (`/kurzy/python`), the same in every look: the
// title, the picture, the short facts (dates, numbers, choices, links, yes/no, short texts) as
// one quiet list, then the texts, rich text, galleries and files in the type's order. It takes
// the look as KitEntries does: headings and texts in the look's `.prose-look`, colours inherited,
// lines and quiet text made from the text colour, `--custom-radius` and `--custom-line` when a look sets them.
import type { CustomType } from '../utils/customTypes'

const props = defineProps<{ entry: Record<string, any>; type: CustomType }>()
const custom = await useCustomTypes()
const view = computed(() => customEntryView(props.entry, props.type, { lang: custom.lang, types: custom.types.value }))
const words = computed(() => kitEntryWords(custom.lang))
</script>

<template>
  <article class="custom-entry">
    <div class="custom-wrap">
      <header class="custom-entry-head prose-look">
        <h1 class="custom-entry-title">{{ view.title }}</h1>
      </header>
      <CmsImage v-if="view.image" :media="view.image" class="custom-entry-pic" eager sizes="(min-width: 80rem) 75rem, 100vw" />
      <div class="custom-entry-body" :class="{ 'custom-entry-plain': !view.facts.length }">
        <ul v-if="view.facts.length" class="custom-facts">
          <li v-for="f in view.facts" :key="f.key">
            <span v-if="f.label" class="custom-fact-label">{{ f.label }}</span>
            <span class="custom-fact-value">{{ f.value }}</span>
          </li>
        </ul>
        <div v-if="view.parts.length" class="custom-entry-main">
          <template v-for="p in view.parts" :key="p.key">
            <div v-if="p.kind === 'text'" class="custom-entry-part custom-entry-text prose-look">
              <p v-for="(t, i) in p.paragraphs" :key="i">{{ t }}</p>
            </div>
            <CmsContent v-else-if="p.kind === 'rich'" :doc="p.doc" class="custom-entry-part prose-look" />
            <section v-else-if="p.kind === 'gallery'" class="custom-entry-part" :aria-label="p.label">
              <ul class="custom-gallery">
                <li v-for="(m, i) in p.items" :key="m.id ?? i">
                  <figure>
                    <CmsImage :media="m" class="custom-gallery-pic" sizes="(min-width: 64rem) 22rem, (min-width: 36rem) 45vw, 100vw" />
                    <figcaption v-if="m.caption">{{ m.caption }}</figcaption>
                  </figure>
                </li>
              </ul>
            </section>
            <p v-else-if="p.kind === 'file'" class="custom-entry-part custom-entry-file">
              <a :href="p.file.url" download>{{ words.download }}<span class="custom-file-name">{{ p.name }}</span></a>
            </p>
          </template>
        </div>
      </div>
    </div>
  </article>
</template>

<style>
/* Every rule starts with .custom-entry and names two more classes, as in KitEntries. */
.custom-entry { padding-block: clamp(2.5rem, 6vw, 5rem) clamp(3rem, 7vw, 6rem); }
.custom-entry .custom-wrap { box-sizing: border-box; max-width: 80rem; margin-inline: auto; padding-inline: clamp(1.25rem, 4vw, 2.5rem); }
/* No look styles an h1 in .prose-look (they style h2 and h3): the title takes the look's typeface
   and colour and the kit's size. A look may refine it in its own stylesheet (.custom-entry-title). */
.custom-entry .custom-wrap .custom-entry-head { max-width: 56rem; }
.custom-entry .custom-entry-head .custom-entry-title { margin: 0; font-size: clamp(1.625rem, 1.15rem + 2.3vw, 3.25rem); line-height: 1.1; text-wrap: balance; overflow-wrap: break-word; }
.custom-entry .custom-wrap .custom-entry-pic { display: block; width: 100%; height: auto; aspect-ratio: 16 / 9; object-fit: cover; border-radius: var(--custom-radius, 0); margin: clamp(1.75rem, 4vw, 3rem) 0 0; }
.custom-entry .custom-wrap .custom-entry-body { display: grid; grid-template-columns: minmax(0, 1fr); gap: clamp(2rem, 4vw, 3rem); margin-top: clamp(2rem, 4.5vw, 3.5rem); }
@media (min-width: 56rem) {
  .custom-entry .custom-wrap .custom-entry-body { grid-template-columns: minmax(12rem, 17rem) minmax(0, 44rem); gap: clamp(3rem, 6vw, 6rem); }
  .custom-entry .custom-wrap .custom-entry-body.custom-entry-plain { grid-template-columns: minmax(0, 44rem); }
}

/* the facts: label above value, a hairline between them */
.custom-entry .custom-wrap .custom-facts { list-style: none; margin: 0; padding: 0; border-top: 1px solid var(--custom-line, color-mix(in oklab, currentColor 16%, transparent)); align-self: start; }
.custom-entry .custom-facts > li { display: flex; flex-direction: column; gap: 0.15rem; padding-block: 0.75rem; border-bottom: 1px solid var(--custom-line, color-mix(in oklab, currentColor 16%, transparent)); }
.custom-entry .custom-facts .custom-fact-label { font-size: 0.8125rem; line-height: 1.5; letter-spacing: 0.02em; opacity: 0.68; }

/* the texts, the gallery, the file */
.custom-entry .custom-entry-main > .custom-entry-part + .custom-entry-part { margin-top: clamp(1.75rem, 3.5vw, 2.5rem); }
.custom-entry .custom-entry-main > .custom-entry-part:first-child > :first-child { margin-top: 0; }
.custom-entry .custom-entry-main .custom-entry-text > p + p { margin-top: 1em; }
.custom-entry .custom-entry-part .custom-gallery { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 13rem), 1fr)); gap: var(--custom-gap, clamp(0.75rem, 2vw, 1.25rem)); }
.custom-entry .custom-gallery figure { margin: 0; }
.custom-entry .custom-gallery .custom-gallery-pic { display: block; width: 100%; height: auto; aspect-ratio: 4 / 3; object-fit: cover; border-radius: var(--custom-radius, 0); }
.custom-entry .custom-gallery figcaption { margin-top: 0.5rem; font-size: 0.8125rem; line-height: 1.5; opacity: 0.68; }
.custom-entry .custom-entry-file a { color: inherit; text-decoration: underline; text-decoration-thickness: 1px; text-underline-offset: 0.2em; }
.custom-entry .custom-entry-file .custom-file-name { opacity: 0.68; margin-left: 0.6em; }
.custom-entry .custom-entry-file a:focus-visible { outline: 2px solid currentColor; outline-offset: 4px; border-radius: 2px; }
</style>
