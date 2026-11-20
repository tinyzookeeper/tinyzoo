<script setup lang="ts">
// The dark banner (the website roadmap's "Now" card): a charcoal card with a Manrope title,
// a short cream text, optional actions, and an animal (`animal` / `seed`) or Keeper's own
// mark (`mark`) peeking up from the bottom-right edge, cut off by the card. On a narrow
// card the peeker drops below the text, at the right. One per page, for the thing that
// matters most there.
//
// Actions go in the `actions` slot as ordinary UButtons: on the card, `color="primary"` is a
// cream button with ink text and `color="neutral" variant="ghost"` a quiet cream one.
import markReversed from '../assets/brand/logo/mark-reversed.svg?url'

withDefaults(defineProps<{
  title: string
  text?: string
  animal?: string
  seed?: string
  mark?: boolean
  /** The title's element: `h1` when the banner opens the page, `h2` otherwise. */
  as?: 'h1' | 'h2' | 'h3' | 'p'
}>(), { as: 'h2' })
</script>

<template>
  <div class="k-banner-frame">
    <section class="k-banner">
      <div class="k-banner__body">
        <component :is="as" class="k-banner__title">{{ title }}</component>
        <div v-if="text || $slots.default" class="k-banner__text">
          <slot>{{ text }}</slot>
        </div>
        <div v-if="$slots.actions" class="k-banner__actions">
          <slot name="actions" />
        </div>
      </div>
      <img v-if="mark" :src="markReversed" alt="" aria-hidden="true" draggable="false" class="k-banner__peek k-banner__peek--mark select-none">
      <KAnimal v-else-if="animal || seed" :name="animal" :seed="seed" class="k-banner__peek" />
    </section>
  </div>
</template>

<style scoped>
/* The card's own width decides when it stacks, so it works in a sidebar as well as a page. */
.k-banner-frame { container-type: inline-size; }

.k-banner {
  /* Nuxt UI's colours, re-pointed for a charcoal card (primary = the cream button). */
  --ui-primary: var(--color-cream);
  --ui-text-inverted: #131313;
  --ui-text: rgb(249 245 239 / 0.82);
  --ui-text-highlighted: var(--color-cream);
  --ui-text-muted: rgb(249 245 239 / 0.7);
  --ui-text-dimmed: rgb(249 245 239 / 0.6);
  --ui-bg-elevated: rgb(249 245 239 / 0.1);
  --ui-bg-accented: rgb(249 245 239 / 0.16);
  --ui-border-accented: rgb(249 245 239 / 0.28);

  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  column-gap: 1.25rem;
  padding: 1.5rem 1.5rem 0;
  border-radius: 1.25rem;
  background: var(--color-charcoal);
  color: var(--color-cream);
  overflow: hidden;
}
/* Charcoal night: a step lighter than the page's charcoal, with a hairline, so it still stands apart. */
html.dark .k-banner { background: #383B41; box-shadow: inset 0 0 0 1px rgb(249 245 239 / 0.08); }

.k-banner__body { min-width: 0; padding-bottom: 1.5rem; }
.k-banner__title { font-family: var(--font-display); font-size: 1.5rem; line-height: 1.25; font-weight: 800; letter-spacing: -0.025em; text-wrap: balance; }
.k-banner__text { max-width: 52ch; margin-top: 0.5rem; line-height: 1.6; color: rgb(249 245 239 / 0.8); text-wrap: pretty; }
.k-banner__actions { display: flex; flex-wrap: wrap; gap: 0.5rem; margin-top: 1.125rem; }

/* The peeker stands on the card's bottom edge and the card cuts its feet off. */
.k-banner__peek { width: 8.5rem; height: auto; align-self: end; margin-bottom: -6px; }
.k-banner__peek--mark { width: 7.5rem; margin-bottom: -0.875rem; }

@container (max-width: 34rem) {
  .k-banner { grid-template-columns: minmax(0, 1fr); padding: 1.25rem 1.25rem 0; }
  .k-banner__body { padding-bottom: 0.75rem; }
  .k-banner__title { font-size: 1.3125rem; }
  .k-banner__peek { width: 6.5rem; justify-self: end; }
  .k-banner__peek--mark { width: 6rem; margin-bottom: -0.75rem; }
}
</style>
