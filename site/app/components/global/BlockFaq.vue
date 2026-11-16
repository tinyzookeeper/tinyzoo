<script setup lang="ts">
// Questions that open (native <details>: works without JavaScript and with the keyboard).
defineProps<{ block: { heading: string; text?: string | null; items: { id: string; question: string; answer: string }[] } }>()
</script>

<template>
  <section class="section bg-cream">
    <div class="wrap grid gap-12 lg:grid-cols-[0.8fr_1.2fr]">
      <div>
        <h2 class="title text-4xl sm:text-5xl">{{ block.heading }}</h2>
        <p v-if="block.text" class="lede mt-5 whitespace-pre-line">{{ block.text }}</p>
        <img src="/animals/owl.svg" alt="" class="mt-10 hidden h-24 w-auto lg:block" aria-hidden="true">
      </div>
      <div class="faq">
        <details v-for="q in block.items" :key="q.id" class="faq-item">
          <summary>
            <span>{{ q.question }}</span>
            <span class="faq-icon" aria-hidden="true" />
          </summary>
          <p class="faq-answer whitespace-pre-line">{{ q.answer }}</p>
        </details>
      </div>
    </div>
  </section>
</template>

<style>
.faq { border-top: 1.5px solid var(--color-ink); }
.faq-item { border-bottom: 1px solid rgb(19 19 19 / 0.12); }
.faq-item summary { list-style: none; display: flex; align-items: center; justify-content: space-between; gap: 1.5rem; padding: 1.375rem 0; cursor: pointer; font-weight: 800; font-size: 1.125rem; letter-spacing: -0.015em; }
.faq-item summary::-webkit-details-marker { display: none; }
.faq-icon { position: relative; flex-shrink: 0; width: 1.75rem; height: 1.75rem; border-radius: 999px; background: #fff; box-shadow: 0 0 0 1px rgb(19 19 19 / 0.1); }
.faq-icon::before, .faq-icon::after { content: ""; position: absolute; left: 50%; top: 50%; width: 0.7rem; height: 1.5px; background: currentColor; transform: translate(-50%, -50%); transition: transform .2s ease; }
.faq-icon::after { transform: translate(-50%, -50%) rotate(90deg); }
.faq-item[open] .faq-icon::after { transform: translate(-50%, -50%) rotate(0deg); }
.faq-answer { padding: 0 3rem 1.5rem 0; line-height: 1.7; color: #3b3a37; }
</style>
