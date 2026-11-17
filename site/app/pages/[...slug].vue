<script setup lang="ts">
// Every address, in every language: a page from blocks (/, /srovnani, /en/comparison),
// the changelog (/novinky, /en/news) or one update (/novinky/formulare, /de/neuigkeiten/…).
import { DEFAULT_LANG, LANG_TAGS, NEWS_SEGMENT, localePath } from '~/lib/site-i18n'
import { contentRoute, homeOf, itemAlternates, newsListAlternates } from '~/lib/content-route'

definePageMeta({
  // The language switcher (in the layout, which renders before this page) needs this item's
  // address in each language before anything is drawn, or the server renders it with the
  // fallbacks and the browser hydrates with the real links. In the browser the page sets
  // it as soon as its own data is in, so only the server asks.
  middleware: async (route) => {
    if (import.meta.client) return
    const { lang, kind, url } = contentRoute(route.path, route.params.slug as string | string[] | undefined)
    const fallback = useAlternatesFallback()
    if (kind === 'updates') { fallback.value = null; useAlternates().value = newsListAlternates(); return }
    fallback.value = kind === 'update' ? 'news' : 'home'
    const res = await useRequestFetch()<{ item?: { paths?: Record<string, string> } }>(url, {
      query: { locale: lang, ...('preview' in route.query ? { preview: '' } : {}) },
    }).catch(() => null)
    useAlternates().value = itemAlternates(res?.item?.paths)
  },
})

const route = useRoute()
const { lang, t, to } = useLang()
const parts = computed(() => contentRoute(route.path, route.params.slug as string | string[] | undefined).parts)
// The home page has one address per language: /, /en, /de.
if (parts.value.length === 1 && parts.value[0] === 'home') await navigateTo(to('/'), { redirectCode: 301 })
const news = computed(() => NEWS_SEGMENT[lang.value])
const kind = computed(() => contentRoute(route.path, route.params.slug as string | string[] | undefined).kind)
const preview = computed(() => ('preview' in route.query ? { preview: '' } : {}))

const { data, error } = await useFetch<any>(() => contentRoute(route.path, route.params.slug as string | string[] | undefined).url,
{
  query: computed(() => ({ locale: lang.value, ...(kind.value === 'updates' ? { sort: 'publishedAt', limit: 50 } : preview.value) })),
  key: computed(() => `site:${route.fullPath}`),
})
if (error.value?.statusCode === 404 && parts.value.length) throw createError({ statusCode: 404, message: t('notFoundHead'), fatal: true })

const item = computed(() => (kind.value === 'updates' ? null : data.value?.item ?? null))
const isHome = computed(() => kind.value === 'page' && !parts.value.length)
const { settings } = await useSite()
// Title, description, canonical and hreflang from the item. The sharing image is
// useShareImage's (below), so the item's pictures are kept out of it here.
useCmsSeo(computed(() => (item.value ? { ...item.value, ogImage: null } : null)), {
  siteName: settings.value?.siteName,
  descriptionField: 'perex',
  fallback: computed(() => ({ metaDescription: settings.value?.metaDescription })),
  defaultLocale: DEFAULT_LANG,
  path: homeOf,
})
useHead({ htmlAttrs: { lang }, title: () => (kind.value === 'updates' ? `${t('newsTitle')} · ${settings.value?.siteName ?? ''}` : undefined) })

// The sharing image: the page's own headline (its first block's heading, e.g. the hero)
// rather than its menu title ("Úvod").
const headline = (i: any) => i?.metaTitle || i?.sections?.find((s: any) => s?.heading)?.heading || i?.title
useShareImage(kind.value === 'updates'
  ? { title: t('newsTitle'), description: t('newsLede') }
  : {
      title: headline(item.value) || settings.value?.siteName || 'tinyzoo',
      description: item.value?.metaDescription || item.value?.perex || settings.value?.metaDescription,
      uploaded: item.value?.ogImage,
    })

// schema.org: the changelog is a collection of updates, one update is an article.
const siteUrl = useSiteConfig().url
useSchemaOrg([
  defineWebPage({ '@type': kind.value === 'updates' ? 'CollectionPage' : 'WebPage' }),
  ...(kind.value === 'update' && item.value
    ? [defineArticle({
        '@type': 'BlogPosting',
        'headline': item.value.title,
        'description': item.value.perex ?? undefined,
        'datePublished': item.value.publishedAt ?? undefined,
        'dateModified': item.value.updatedAt ?? undefined,
        'image': item.value.cover?.url ? new URL(item.value.cover.url, siteUrl).href : undefined,
      })]
    : []),
])

// The same page in the other languages: the item's own addresses (/home is the
// language's home page); the changelog lives at a fixed address in each language.
// (The route middleware above sets the same on the server, before the layout renders.)
const alternates = useAlternates()
const fallback = useAlternatesFallback()
watchEffect(() => {
  alternates.value = kind.value === 'updates' ? newsListAlternates() : itemAlternates(item.value?.paths)
  fallback.value = kind.value === 'updates' ? null : kind.value === 'update' ? 'news' : 'home'
})
// hreflang for the changelog (useCmsSeo writes them for items).
useHead({
  link: () => kind.value !== 'updates'
    ? []
    : [
        ...Object.entries(alternates.value).map(([l, p]) => ({ rel: 'alternate' as const, hreflang: l, href: `${siteUrl}${p}` })),
        { rel: 'alternate' as const, hreflang: 'x-default', href: `${siteUrl}${localePath(`/${NEWS_SEGMENT[DEFAULT_LANG]}`, DEFAULT_LANG)}` },
      ],
})

const isDraft = computed(() => !!data.value?.preview && item.value?.status !== 'published')
const date = (d: string) => new Intl.DateTimeFormat(LANG_TAGS[lang.value], { dateStyle: 'long' }).format(new Date(d))
const kinds = computed<Record<string, { label: string; tint: string }>>(() => ({
  feature: { label: t('kindFeature'), tint: '#73C573' }, improvement: { label: t('kindImprovement'), tint: '#67B1F9' }, fix: { label: t('kindFix'), tint: '#FEBD3B' },
}))
</script>

<template>
  <div>
    <DraftBar v-if="isDraft" />

    <!-- a page from blocks -->
    <CmsBlocks v-if="kind === 'page' && item" :blocks="item.sections" />
    <div v-else-if="isHome" class="wrap py-32 text-center">
      <h1 class="display text-5xl">{{ t('emptyHomeTitle') }}</h1>
      <p class="lede mt-4">{{ t('emptyHomeText') }}</p>
    </div>

    <!-- the changelog -->
    <section v-else-if="kind === 'updates'" class="section !pt-16">
      <div class="wrap max-w-4xl">
        <p class="eyebrow">{{ t('newsEyebrow') }}</p>
        <h1 class="display mt-4 text-5xl sm:text-6xl">{{ t('newsTitle') }}</h1>
        <p class="lede mt-5 max-w-xl">{{ t('newsLede') }}</p>
        <ol class="updates mt-14">
          <li v-for="n in data?.items ?? []" :key="n.id" class="update">
            <time v-if="n.publishedAt" :datetime="n.publishedAt" class="update-date">{{ date(n.publishedAt) }}</time>
            <NuxtLink :to="to(`/${news}/${n.slug}`)" class="update-card group" :class="n.cover ? 'update-card--cover' : ''">
              <div class="min-w-0">
                <span v-if="n.kind && kinds[n.kind]" class="update-kind" :style="{ '--tint': kinds[n.kind]!.tint }">{{ kinds[n.kind]!.label }}</span>
                <h2 class="mt-3 text-2xl font-extrabold tracking-[-0.02em] group-hover:underline decoration-2 underline-offset-4">{{ n.title }}</h2>
                <p v-if="n.perex" class="mt-2 leading-relaxed text-mute">{{ n.perex }}</p>
              </div>
              <CmsImage v-if="n.cover" :media="n.cover" sizes="(min-width: 768px) 12rem, 100vw" class="update-cover" />
            </NuxtLink>
          </li>
        </ol>
        <p v-if="!data?.items?.length" class="mt-10 text-mute">{{ t('newsEmpty') }}</p>
      </div>
    </section>

    <!-- one update -->
    <article v-else-if="kind === 'update' && item" class="section !pt-16">
      <div class="wrap max-w-3xl">
        <NuxtLink :to="to(`/${news}`)" class="inline-block py-2.5 text-sm font-semibold text-mute hover:text-ink">{{ t('newsBack') }}</NuxtLink>
        <div class="mt-8 flex flex-wrap items-center gap-3 text-sm text-mute">
          <span v-if="item.kind && kinds[item.kind]" class="update-kind" :style="{ '--tint': kinds[item.kind]!.tint }">{{ kinds[item.kind]!.label }}</span>
          <time v-if="item.publishedAt" :datetime="item.publishedAt">{{ date(item.publishedAt) }}</time>
        </div>
        <h1 class="display mt-4 text-4xl sm:text-5xl">{{ item.title }}</h1>
        <p v-if="item.perex" class="lede mt-6">{{ item.perex }}</p>
        <CmsImage v-if="item.cover" :media="item.cover" eager class="mt-10 w-full rounded-2xl" />
        <!-- The clip is per language (a localized group), so each language shows the one recorded in its own admin. -->
        <figure v-if="item.clip?.video" class="window news-clip mt-10">
          <div class="window-bar" aria-hidden="true"><i /><i /><i /><span>{{ item.clip.caption }}</span></div>
          <div class="news-clip-screen">
            <ClipVideo :src="item.clip.video.url" :label="item.clip.caption || item.title" />
          </div>
        </figure>
        <CmsContent :doc="item.body" class="prose-zoo mt-10" />
      </div>
    </article>
  </div>
</template>

<style>
.updates { position: relative; display: grid; gap: 1.25rem; }
.update { display: grid; gap: 0.5rem; }
@media (min-width: 768px) { .update { grid-template-columns: 10rem 1fr; gap: 2rem; } }
.update-date { padding-top: 1.5rem; font-size: 0.875rem; font-weight: 600; color: var(--color-mute); }
.update-card { display: block; padding: 1.5rem 1.75rem; border-radius: 1.25rem; background: var(--color-cream); transition: transform .15s ease, box-shadow .15s ease; }
.update-card:hover { box-shadow: 0 0 0 1.5px rgb(19 19 19 / 0.12); }
.update-card--cover { display: grid; gap: 1.25rem; }
.update-cover { width: 100%; aspect-ratio: 3 / 2; height: auto; object-fit: cover; border-radius: 0.875rem; order: -1; }
@media (min-width: 768px) {
  .update-card--cover { grid-template-columns: 1fr 12rem; align-items: center; }
  .update-cover { order: 0; }
}
.news-clip-screen { aspect-ratio: 16 / 10; background: #fff; }
.update-kind { display: inline-flex; align-items: center; gap: 0.4rem; padding: 0.2rem 0.6rem; border-radius: 999px; font-size: 0.75rem; font-weight: 800; background: color-mix(in oklab, var(--tint) 28%, #fff); color: var(--color-ink); }
.update-kind::before { content: ""; width: 0.45rem; height: 0.45rem; border-radius: 999px; background: var(--tint); }
</style>
