<script setup lang="ts">
// Block "section_questions" (kitSections()): questions with their answers, folded (the answer opens
// on a click) or open, drawn by the kit for every look inside the look's own frame (KitSection).
// Nothing at all when no question is written.
const props = defineProps<{ block: Record<string, any>; index?: number }>()
const plan = computed(() => questionsPlan(props.block))
const look = computed(() => sectionLook(props.block))
const intro = computed(() => paragraphs(plan.value?.text))
</script>

<template>
  <KitSection v-if="plan" :id="`section-${block.id ?? index ?? ''}`" :heading="plan.heading" :narrow="look.narrow" :close="look.close">
    <div class="kit-q-wrap">
      <div v-if="intro.length" class="kit-q-intro prose-look">
        <p v-for="(p, i) in intro" :key="i">{{ p }}</p>
      </div>

      <div class="kit-q-list" :class="plan.open ? 'kit-q-open' : 'kit-q-folded'">
        <template v-if="plan.open">
          <div v-for="q in plan.items" :key="q.id" class="kit-q">
            <div class="kit-q-head prose-look"><h3 class="kit-q-title">{{ q.question }}</h3></div>
            <p v-if="q.answer" class="kit-q-answer">{{ q.answer }}</p>
          </div>
        </template>
        <template v-else>
          <details v-for="q in plan.items" :key="q.id" class="kit-q">
            <summary class="kit-q-sum prose-look"><h3 class="kit-q-title">{{ q.question }}</h3></summary>
            <div v-if="q.answer" class="kit-q-answer">{{ q.answer }}</div>
          </details>
        </template>
      </div>
    </div>
  </KitSection>
</template>

<style>
/* Every rule starts with .kit-section and names two more classes (see KitSection). The h3s sit in
   .prose-look, so they take the look's own h3; the margins are the kit's. */
.kit-section .kit-q-wrap { max-width: 48rem; margin-inline: var(--custom-center, 0); }
.kit-section .kit-q-wrap .kit-q-intro > :first-child { margin-top: 0; }
.kit-section .kit-q-wrap .kit-q-intro > :last-child { margin-bottom: 0; }
.kit-section .kit-q-wrap .kit-q-list { margin: clamp(1.75rem, 3.5vw, 2.75rem) 0 0; border-top: 1px solid var(--custom-line, color-mix(in oklab, currentColor 16%, transparent)); }
.kit-section .kit-q-wrap .kit-q-list:first-child { margin-top: 0; }
.kit-section .kit-q-list .kit-q { border-bottom: 1px solid var(--custom-line, color-mix(in oklab, currentColor 16%, transparent)); }
.kit-section .kit-q-list .kit-q-title { margin: 0; overflow-wrap: anywhere; }
.kit-section .kit-q-head.prose-look,
.kit-section .kit-q-sum.prose-look { max-width: none; }
.kit-section .kit-q-list .kit-q-answer { margin: 0; white-space: pre-line; overflow-wrap: anywhere; opacity: 0.84; }
/* open: the question, then its answer */
.kit-section .kit-q-open .kit-q { padding-block: clamp(1.1rem, 2.2vw, 1.5rem); }
.kit-section .kit-q-open .kit-q-answer { margin-top: 0.6rem; }
/* folded: the whole row is the summary; a plus at its right end turns into a minus when it is open */
.kit-section .kit-q-folded .kit-q-sum { position: relative; display: block; list-style: none; cursor: pointer; padding-block: clamp(1.1rem, 2.2vw, 1.4rem); padding-inline-end: 2.5rem; }
.kit-section .kit-q-folded .kit-q-sum::-webkit-details-marker { display: none; }
.kit-section .kit-q-folded .kit-q-sum::before,
.kit-section .kit-q-folded .kit-q-sum::after { content: ''; position: absolute; right: 0.3rem; top: 50%; width: 0.875rem; height: 2px; margin-top: -1px; background: currentColor; transition: transform 0.2s ease; }
.kit-section .kit-q-folded .kit-q-sum::after { transform: rotate(90deg); }
.kit-section .kit-q-folded .kit-q[open] .kit-q-sum::after { transform: rotate(0deg); }
.kit-section .kit-q-folded .kit-q-sum:hover .kit-q-title { text-decoration: underline; text-decoration-thickness: 1px; text-underline-offset: 0.18em; }
.kit-section .kit-q-folded .kit-q-sum:focus-visible { outline: 2px solid currentColor; outline-offset: 4px; border-radius: 2px; }
.kit-section .kit-q-folded .kit-q-answer { padding-bottom: clamp(1.1rem, 2.2vw, 1.4rem); padding-inline-end: 2.5rem; }
@media (prefers-reduced-motion: reduce) {
  .kit-section .kit-q-folded .kit-q-sum::before, .kit-section .kit-q-folded .kit-q-sum::after { transition: none; }
}
</style>
