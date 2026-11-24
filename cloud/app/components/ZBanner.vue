<script setup lang="ts">
// The dark banner: a charcoal card with a Manrope title, a short cream text, actions, and an
// animal standing on its bottom edge (the card cuts its feet off). On a narrow card the animal
// drops below the text, at the right. One per page, for the thing that matters most there.
//
// Actions go in the `actions` slot as ordinary UButtons: on the card, `color="primary"` is a
// cream button with ink text and `color="neutral" variant="ghost"` a quiet cream one.
withDefaults(defineProps<{ title: string; text?: string; animal?: string; as?: 'h1' | 'h2' | 'h3' | 'p' }>(), { as: 'h2' })
</script>

<template>
  <div class="z-banner-frame">
    <section class="z-banner">
      <div class="z-banner__body">
        <component :is="as" class="z-banner__title">{{ title }}</component>
        <div v-if="text || $slots.default" class="z-banner__text">
          <slot>{{ text }}</slot>
        </div>
        <div v-if="$slots.actions" class="z-banner__actions">
          <slot name="actions" />
        </div>
      </div>
      <ZAnimal v-if="animal" :name="animal" class="z-banner__peek" />
    </section>
  </div>
</template>

<style scoped>
.z-banner-frame { container-type: inline-size; }
.z-banner {
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
  column-gap: 1.5rem;
  padding: 1.75rem 1.75rem 0;
  border-radius: 1.25rem;
  background: var(--color-charcoal);
  color: var(--color-cream);
  overflow: hidden;
}
html.dark .z-banner { background: #383B41; box-shadow: inset 0 0 0 1px rgb(249 245 239 / 0.08); }
.z-banner :deep(.bg-primary) { color: #131313; }
.z-banner__body { min-width: 0; padding-bottom: 1.75rem; }
.z-banner__title { font-family: var(--font-display); font-size: 1.625rem; line-height: 1.2; font-weight: 800; letter-spacing: -0.025em; text-wrap: balance; }
.z-banner__text { max-width: 52ch; margin-top: 0.5rem; line-height: 1.6; color: rgb(249 245 239 / 0.8); text-wrap: pretty; }
.z-banner__actions { display: flex; flex-wrap: wrap; gap: 0.5rem; margin-top: 1.25rem; }
.z-banner__peek { width: 9.5rem; height: auto; align-self: end; margin-bottom: -6px; margin-right: 0.5rem; }

@container (max-width: 34rem) {
  .z-banner { grid-template-columns: minmax(0, 1fr); padding: 1.25rem 1.25rem 0; }
  .z-banner__body { padding-bottom: 0.75rem; }
  .z-banner__title { font-size: 1.375rem; }
  .z-banner__peek { width: 6.5rem; justify-self: end; margin-right: 0; }
}
</style>
