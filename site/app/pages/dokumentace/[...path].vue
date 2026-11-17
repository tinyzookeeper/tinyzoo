<script setup lang="ts">
// The documentation: /dokumentace, /en/docs, /de/dokumentation, its two parts and their
// pages (shared/docs.ts has the addresses). The pages are rendered from docs/ when the
// site is built (modules/docs) and read from /api/site-docs; nothing is in the database.
import { langOfPath } from '~/lib/site-i18n'
import { DOCS_LANGS, docsPath, sectionOfSegment, type DocsLang, type DocsNav, type DocsPageResponse, type DocsSegment } from '#shared/docs'

definePageMeta({
  alias: ['/en/docs/:path(.*)*', '/de/dokumentation/:path(.*)*'],
  // The language switcher (in the layout, which renders before this page) needs the same
  // page's address in each language before anything is drawn.
  middleware: async (route) => {
    const lang = langOfPath(route.path) as DocsLang
    const path = ([] as string[]).concat((route.params.path as string[] | string | undefined) ?? []).filter(Boolean)
    const section = sectionOfSegment(lang, path[0])
    let out: Partial<Record<DocsLang, string>> = Object.fromEntries(DOCS_LANGS.map((l) => [l, docsPath(l)]))
    if (section) {
      out = Object.fromEntries(DOCS_LANGS.map((l) => [l, docsPath(l, section)]))
      if (path[1]) {
        const res = await $fetch<DocsPageResponse>('/api/site-docs/page', { query: { lang, section, slug: path[1] } }).catch(() => null)
        if (res) out = res.page.alternates
      }
    }
    useAlternates().value = out
    useAlternatesFallback().value = null
  },
})

const route = useRoute()
const { lang, t, to } = useLang()
const { settings } = await useSite()
const segments = computed(() => ([] as string[]).concat(route.params.path ?? []).filter(Boolean))
const section = computed(() => sectionOfSegment(lang.value, segments.value[0]))
if (segments.value.length > 2 || (segments.value.length && !section.value)) {
  throw createError({ statusCode: 404, message: t('notFoundHead'), fatal: true })
}
const isLanding = computed(() => !segments.value.length)

const [{ data: nav }, { data, error }] = await Promise.all([
  useFetch<DocsNav>('/api/site-docs/nav', { query: { lang }, key: computed(() => `docs-nav:${lang.value}`) }),
  useFetch<DocsPageResponse>('/api/site-docs/page', {
    query: computed(() => ({ lang: lang.value, section: section.value, slug: segments.value[1] ?? '' })),
    key: computed(() => `docs-page:${lang.value}:${segments.value.join('/')}`),
    immediate: !isLanding.value,
  }),
])
if (!isLanding.value && (error.value || !data.value)) throw createError({ statusCode: 404, message: t('notFoundHead'), fatal: true })
const page = computed(() => (isLanding.value ? null : data.value?.page ?? null))

// Title, description, the same page in the other languages, the sharing image, schema.org.
const siteName = computed(() => settings.value?.siteName ?? 'tinyzoo')
const title = computed(() => (page.value ? page.value.title : t('docs')))
const description = computed(() => (page.value?.description || t('docsLede')).slice(0, 300))
// Set by the middleware above (the language switcher needs it first).
const alternates = useAlternates()
const siteUrl = useSiteConfig().url
useHead({
  htmlAttrs: { lang },
  title: () => (page.value ? `${title.value} · ${t('docs')} · ${siteName.value}` : `${t('docs')} · ${siteName.value}`),
  link: () => [
    ...Object.entries(alternates.value).map(([l, p]) => ({ rel: 'alternate' as const, hreflang: l, href: `${siteUrl}${p}` })),
    { rel: 'alternate' as const, hreflang: 'x-default', href: `${siteUrl}${alternates.value.cs ?? docsPath('cs')}` },
  ],
})
useSeoMeta({ description, ogTitle: title, ogDescription: description })
useShareImage({ title: page.value ? page.value.title : t('docsTitle'), description: description.value })
useSchemaOrg([
  defineWebPage({ '@type': page.value ? 'WebPage' : 'CollectionPage' }),
  ...(page.value ? [defineArticle({ '@type': 'TechArticle', headline: page.value.title, description: page.value.description, inLanguage: page.value.textLang })] : []),
])

// ── the page ──
const sectionNav = computed(() => (page.value && nav.value ? nav.value.sections[page.value.section] : null))
const english = computed(() => !!page.value && page.value.textLang !== lang.value)
const isIndex = computed(() => !!page.value && !page.value.slug)
const cards = computed(() => (isIndex.value ? sectionNav.value?.groups ?? [] : []))
const isHtml = (s: DocsSegment): s is { html: string } => 'html' in s
const sourceUrl = computed(() => (page.value ? `https://github.com/tinyzookeeper/tinyzoo/blob/main/${page.value.source}` : ''))

// The drawer (phones), the search (the site's palette), the zoomed picture.
const drawer = ref(false)
watch(() => route.path, () => { drawer.value = false })
const searchOpen = useState('site-search-open', () => false)
function openSearch() { drawer.value = false; searchOpen.value = true }
const zoomed = ref<{ src: string; alt: string } | null>(null)
const zoomOpen = computed({ get: () => !!zoomed.value, set: (v) => { if (!v) zoomed.value = null } })

// Clicks inside the rendered Markdown: copy buttons, pictures, links to other pages of the site.
async function onBodyClick(e: MouseEvent) {
  const el = e.target as HTMLElement
  const copy = el.closest<HTMLButtonElement>('.doc-copy')
  if (copy) {
    const code = copy.closest('.doc-code')?.querySelector('pre')?.innerText ?? ''
    try {
      await navigator.clipboard.writeText(code)
      const label = copy.textContent
      copy.textContent = copy.dataset.copied ?? label
      copy.classList.add('doc-copy--done')
      setTimeout(() => { copy.textContent = label; copy.classList.remove('doc-copy--done') }, 1600)
    } catch { /* the browser refused; the code can still be selected */ }
    return
  }
  const zoom = el.closest<HTMLButtonElement>('.doc-zoom')
  if (zoom) {
    const img = zoom.querySelector('img')
    if (img) zoomed.value = { src: img.currentSrc || img.src, alt: img.alt }
    return
  }
  const a = el.closest<HTMLAnchorElement>('a[href]')
  const href = a?.getAttribute('href') ?? ''
  if (!a || !href.startsWith('/') || href.startsWith('//') || href.startsWith('/docs/') || a.target || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return
  e.preventDefault()
  await navigateTo(href)
}

// "On this page": the heading being read is marked.
const active = ref('')
let observer: IntersectionObserver | undefined
function spy() {
  observer?.disconnect()
  if (!page.value?.toc.length || typeof IntersectionObserver === 'undefined') return
  const seen = new Map<string, boolean>()
  observer = new IntersectionObserver((entries) => {
    for (const en of entries) seen.set(en.target.id, en.isIntersecting)
    const first = page.value!.toc.find((h) => seen.get(h.id))
    if (first) active.value = first.id
  }, { rootMargin: '-96px 0px -60% 0px' })
  for (const h of page.value.toc) {
    const el = document.getElementById(h.id)
    if (el) observer.observe(el)
  }
}
onMounted(() => { document.documentElement.classList.add('docs-js'); spy() })
watch(() => page.value?.path, () => { active.value = ''; nextTick(spy) })
onBeforeUnmount(() => observer?.disconnect())

const doorChapters = (s: 'editors' | 'developers', n: number) => (nav.value?.sections[s].groups.flatMap((g) => g.pages) ?? []).slice(0, n)
const chapterCount = (s: 'editors' | 'developers') => nav.value?.sections[s].groups.reduce((n, g) => n + g.pages.length, 0) ?? 0
const otherLang = (l: DocsLang) => l !== lang.value
</script>

<template>
  <div class="docs">
    <!-- the landing page: two doors -->
    <section v-if="isLanding" class="section !pt-16">
      <div class="wrap">
        <p class="eyebrow rise">{{ t('docsEyebrow') }}</p>
        <h1 class="display rise rise-1 mt-4 max-w-3xl text-5xl sm:text-6xl">{{ t('docsTitle') }}</h1>
        <p class="lede rise rise-2 mt-5 max-w-2xl">{{ t('docsLede') }}</p>

        <div class="docs-doors rise rise-3 mt-12">
          <div class="docs-door docs-door--editors">
            <img src="/animals/bunny.svg" alt="" class="docs-door-animal" width="96" height="96" aria-hidden="true">
            <h2 class="title text-3xl sm:text-4xl"><NuxtLink :to="docsPath(lang, 'editors')" class="docs-door-link">{{ t('docsEditorsTitle') }}</NuxtLink></h2>
            <p class="mt-3 max-w-md text-[1.0625rem] leading-relaxed text-ink/75">{{ t('docsEditorsText') }}</p>
            <ul class="docs-door-list" :lang="nav?.sections.editors.textLang">
              <li v-for="p in doorChapters('editors', 6)" :key="p.path"><NuxtLink :to="p.path">{{ p.title }}</NuxtLink></li>
            </ul>
            <NuxtLink :to="docsPath(lang, 'editors')" class="btn btn-dark mt-8 self-start">
              {{ t('docsEditorsCta') }}<span class="docs-door-count">{{ chapterCount('editors') }}</span><UIcon name="i-lucide-arrow-right" class="size-4" aria-hidden="true" />
            </NuxtLink>
          </div>
          <div class="docs-door docs-door--developers">
            <code class="docs-door-chip" aria-hidden="true">pnpm create tinyzoo</code>
            <h2 class="title text-3xl sm:text-4xl">
              <NuxtLink :to="docsPath(lang, 'developers')" class="docs-door-link">{{ t('docsDevelopersTitle') }}</NuxtLink>
            </h2>
            <p class="mt-3 max-w-md text-[1.0625rem] leading-relaxed text-cream/75">{{ t('docsDevelopersText') }}</p>
            <p v-if="nav && otherLang(nav.sections.developers.textLang)" class="mt-3 text-sm font-semibold text-cream/60">
              <UIcon name="i-lucide-languages" class="mr-1 inline size-4 align-[-3px]" aria-hidden="true" />{{ t('docsEnglishNote') }}
            </p>
            <ul class="docs-door-list" lang="en">
              <li v-for="p in doorChapters('developers', 6)" :key="p.path"><NuxtLink :to="p.path">{{ p.title }}</NuxtLink></li>
            </ul>
            <NuxtLink :to="docsPath(lang, 'developers')" class="btn btn-cream mt-8 self-start">
              {{ t('docsDevelopersCta') }}<span class="docs-door-count">{{ chapterCount('developers') }}</span><UIcon name="i-lucide-arrow-right" class="size-4" aria-hidden="true" />
            </NuxtLink>
          </div>
        </div>

        <div class="docs-help mt-16">
          <div>
            <h2 class="title text-2xl">{{ t('docsHelpTitle') }}</h2>
            <p class="mt-1 text-mute">{{ t('docsHelpText') }}</p>
          </div>
          <div class="btn-row flex flex-wrap gap-3">
            <button type="button" class="btn btn-light" @click="openSearch"><UIcon name="i-lucide-search" class="size-4" aria-hidden="true" />{{ t('docsSearch') }}</button>
            <NuxtLink :to="t('docsHelpPath')" class="btn btn-dark">{{ t('docsHelpCta') }}</NuxtLink>
          </div>
        </div>
      </div>
    </section>

    <!-- a page -->
    <div v-else-if="page && nav" class="wrap docs-layout">
      <div class="docs-bar">
        <button type="button" class="docs-bar-button" :aria-expanded="drawer" @click="drawer = true">
          <UIcon name="i-lucide-panel-left-open" class="size-5" aria-hidden="true" />{{ t('docsMenu') }}
        </button>
        <span class="docs-bar-where">{{ sectionNav?.title }}</span>
      </div>

      <aside class="docs-side">
        <DocsSidebar :nav="nav" :section="page.section" :current="page.path" @search="openSearch" />
      </aside>

      <article class="docs-main">
        <nav class="docs-crumbs" :aria-label="t('docsContents')">
          <NuxtLink :to="docsPath(lang)">{{ t('docs') }}</NuxtLink>
          <template v-if="page.slug">
            <UIcon name="i-lucide-chevron-right" class="size-3.5" aria-hidden="true" />
            <NuxtLink :to="docsPath(lang, page.section)">{{ sectionNav?.title }}</NuxtLink>
          </template>
        </nav>
        <p v-if="english" class="docs-english"><UIcon name="i-lucide-languages" class="size-4 shrink-0" aria-hidden="true" />{{ t('docsEnglishNote') }}</p>
        <h1 class="display docs-title" :lang="page.textLang">{{ page.title }}</h1>

        <details v-if="page.toc.length > 1" class="docs-toc-inline">
          <summary>{{ t('docsOnThisPage') }}<UIcon name="i-lucide-chevron-down" class="size-4" aria-hidden="true" /></summary>
          <ul :lang="page.textLang">
            <li v-for="h in page.toc" :key="h.id" :class="h.level === 3 ? 'docs-toc-sub' : ''"><a :href="`#${h.id}`">{{ h.text }}</a></li>
          </ul>
        </details>

        <!-- eslint-disable vue/no-v-html -- rendered at build time from our own Markdown, raw HTML escaped (modules/docs/render.ts) -->
        <div class="doc-body" :lang="page.textLang" @click="onBodyClick">
          <template v-for="(s, i) in page.body" :key="i">
            <div v-if="isHtml(s)" class="doc-html" v-html="s.html" />
            <figure v-else class="doc-clip"><ClipVideo :src="s.clip.src" :label="s.clip.label" /><figcaption class="sr-only">{{ s.clip.label }}</figcaption></figure>
          </template>
        </div>
        <!-- eslint-enable vue/no-v-html -->

        <div v-for="g in cards" :key="g.id" class="mt-12">
          <h2 v-if="cards.length > 1" class="docs-cards-title">{{ g.title }}</h2>
          <h2 v-else class="docs-cards-title">{{ t('docsChapters') }}</h2>
          <ol class="docs-cards" :lang="sectionNav?.textLang">
            <li v-for="p in g.pages" :key="p.path">
              <NuxtLink :to="p.path" class="docs-card group">
                <span class="docs-card-title group-hover:underline decoration-2 underline-offset-4">{{ p.title }}</span>
                <span class="docs-card-text">{{ p.description }}</span>
              </NuxtLink>
            </li>
          </ol>
        </div>

        <nav v-if="page.prev || page.next" class="docs-pager" :aria-label="`${t('docsPrev')} / ${t('docsNext')}`">
          <NuxtLink v-if="page.prev" :to="page.prev.path" class="docs-pager-link">
            <span class="docs-pager-label"><UIcon name="i-lucide-arrow-left" class="size-4" aria-hidden="true" />{{ t('docsPrev') }}</span>
            <span class="docs-pager-title" :lang="page.textLang">{{ page.prev.title }}</span>
          </NuxtLink>
          <span v-else />
          <NuxtLink v-if="page.next" :to="page.next.path" class="docs-pager-link docs-pager-link--next">
            <span class="docs-pager-label">{{ t('docsNext') }}<UIcon name="i-lucide-arrow-right" class="size-4" aria-hidden="true" /></span>
            <span class="docs-pager-title" :lang="page.textLang">{{ page.next.title }}</span>
          </NuxtLink>
        </nav>

        <div class="docs-help docs-help--small mt-12">
          <div>
            <p class="font-bold">{{ t('docsHelpTitle') }}</p>
            <p class="mt-1 text-sm text-mute">{{ t('docsHelpText') }}</p>
          </div>
          <NuxtLink :to="t('docsHelpPath')" class="btn btn-light !min-h-11 text-sm">{{ t('docsHelpCta') }}</NuxtLink>
        </div>
        <p v-if="page.section === 'developers'" class="mt-6 text-sm">
          <a :href="sourceUrl" class="docs-source" rel="noopener"><UIcon name="i-lucide-github" class="size-4" aria-hidden="true" />{{ t('docsSource') }}</a>
        </p>
      </article>

      <aside v-if="page.toc.length > 1" class="docs-toc">
        <p class="docs-toc-title">{{ t('docsOnThisPage') }}</p>
        <ul :lang="page.textLang">
          <li v-for="h in page.toc" :key="h.id" :class="h.level === 3 ? 'docs-toc-sub' : ''">
            <a :href="`#${h.id}`" :class="active === h.id ? 'docs-toc-on' : ''" :aria-current="active === h.id ? 'location' : undefined">{{ h.text }}</a>
          </li>
        </ul>
      </aside>

      <USlideover
        v-model:open="drawer" side="left" :title="t('docsContents')"
        :ui="{ overlay: 'bg-[rgb(19_19_19/0.35)]', content: 'docs-drawer max-w-[22rem] bg-white', header: 'min-h-16', body: 'p-4 sm:p-5' }"
        :close="{ color: 'neutral', variant: 'ghost', 'aria-label': t('close') } as any"
      >
        <template #body>
          <DocsSidebar :nav="nav" :section="page.section" :current="page.path" @search="openSearch" />
        </template>
      </USlideover>
    </div>

    <UModal
      v-model:open="zoomOpen" :title="zoomed?.alt || t('docsZoomClose')"
      :ui="{ overlay: 'bg-[rgb(19_19_19/0.72)]', content: 'docs-zoom max-w-[min(96vw,1500px)] w-auto bg-transparent ring-0 shadow-none' }"
    >
      <template #content>
        <button type="button" class="docs-zoom-close" :aria-label="t('docsZoomClose')" @click="zoomed = null">
          <UIcon name="i-lucide-x" class="size-5" aria-hidden="true" />
        </button>
        <div class="docs-zoom-frame">
          <img v-if="zoomed" :src="zoomed.src" :alt="zoomed.alt" class="docs-zoom-img" @click="zoomed = null">
        </div>
      </template>
    </UModal>
  </div>
</template>

<style>
/* ── the landing page ── */
.docs-doors { display: grid; gap: 1.25rem; }
@media (min-width: 900px) { .docs-doors { grid-template-columns: 1fr 1fr; } }
.docs-door { position: relative; display: flex; flex-direction: column; padding: 2rem; border-radius: 1.5rem; overflow: hidden; }
@media (min-width: 640px) { .docs-door { padding: 2.75rem; } }
.docs-door--editors { background: var(--color-cream); }
.docs-door--developers { background: var(--color-night); color: var(--color-cream); }
.docs-door-link::after { content: ""; position: absolute; inset: 0; }
.docs-door-link:hover { text-decoration: underline; text-decoration-thickness: 3px; text-underline-offset: 6px; }
.docs-door-animal { position: absolute; right: 1.75rem; bottom: -0.75rem; width: 5rem; height: auto; pointer-events: none; }
@media (min-width: 640px) { .docs-door-animal { width: 7rem; right: 2.5rem; } }
.docs-door-chip { align-self: flex-start; margin-bottom: 1.25rem; padding: 0.375rem 0.75rem; border-radius: 0.625rem; background: var(--color-bird); color: var(--color-ink); font-family: var(--font-mono); font-size: 0.8125rem; transform: rotate(-2deg); }
.docs-door-list { position: relative; z-index: 1; display: grid; gap: 0.125rem; margin-top: 1.5rem; }
.docs-door-list a { display: inline-flex; align-items: center; gap: 0.625rem; min-height: 2.5rem; font-weight: 600; }
.docs-door-list a::before { content: ""; width: 0.375rem; height: 0.375rem; border-radius: 999px; background: currentColor; opacity: 0.35; flex-shrink: 0; }
.docs-door--editors .docs-door-list a { color: rgb(19 19 19 / 0.8); }
.docs-door--developers .docs-door-list a { color: rgb(249 245 239 / 0.82); }
.docs-door-list a:hover { text-decoration: underline; text-underline-offset: 4px; }
.docs-door .btn { position: relative; z-index: 1; }
.docs-door-count { display: inline-grid; place-items: center; min-width: 1.5rem; height: 1.5rem; padding: 0 0.375rem; border-radius: 999px; background: rgb(255 255 255 / 0.16); font-size: 0.75rem; }
.btn-cream .docs-door-count { background: rgb(19 19 19 / 0.08); }
.docs-help { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 1.25rem; padding: 1.75rem 2rem; border-radius: 1.25rem; box-shadow: inset 0 0 0 1.5px rgb(19 19 19 / 0.08); }
.docs-help--small { padding: 1.25rem 1.5rem; }

/* ── a page: sidebar · text · on this page ── */
.docs-layout { display: grid; gap: 0 3rem; padding-top: 1.5rem; padding-bottom: 6rem; }
@media (min-width: 1100px) {
  .docs-layout { grid-template-columns: 15.5rem minmax(0, 1fr); padding-top: 3rem; }
  .docs-layout:has(.docs-toc) { grid-template-columns: 15.5rem minmax(0, 1fr) 13rem; }
}
.docs-side { display: none; }
@media (min-width: 1100px) {
  .docs-side { display: block; position: sticky; top: 5.5rem; align-self: start; max-height: calc(100dvh - 6.5rem); overflow-y: auto; padding: 0 0.5rem 2rem 0; scrollbar-width: thin; scrollbar-gutter: stable; }
}
.docs-bar { position: sticky; top: 4rem; z-index: 20; display: flex; align-items: center; gap: 0.75rem; margin: -1.5rem -1.25rem 1.25rem; padding: 0.5rem 1.25rem; background: rgb(255 255 255 / 0.92); backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px); box-shadow: 0 1px 0 rgb(19 19 19 / 0.08); }
@media (min-width: 640px) { .docs-bar { top: 4.5rem; margin-inline: -2rem; padding-inline: 2rem; } }
@media (min-width: 1100px) { .docs-bar { display: none; } }
.docs-bar-button { display: inline-flex; flex-shrink: 0; white-space: nowrap; align-items: center; gap: 0.5rem; min-height: 2.75rem; padding: 0 0.875rem 0 0.625rem; border-radius: 999px; font-weight: 700; font-size: 0.9375rem; box-shadow: inset 0 0 0 1.5px rgb(19 19 19 / 0.14); }
.docs-bar-button:hover { box-shadow: inset 0 0 0 1.5px rgb(19 19 19 / 0.4); }
.docs-bar-where { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 0.875rem; font-weight: 600; color: var(--color-mute); }
.docs-main { min-width: 0; max-width: 46rem; }
.docs-crumbs { display: flex; flex-wrap: wrap; align-items: center; gap: 0.375rem; font-size: 0.875rem; font-weight: 600; color: var(--color-mute); }
.docs-crumbs a { padding: 0.25rem 0; }
.docs-crumbs a:hover { color: var(--color-ink); text-decoration: underline; text-underline-offset: 3px; }
.docs-english { display: inline-flex; align-items: center; gap: 0.5rem; margin-top: 1rem; padding: 0.375rem 0.875rem; border-radius: 999px; background: var(--color-cream); font-size: 0.875rem; font-weight: 600; color: rgb(19 19 19 / 0.75); }
.docs-title { margin-top: 0.75rem; font-size: 2.5rem; }
@media (min-width: 640px) { .docs-title { font-size: 3.25rem; } }
.docs-toc { display: none; }
@media (min-width: 1100px) {
  .docs-toc { display: block; position: sticky; top: 5.5rem; align-self: start; max-height: calc(100dvh - 6.5rem); overflow-y: auto; padding-top: 0.25rem; font-size: 0.875rem; scrollbar-width: thin; }
}
.docs-toc-title { margin-bottom: 0.5rem; font-size: 0.75rem; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; color: var(--color-mute); }
.docs-toc ul { display: grid; gap: 1px; border-left: 1.5px solid rgb(19 19 19 / 0.08); }
.docs-toc a { display: block; margin-left: -1.5px; padding: 0.3rem 0 0.3rem 0.875rem; border-left: 1.5px solid transparent; line-height: 1.4; color: rgb(19 19 19 / 0.62); transition: color .15s ease, border-color .15s ease; }
.docs-toc .docs-toc-sub a { padding-left: 1.625rem; font-size: 0.8125rem; }
.docs-toc a:hover { color: var(--color-ink); }
.docs-toc a.docs-toc-on { color: var(--color-ink); font-weight: 700; border-left-color: var(--color-ink); }
.docs-toc-inline { margin-top: 1.5rem; border-radius: 1rem; background: var(--color-cream); }
@media (min-width: 1100px) { .docs-toc-inline { display: none; } }
.docs-toc-inline summary { display: flex; align-items: center; justify-content: space-between; min-height: 3rem; padding: 0 1.125rem; font-weight: 700; list-style: none; }
.docs-toc-inline summary::-webkit-details-marker { display: none; }
.docs-toc-inline[open] summary svg { transform: rotate(180deg); }
.docs-toc-inline ul { display: grid; padding: 0 1.125rem 1rem; }
.docs-toc-inline a { display: block; padding: 0.4rem 0; color: rgb(19 19 19 / 0.75); }
.docs-toc-inline .docs-toc-sub a { padding-left: 1rem; font-size: 0.9375rem; }
.docs-cards-title { font-family: var(--font-display); font-size: 1.375rem; font-weight: 800; letter-spacing: -0.02em; }
.docs-cards { display: grid; gap: 0.75rem; margin-top: 1rem; counter-reset: card; }
@media (min-width: 700px) { .docs-cards { grid-template-columns: 1fr 1fr; } }
.docs-card { display: flex; flex-direction: column; gap: 0.375rem; height: 100%; padding: 1.25rem 1.375rem; border-radius: 1.125rem; background: var(--color-cream); transition: box-shadow .15s ease; }
.docs-card:hover { box-shadow: 0 0 0 1.5px rgb(19 19 19 / 0.12); }
.docs-card-title { font-family: var(--font-display); font-size: 1.125rem; font-weight: 800; letter-spacing: -0.015em; line-height: 1.3; }
.docs-card-text { font-family: Inter, ui-sans-serif, system-ui, sans-serif; font-size: 0.9375rem; line-height: 1.55; color: rgb(19 19 19 / 0.68); }
.docs-card-text::first-letter { text-transform: uppercase; }
.docs-pager { display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; margin-top: 4rem; }
.docs-pager-link { display: flex; flex-direction: column; gap: 0.25rem; padding: 1rem 1.25rem; border-radius: 1rem; box-shadow: inset 0 0 0 1.5px rgb(19 19 19 / 0.1); transition: box-shadow .15s ease; }
.docs-pager-link:hover { box-shadow: inset 0 0 0 1.5px rgb(19 19 19 / 0.4); }
.docs-pager-link--next { text-align: right; align-items: flex-end; grid-column: 2; }
.docs-pager-label { display: inline-flex; align-items: center; gap: 0.375rem; font-size: 0.8125rem; font-weight: 700; color: var(--color-mute); }
.docs-pager-title { font-family: var(--font-display); font-weight: 800; letter-spacing: -0.01em; line-height: 1.3; }
@media (max-width: 519px) { .docs-pager { grid-template-columns: 1fr; } .docs-pager-link--next { grid-column: 1; } }
.docs-source { display: inline-flex; align-items: center; gap: 0.5rem; font-weight: 600; color: var(--color-mute); }
.docs-source:hover { color: var(--color-ink); text-decoration: underline; text-underline-offset: 3px; }
.docs-drawer { font-family: "Manrope", ui-sans-serif, system-ui, sans-serif; color: var(--color-ink); }
.docs-zoom { display: flex; flex-direction: column; align-items: flex-end; gap: 0.75rem; }
.docs-zoom-frame { max-width: min(96vw, 1500px); max-height: 85dvh; overflow: auto; border-radius: 0.75rem; box-shadow: 0 30px 80px -20px rgb(0 0 0 / 0.6); overscroll-behavior: contain; }
.docs-zoom-img { display: block; max-width: min(96vw, 1500px); max-height: 85dvh; width: auto; height: auto; background: #fff; cursor: zoom-out; }
/* Phones: the picture larger than the screen, to pan around in. */
@media (max-width: 899px) { .docs-zoom-img { width: 220vw; max-width: none; max-height: none; } .docs-zoom-img[src*="/phone-"] { width: auto; max-width: 100%; max-height: 85dvh; } }
.docs-zoom-close { display: grid; place-items: center; width: 2.75rem; height: 2.75rem; border-radius: 999px; background: rgb(255 255 255 / 0.92); color: var(--color-ink); }

/* ── the text: Inter for reading, Manrope headings, one comfortable column ── */
.doc-body { font-family: Inter, ui-sans-serif, system-ui, sans-serif; font-size: 1.0625rem; line-height: 1.75; color: #2a2a28; margin-top: 1.5rem; }
.doc-html > * + * { margin-top: 1.1em; }
.doc-html + .doc-clip, .doc-clip + .doc-html { margin-top: 1.5em; }
.doc-body > .doc-html:first-child > p:first-child { font-size: 1.1875rem; line-height: 1.65; color: var(--color-mute); }
.doc-body h2, .doc-body h3, .doc-body h4 { font-family: var(--font-display); color: var(--color-ink); scroll-margin-top: 8.5rem; }
@media (min-width: 1100px) { .doc-body h2, .doc-body h3, .doc-body h4 { scroll-margin-top: 6rem; } }
.doc-body h2 { margin-top: 2.4em; font-size: 1.75rem; font-weight: 800; letter-spacing: -0.025em; line-height: 1.2; }
.doc-body h3 { margin-top: 1.9em; font-size: 1.3rem; font-weight: 800; letter-spacing: -0.015em; line-height: 1.3; }
.doc-body h4 { margin-top: 1.6em; font-size: 1.0625rem; font-weight: 800; }
.doc-body .doc-anchor { color: inherit; text-decoration: none; }
.doc-body .doc-anchor::after { content: "#" / ""; margin-left: 0.35em; color: var(--color-mute); opacity: 0; transition: opacity .15s ease; }
.doc-body .doc-anchor:hover::after, .doc-body .doc-anchor:focus-visible::after { opacity: 1; }
.doc-body p a, .doc-body li a, .doc-body td a, .doc-body aside a { text-decoration: underline; text-decoration-thickness: 2px; text-underline-offset: 3px; text-decoration-color: var(--color-bird); }
.doc-body p a:hover, .doc-body li a:hover, .doc-body td a:hover { text-decoration-color: var(--color-ink); }
.doc-body a.doc-external::after { content: "↗" / ""; margin-left: 0.15em; font-size: 0.8em; color: var(--color-mute); }
.doc-body strong { font-weight: 650; color: var(--color-ink); }
.doc-body ul { list-style: disc; padding-left: 1.4em; }
.doc-body ol { list-style: decimal; padding-left: 1.4em; }
.doc-body li + li { margin-top: 0.4em; }
.doc-body li > ul, .doc-body li > ol { margin-top: 0.4em; }
.doc-body li::marker { color: var(--color-mute); }
.doc-body :not(pre) > code { font-family: var(--font-mono); font-size: 0.86em; background: var(--color-cream); padding: 0.12em 0.4em; border-radius: 0.35em; overflow-wrap: anywhere; }
.doc-body blockquote { border-left: 3px solid var(--color-cream-2); padding-left: 1.1em; color: var(--color-mute); }
.doc-note { position: relative; padding: 1rem 1.25rem 1rem 1.375rem; border-radius: 1rem; background: var(--color-cream); }
.doc-note::before { content: ""; position: absolute; left: 0; top: 1rem; bottom: 1rem; width: 3px; border-radius: 3px; }
.doc-note--tip::before { background: var(--color-frog); }
.doc-note--warn { background: color-mix(in oklab, var(--color-bunny) 16%, #fff); }
.doc-note--warn::before { background: var(--color-fox); }
.doc-note > * + * { margin-top: 0.6em; }
.doc-table { overflow-x: auto; border-radius: 1rem; box-shadow: inset 0 0 0 1px rgb(19 19 19 / 0.1); }
.doc-table table { width: 100%; border-collapse: collapse; font-size: 0.9375rem; line-height: 1.55; }
.doc-table th { text-align: left; padding: 0.75rem 1rem; font-weight: 700; background: #FBF9F6; color: var(--color-ink); border-bottom: 1px solid rgb(19 19 19 / 0.1); }
.doc-table :is(td, th) { overflow-wrap: break-word; }
.doc-table td { padding: 0.75rem 1rem; vertical-align: top; border-top: 1px solid rgb(19 19 19 / 0.07); min-width: 8rem; }
.doc-table tr:first-child td { border-top: 0; }
.doc-figure { margin-block: 1.75em; }
.doc-zoom { display: block; width: 100%; padding: 0; border-radius: 1rem; overflow: hidden; background: #fff; box-shadow: 0 0 0 1px rgb(19 19 19 / 0.1), 0 24px 48px -28px rgb(19 19 19 / 0.35); cursor: zoom-in; transition: box-shadow .15s ease; }
.doc-zoom:hover { box-shadow: 0 0 0 1.5px rgb(19 19 19 / 0.3), 0 24px 48px -28px rgb(19 19 19 / 0.35); }
.doc-zoom img { display: block; width: 100%; height: auto; }
/* Phone screenshots: not wider than a phone. */
.doc-zoom:has(img[width="780"]), .doc-zoom:has(img[width="390"]) { max-width: 22rem; margin-inline: auto; }
.doc-clip { aspect-ratio: 16 / 10; margin-block: 1.75em; border-radius: 1rem; overflow: hidden; background: var(--color-cream); box-shadow: 0 0 0 1px rgb(19 19 19 / 0.1); }
.doc-code { margin-block: 1.5em; border-radius: 1rem; overflow: hidden; background: var(--color-night-2); box-shadow: 0 0 0 1px rgb(19 19 19 / 0.1); }
.doc-code-bar { display: flex; align-items: center; justify-content: space-between; gap: 1rem; min-height: 2.5rem; padding: 0 0.5rem 0 1rem; border-bottom: 1px solid rgb(249 245 239 / 0.07); font-family: var(--font-mono); font-size: 0.75rem; color: rgb(249 245 239 / 0.55); }
.doc-copy { display: none; min-height: 2rem; padding: 0 0.75rem; border-radius: 999px; font-family: "Manrope", ui-sans-serif, system-ui, sans-serif; font-size: 0.75rem; font-weight: 700; color: rgb(249 245 239 / 0.75); transition: background-color .15s ease, color .15s ease; }
.docs-js .doc-copy { display: inline-flex; align-items: center; }
.doc-copy:hover { background: rgb(249 245 239 / 0.1); color: var(--color-cream); }
.doc-copy--done { color: var(--color-frog) !important; }
.doc-code pre { margin: 0; padding: 1rem 1.25rem 1.25rem; overflow-x: auto; font-family: var(--font-mono); font-size: 0.8125rem; line-height: 1.7; color: rgb(249 245 239 / 0.88); tab-size: 2; }
@media (min-width: 640px) { .doc-code pre { font-size: 0.84rem; } }
.doc-code .tk-add { color: #9ADB9A; }
.doc-code .tk-del { color: #FEA88A; }
</style>
