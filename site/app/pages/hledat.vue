<script setup lang="ts">
// The website search: /hledat, /en/search, /de/suche (?q=…). Pages and news, in the
// page's language, best matches first. Works without JavaScript (a plain form); with
// it, results follow the typing.
import { LANGS, SEARCH_SEGMENT, localePath, type Lang } from '~/lib/site-i18n'

definePageMeta({ alias: ['/en/search', '/de/suche'] })

const route = useRoute()
const router = useRouter()
const { lang, t, to } = useLang()
const { settings } = await useSite()

const q = computed(() => String(route.query.q ?? '').trim().slice(0, 100))
const { items, total, searched, pending, error } = await useCmsSearch(q, { locale: lang, limit: 30 })

// What is in the box; the address (and so the results) follows once typing settles.
const draft = ref(q.value)
watch(q, (v) => { if (v !== draft.value.trim()) draft.value = v })
let timer: ReturnType<typeof setTimeout> | undefined
const go = (value: string) => router.replace({ query: value.trim() ? { q: value.trim() } : {} })
function onInput() {
  clearTimeout(timer)
  timer = setTimeout(() => go(draft.value), 250)
}
function onSubmit() {
  clearTimeout(timer)
  go(draft.value)
}
onBeforeUnmount(() => clearTimeout(timer))
const input = ref<HTMLInputElement>()
onMounted(() => { if (!q.value) input.value?.focus() })

const homeOf = (p: string) => p.replace(/\/home$/, '') || '/'
const kindOf = (entity: string) => (entity === 'news' ? t('searchKindNews') : t('searchKindPage'))
const count = computed(() => {
  const n = total.value
  const rule = new Intl.PluralRules(lang.value).select(n)
  const text = n === 1 ? t('searchCountOne') : rule === 'few' ? t('searchCountFew') : t('searchCount')
  return text.replace('{n}', String(n))
})
const nothing = computed(() => t('searchNothing').replace('{q}', searched.value || q.value))
const showResults = computed(() => q.value.length >= 2)

// The same search in the other languages.
const alternates = useAlternates()
watchEffect(() => {
  const out: Partial<Record<Lang, string>> = {}
  for (const l of LANGS) out[l] = localePath(`/${SEARCH_SEGMENT[l]}`, l) + (q.value ? `?q=${encodeURIComponent(q.value)}` : '')
  alternates.value = out
})
useHead({
  htmlAttrs: { lang },
  title: () => [q.value ? `${q.value} · ${t('searchTitle')}` : t('searchTitle'), settings.value?.siteName].filter(Boolean).join(' · '),
  // Results pages are not pages of their own for search engines.
  meta: [{ name: 'robots', content: 'noindex, follow' }],
})
useShareImage({ title: t('searchTitle'), description: settings.value?.metaDescription })
</script>

<template>
  <section class="section !pt-16">
    <div class="wrap max-w-3xl">
      <p class="eyebrow">{{ settings?.siteName ?? 'tinyzoo' }}</p>
      <h1 class="display mt-4 text-5xl sm:text-6xl">{{ t('searchTitle') }}</h1>

      <form role="search" :action="to(`/${SEARCH_SEGMENT[lang]}`)" method="get" class="search-form mt-10" @submit.prevent="onSubmit">
        <label for="search-q" class="search-label">{{ t('searchLabel') }}</label>
        <div class="search-box">
          <UIcon name="i-lucide-search" class="search-icon" aria-hidden="true" />
          <input
            id="search-q" ref="input" v-model="draft" name="q" type="search" maxlength="100"
            autocomplete="off" enterkeyhint="search" :placeholder="t('searchPlaceholder')"
            @input="onInput"
          >
          <button type="submit" class="btn btn-dark search-submit">{{ t('search') }}</button>
        </div>
      </form>

      <div aria-live="polite" class="mt-8">
        <p v-if="!showResults" class="text-mute">{{ t('searchHint') }}</p>
        <p v-else-if="error" class="text-mute">{{ t('searchError') }}</p>
        <template v-else-if="!pending || items.length">
          <p v-if="items.length" class="search-count">{{ count }}</p>
          <p v-else-if="!pending" class="text-mute">{{ nothing }}</p>
        </template>
      </div>

      <ol v-if="showResults && items.length" class="search-results mt-4" :class="pending ? 'opacity-60' : ''">
        <li v-for="r in items" :key="`${r.entity}:${r.id}`">
          <NuxtLink v-if="r.path" :to="homeOf(r.path)" class="search-hit group">
            <span class="search-kind">{{ kindOf(r.entity) }}</span>
            <h2 class="search-hit-title group-hover:underline decoration-2 underline-offset-4">
              <CmsHighlight :text="r.title" :ranges="r.titleHighlights" />
            </h2>
            <p v-if="r.excerpt" class="search-excerpt"><CmsHighlight :text="r.excerpt" :ranges="r.highlights" /></p>
          </NuxtLink>
        </li>
      </ol>
    </div>
  </section>
</template>

<style>
.search-label { display: block; font-weight: 700; font-size: 0.9375rem; margin-bottom: 0.625rem; }
.search-box { position: relative; display: flex; gap: 0.5rem; align-items: center; padding: 0.375rem; border-radius: 999px; background: var(--color-paper); box-shadow: inset 0 0 0 1.5px rgb(19 19 19 / 0.14); transition: box-shadow .15s ease; }
.search-box:focus-within { box-shadow: inset 0 0 0 2px var(--color-ink); }
.search-icon { width: 1.25rem; height: 1.25rem; margin-left: 0.875rem; flex-shrink: 0; color: var(--color-mute); }
.search-box input { flex: 1; min-width: 0; min-height: 2.75rem; border: 0; background: transparent; font: inherit; font-size: 1.0625rem; color: var(--color-ink); }
.search-box input:focus { outline: none; }
.search-box input::-webkit-search-cancel-button { cursor: pointer; }
.search-submit { min-height: 2.75rem !important; padding: 0 1.25rem !important; font-size: 0.9375rem; }
@media (max-width: 479px) { .search-submit { display: none !important; } }
.search-count { font-size: 0.875rem; font-weight: 700; color: var(--color-mute); }
.search-results { display: grid; gap: 0.875rem; transition: opacity .15s ease; }
.search-hit { display: block; padding: 1.25rem 1.5rem; border-radius: 1.25rem; background: var(--color-cream); transition: box-shadow .15s ease; }
.search-hit:hover { box-shadow: 0 0 0 1.5px rgb(19 19 19 / 0.12); }
.search-kind { font-size: 0.75rem; font-weight: 800; letter-spacing: 0.06em; text-transform: uppercase; color: var(--color-mute); }
.search-hit-title { margin-top: 0.375rem; font-family: var(--font-display); font-size: 1.375rem; font-weight: 800; letter-spacing: -0.02em; line-height: 1.25; }
.search-excerpt { margin-top: 0.5rem; line-height: 1.6; color: rgb(19 19 19 / 0.72); text-wrap: pretty; }
.search-hit mark { background: color-mix(in oklab, var(--color-bird) 45%, transparent); color: inherit; border-radius: 0.2em; padding: 0 0.1em; }
</style>
