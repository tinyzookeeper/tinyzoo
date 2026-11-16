<script setup lang="ts">
// The way into the demo admin: its address and login (from the site's settings,
// NUXT_PUBLIC_DEMO_*), one button, and what to try there.
defineProps<{ block: { heading: string; text?: string | null; tips: { id: string; text: string }[] } }>()
const demo = useRuntimeConfig().public.demo as { url?: string; email?: string; password?: string }
const loginUrl = computed(() => (demo.url ? `${demo.url.replace(/\/+$/, '')}/admin/login` : ''))
const { t } = useLang()
const copied = ref<string | null>(null)
async function copy(what: string, text: string) {
  try { await navigator.clipboard.writeText(text); copied.value = what; setTimeout(() => { if (copied.value === what) copied.value = null }, 1600) } catch {}
}
</script>

<template>
  <section class="section">
    <div class="wrap grid gap-12 lg:grid-cols-[1.1fr_0.9fr] lg:items-start">
      <div>
        <h1 class="display text-5xl sm:text-6xl">{{ block.heading }}</h1>
        <p v-if="block.text" class="lede mt-6 max-w-xl whitespace-pre-line">{{ block.text }}</p>
        <ol v-if="block.tips.length" class="mt-10 grid gap-3">
          <li v-for="(t, i) in block.tips" :key="t.id" class="flex gap-4 rounded-2xl bg-cream px-5 py-4">
            <span class="shrink-0 whitespace-nowrap font-mono text-sm text-mute pt-0.5">{{ String(i + 1).padStart(2, '0') }}</span>
            <span class="font-semibold">{{ t.text }}</span>
          </li>
        </ol>
      </div>
      <aside class="demo-card lg:sticky lg:top-28">
        <img src="/animals/frog.svg" alt="" class="demo-frog" aria-hidden="true">
        <p class="eyebrow !text-cream/60">{{ t('demoSignIn') }}</p>
        <template v-if="loginUrl">
          <dl class="mt-6 grid gap-3">
            <div v-for="row in [[t('demoEmail'), demo.email], [t('demoPassword'), demo.password]]" :key="row[0]" class="demo-row">
              <dt>{{ row[0] }}</dt>
              <dd>
                <code>{{ row[1] }}</code>
                <button type="button" class="demo-copy" :aria-label="`${t('copy')}: ${row[0]}`" @click="copy(row[0]!, row[1] ?? '')">
                  <UIcon :name="copied === row[0] ? 'i-lucide-check' : 'i-lucide-copy'" class="size-4" />
                </button>
              </dd>
            </div>
          </dl>
          <a :href="loginUrl" class="btn btn-cream mt-8 w-full" target="_blank" rel="noopener">
            {{ t('demoGo') }} <UIcon name="i-lucide-arrow-up-right" class="size-4" />
          </a>
          <p class="mt-4 text-sm text-cream/65">{{ t('demoHint') }}</p>
        </template>
        <p v-else class="mt-6 text-cream/70">{{ t('demoUnavailable') }}</p>
      </aside>
    </div>
  </section>
</template>

<style>
.demo-card { position: relative; border-radius: 1.75rem; background: var(--color-charcoal); color: var(--color-cream); padding: 2rem; }
@media (min-width: 640px) { .demo-card { padding: 2.5rem; } }
.demo-frog { position: absolute; right: 2rem; top: -2.6rem; height: 4rem; width: auto; }
.demo-row { display: grid; gap: 0.35rem; }
.demo-row dt { font-size: 0.8125rem; font-weight: 700; color: rgb(249 245 239 / 0.55); }
.demo-row dd { display: flex; align-items: center; gap: 0.5rem; border-radius: 0.875rem; background: rgb(249 245 239 / 0.08); padding: 0.5rem 0.5rem 0.5rem 1rem; }
.demo-row code { flex: 1; min-width: 0; overflow-x: auto; white-space: nowrap; font-family: var(--font-mono); font-size: 0.95rem; }
.demo-copy { display: grid; place-items: center; width: 2.75rem; height: 2.75rem; border-radius: 0.625rem; color: rgb(249 245 239 / 0.7); }
.demo-copy:hover { background: rgb(249 245 239 / 0.1); color: var(--color-cream); }
</style>
