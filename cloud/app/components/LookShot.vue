<script setup lang="ts">
import { pictureOf, templateById, wordmarkOf } from '#shared/templates'

// The first screen of a template's look, as a picture, with a site's own name written where
// the look writes it: in the look's typeface, size and colour (measured on a real site, see
// scripts/template-pictures.mjs). This is how "your site" is shown before it exists: in the
// wizard as the name is typed, while the site is being made, on its card.
//
// A look that was not measured (a planned template: only its design exists) shows its picture
// as it is.
const props = withDefaults(defineProps<{
  template: string
  look?: string | null
  /** The site's name. */
  name?: string
  /** Whether the name is written yet (it fades in). */
  named?: boolean
  /** Load at once (the picture is the page's main one). */
  eager?: boolean
}>(), { look: null, name: '', named: true, eager: false })

const lookId = computed(() => props.look || templateById(props.template)?.looks[0]?.id || null)
const wordmark = computed(() => wordmarkOf(props.template, lookId.value))
const src = computed(() => pictureOf(props.template, lookId.value, wordmark.value ? 'top' : 'card'))
useWordmarkFont(wordmark)

const words = computed(() => props.name.trim().split(/\s+/).filter(Boolean))
const lead = computed(() => words.value.slice(0, -1).join(' '))
const last = computed(() => words.value.at(-1) ?? '')
// Everything in the measure of the picture's own width (it was taken 1440 px wide).
const cq = (px: number) => `${(px / 14.4).toFixed(3)}cqw`
const style = computed(() => {
  const w = wordmark.value
  if (!w) return {}
  return {
    left: `${(w.x / 14.4).toFixed(3)}%`,
    top: `${(w.y / 9).toFixed(3)}%`,
    maxWidth: `${(w.maxWidth / 14.4).toFixed(3)}%`,
    transform: `translate(${w.anchor === 'center' ? '-50%' : '0'}, -50%)`,
    fontFamily: `"${wordmarkFamily(w)}", ${/serif/i.test(w.family) || ['Newsreader'].includes(w.family) ? 'Georgia, serif' : 'var(--font-sans)'}`,
    fontSize: cq(w.size),
    fontWeight: String(w.weight),
    fontStretch: w.stretch || undefined,
    color: w.color,
    textTransform: w.transform || undefined,
    letterSpacing: w.spacing ? cq(Number.parseFloat(w.spacing)) : undefined,
  }
})
</script>

<template>
  <div class="shot" aria-hidden="true">
    <img :src="src" alt="" :loading="eager ? 'eager' : 'lazy'" draggable="false">
    <span v-if="wordmark" class="shot__name" :class="{ 'is-on': named && words.length }" :style="style">
      <template v-if="wordmark.italicLast && lead">{{ lead }} <em>{{ last }}</em></template>
      <template v-else>{{ name.trim() }}</template>
    </span>
  </div>
</template>

<style scoped>
.shot { position: relative; container-type: inline-size; aspect-ratio: 16 / 10; overflow: hidden; background: var(--z-paper-softer); }
.shot img { display: block; width: 100%; height: 100%; object-fit: cover; object-position: top; user-select: none; }
.shot__name { position: absolute; line-height: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; padding-block: 0.15em; opacity: 0; transition: opacity 400ms; }
.shot__name.is-on { opacity: 1; }
.shot__name em { font-style: italic; }
</style>
