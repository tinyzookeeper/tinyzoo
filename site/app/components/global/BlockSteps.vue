<script setup lang="ts">
// Numbered steps, each optionally with a command to copy.
defineProps<{ block: { eyebrow?: string | null; heading: string; items: { id: string; title: string; text?: string | null; command?: string | null }[] } }>()
const { t } = useLang()
const copied = ref<string | null>(null)
async function copy(id: string, text: string) {
  try { await navigator.clipboard.writeText(text); copied.value = id; setTimeout(() => { if (copied.value === id) copied.value = null }, 1600) } catch {}
}
</script>

<template>
  <section class="section">
    <div class="wrap">
      <p v-if="block.eyebrow" class="eyebrow">{{ block.eyebrow }}</p>
      <h2 class="title mt-4 max-w-2xl text-4xl sm:text-5xl">{{ block.heading }}</h2>
      <ol class="steps mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <li v-for="(s, i) in block.items" :key="s.id" class="step">
          <span class="step-num">{{ i + 1 }}</span>
          <h3 class="mt-6 text-lg font-extrabold tracking-[-0.015em]">{{ s.title }}</h3>
          <p v-if="s.text" class="mt-2 text-[0.95rem] leading-relaxed text-mute whitespace-pre-line">{{ s.text }}</p>
          <button v-if="s.command" type="button" class="step-cmd" :aria-label="`${t('copy')}: ${s.command}`" @click="copy(s.id, s.command!)">
            <code>{{ s.command }}</code>
            <UIcon :name="copied === s.id ? 'i-lucide-check' : 'i-lucide-copy'" class="size-3.5 shrink-0 opacity-60" />
          </button>
        </li>
      </ol>
    </div>
  </section>
</template>

<style>
.step { position: relative; display: flex; flex-direction: column; padding: 1.5rem; border-radius: 1.25rem; background: var(--color-cream); }
.step-num { display: grid; place-items: center; width: 2.5rem; height: 2.5rem; border-radius: 999px; background: var(--color-charcoal); color: var(--color-cream); font-family: var(--font-display); font-weight: 800; }
.step-cmd { margin-top: auto; padding-top: 1.25rem; display: flex; align-items: center; justify-content: space-between; gap: 0.5rem; width: 100%; text-align: left; }
.step-cmd code { flex: 1; min-width: 0; overflow-x: auto; white-space: nowrap; padding: 0.55rem 0.75rem; border-radius: 0.625rem; background: #fff; font-family: var(--font-mono); font-size: 0.8125rem; box-shadow: 0 0 0 1px rgb(19 19 19 / 0.07); }
</style>
