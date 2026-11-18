<script setup lang="ts">
// Search in a palette over the page: the header's search button, ⌘K / Ctrl+K or "/".
// Results follow the typing (pages and news, in the page's language, typos forgiven, then
// the documentation);
// ↑↓ and Enter open one, "All results" opens the full search page with the same words.
import type { ButtonProps, CommandPaletteGroup, CommandPaletteItem } from '@nuxt/ui'
import { SEARCH_SEGMENT } from '~/lib/site-i18n'
import type { DocsSearchHit } from '#shared/docs'

const open = defineModel<boolean>('open', { default: false })
const { lang, t, to } = useLang()

interface Hit { entity: string; id: string; title: string; titleHighlights: [number, number][]; excerpt: string; highlights: [number, number][]; path: string | null }

const term = ref('')
const hits = ref<Hit[]>([])
const docHits = ref<DocsSearchHit[]>([])
const total = ref(0)
// Nuxt UI types the close button as ButtonProps only, yet v-binds it, so HTML attributes reach the button.
const closeButton = computed(() => ({ color: 'neutral', variant: 'ghost', 'aria-label': t('close') }) as ButtonProps)
const searched = ref('')
const loading = ref(false)
const failed = ref(false)
let timer: ReturnType<typeof setTimeout> | undefined
let seq = 0

watch(term, (value) => {
  clearTimeout(timer)
  const q = value.trim()
  if (q.length < 2) {
    seq++
    hits.value = []
    docHits.value = []
    total.value = 0
    searched.value = ''
    loading.value = false
    return
  }
  loading.value = true
  timer = setTimeout(async () => {
    const mine = ++seq
    try {
      const [res, docs] = await Promise.all([
        $fetch<{ items: Hit[]; total: number }>('/api/content/_search', { query: { q, locale: lang.value, limit: 8 } }),
        // The documentation too (it is not in the database: /api/site-docs/search).
        $fetch<{ items: DocsSearchHit[]; total: number }>('/api/site-docs/search', { query: { q, lang: lang.value, limit: 6 } }).catch(() => ({ items: [], total: 0 })),
      ])
      if (mine !== seq) return
      hits.value = res.items
      docHits.value = docs.items
      total.value = res.total + docs.total
      searched.value = q
      failed.value = false
    }
    catch {
      if (mine === seq) { hits.value = []; docHits.value = []; failed.value = true }
    }
    finally {
      if (mine === seq) loading.value = false
    }
  }, 160)
})
// Each time it opens, it starts empty.
watch(open, (v) => { if (!v) { term.value = ''; clearTimeout(timer) } })
onBeforeUnmount(() => clearTimeout(timer))

const homeOf = (p: string) => p.replace(/\/home$/, '') || '/'
const searchPage = (q: string) => `${to(`/${SEARCH_SEGMENT[lang.value]}`)}${q ? `?q=${encodeURIComponent(q)}` : ''}`
const kindOf = (entity: string) => (entity === 'news' ? t('searchKindNews') : t('searchKindPage'))

const groups = computed<CommandPaletteGroup<CommandPaletteItem>[]>(() => {
  const out: CommandPaletteGroup<CommandPaletteItem>[] = []
  if (hits.value.length) {
    out.push({
      id: 'results',
      // Matched and ranked by the server: shown as they come.
      ignoreFilter: true,
      items: hits.value.filter((h) => h.path).map((h) => ({
        id: `${h.entity}:${h.id}`,
        label: h.title,
        suffix: kindOf(h.entity),
        icon: h.entity === 'news' ? 'i-lucide-sparkles' : 'i-lucide-file-text',
        to: homeOf(h.path!),
        // Not marked as "the page you are on": only the keyboard/mouse choice is highlighted.
        active: false,
        slot: 'hit' as const,
        hit: h,
      })),
    })
  }
  if (docHits.value.length) {
    out.push({
      id: 'docs',
      label: t('searchInDocs'),
      ignoreFilter: true,
      items: docHits.value.map((h) => ({
        id: `docs:${h.id}`,
        label: h.title,
        suffix: h.page || t('searchKindDocs'),
        icon: 'i-lucide-book-open',
        to: h.path,
        active: false,
        slot: 'hit' as const,
        hit: h,
      })),
    })
  }
  return out
})

const hint = computed(() => {
  if (term.value.trim().length < 2) return t('searchHint')
  if (failed.value) return t('searchError')
  if (loading.value) return ''
  return t('searchNothing').replace('{q}', searched.value || term.value.trim())
})

// ⌘K / Ctrl+K anywhere, "/" when not typing somewhere else.
defineShortcuts({
  meta_k: { usingInput: true, handler: () => { open.value = !open.value } },
  '/': () => { open.value = true },
})
</script>

<template>
  <UModal
    v-model:open="open"
    :title="t('searchTitle')"
    :description="t('searchHint')"
    :ui="{ overlay: 'bg-[rgb(19_19_19/0.35)] backdrop-blur-[2px]', content: 'site-palette flex flex-col overflow-hidden sm:max-w-2xl sm:top-[12vh] sm:translate-y-0 sm:max-h-[76vh] rounded-[1.25rem] ring-0 shadow-[0_30px_80px_-30px_rgb(19_19_19/0.5)]' }"
  >
    <template #content>
      <UCommandPalette
        v-model:search-term="term"
        :groups="groups"
        :loading="loading"
        :placeholder="t('searchPlaceholder')"
        :close="closeButton"
        icon="i-lucide-search"
        class="site-palette-inner min-h-0 flex-1"
        :ui="{
          input: '[&_input]:text-[1.0625rem] [&_input]:h-14 [&_svg]:text-[var(--color-mute)]',
          // One line only: under the input and above the key hints, in the site's own colour.
          root: 'divide-[rgb(19_19_19/0.08)]',
          viewport: 'divide-y-0',
          group: 'p-2 [&+&]:pt-0',
          item: 'rounded-xl px-3 py-2.5 items-start text-[var(--color-ink)] before:rounded-xl data-highlighted:not-data-disabled:before:bg-[var(--color-cream)] data-highlighted:not-data-disabled:text-[var(--color-ink)]',
          itemLeadingIcon: 'text-[var(--color-mute)] group-data-highlighted:not-group-data-disabled:text-[var(--color-ink)] mt-0.5',
          itemLabel: 'whitespace-normal',
          itemLabelSuffix: 'text-xs font-bold uppercase tracking-[0.06em] text-[var(--color-mute)]',
          empty: 'py-10',
        }"
        @update:model-value="open = false"
        @update:open="open = $event"
      >
        <template #hit-label="{ item }">
          <span class="site-palette-title"><CmsHighlight :text="item.hit.title" :ranges="item.hit.titleHighlights" /></span>
          <span class="site-palette-kind">{{ item.suffix }}</span>
        </template>
        <template #hit-description="{ item }">
          <span v-if="item.hit.excerpt" class="site-palette-excerpt"><CmsHighlight :text="item.hit.excerpt" :ranges="item.hit.highlights" /></span>
        </template>
        <template #empty>
          <p class="px-4 text-center text-[0.9375rem] text-[var(--color-mute)]">{{ hint }}</p>
        </template>
        <template #footer>
          <div class="site-palette-footer">
            <span class="site-palette-keys"><kbd>↑</kbd><kbd>↓</kbd> {{ t('searchKeysMove') }}</span>
            <span class="site-palette-keys"><kbd>↵</kbd> {{ t('searchKeysOpen') }}</span>
            <span class="site-palette-keys"><kbd>esc</kbd> {{ t('searchKeysClose') }}</span>
            <!-- The full search page with the same words (always in view, however long the list). -->
            <NuxtLink v-if="term.trim().length >= 2" :to="searchPage(term.trim())" class="site-palette-all" @click="open = false">
              {{ t('searchAll') }}<span v-if="total" class="site-palette-count">{{ total }}</span>
              <UIcon name="i-lucide-arrow-right" class="size-4" aria-hidden="true" />
            </NuxtLink>
          </div>
        </template>
      </UCommandPalette>
    </template>
  </UModal>
</template>

<style>
.site-palette { font-family: var(--font-sans, inherit); color: var(--color-ink); background: var(--color-paper); }
.site-palette-title { font-weight: 700; color: var(--color-ink); }
.site-palette-kind { margin-left: 0.5rem; font-size: 0.6875rem; font-weight: 800; letter-spacing: 0.06em; text-transform: uppercase; color: var(--color-mute); }
.site-palette-excerpt { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; white-space: normal; margin-top: 0.125rem; font-size: 0.875rem; line-height: 1.5; color: rgb(19 19 19 / 0.68); }
.site-palette mark { background: color-mix(in oklab, var(--color-bird) 45%, transparent); color: inherit; border-radius: 0.2em; padding: 0 0.08em; }
.site-palette-footer { display: flex; flex-wrap: wrap; gap: 1rem; align-items: center; padding: 0.5rem 0.75rem; font-size: 0.75rem; color: var(--color-mute); }
.site-palette-all { margin-left: auto; display: inline-flex; align-items: center; gap: 0.375rem; min-height: 2.25rem; padding: 0 0.75rem; border-radius: 999px; font-size: 0.8125rem; font-weight: 700; color: var(--color-ink); transition: background-color .15s ease; }
.site-palette-all:hover, .site-palette-all:focus-visible { background: var(--color-cream); }
.site-palette-count { display: inline-grid; place-items: center; min-width: 1.375rem; height: 1.375rem; padding: 0 0.375rem; border-radius: 999px; background: var(--color-cream); font-size: 0.6875rem; font-weight: 800; }
.site-palette-all:hover .site-palette-count { background: #fff; }
.site-palette-footer kbd { display: inline-grid; place-items: center; min-width: 1.25rem; height: 1.25rem; margin-right: 0.25rem; padding: 0 0.3rem; border-radius: 0.375rem; background: var(--color-cream); font-family: var(--font-mono); font-size: 0.6875rem; color: var(--color-ink); }
@media (max-width: 639px) { .site-palette-keys { display: none; } }
</style>
