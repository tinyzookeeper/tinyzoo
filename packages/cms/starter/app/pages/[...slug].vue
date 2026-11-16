<script setup lang="ts">
// Every other address: a page from blocks (/o-nas, /o-nas/tym, /en/about), the news list
// (/aktuality, /en/news) or one news item (/aktuality/zavod, /en/news/race).
// Pages sit under pages (Page is `tree: true`): the content API takes the whole address
// ('o-nas/tym', slashes escaped as one path segment) and returns `breadcrumbs` for it.
const route = useRoute()
const locale = useSiteLocale()
// The home page has one address: / (or /en). The query stays (?preview shows a draft).
if (/^(\/en)?\/home\/?$/.test(route.path)) await navigateTo({ path: locale.value === 'en' ? '/en' : '/', query: route.query }, { redirectCode: 301 })
const { kind, data, error, item } = await useSitePage()
if (error.value?.statusCode === 404) throw createError({ statusCode: 404, message: locale.value === 'en' ? 'Page not found' : 'Stránka nenalezena', fatal: true })

const { settings } = await useSite()
useCmsSeo(item, { siteName: settings.value?.siteName, descriptionField: 'perex', imageField: 'cover', defaultLocale: 'cs', path: siteHref })
if (kind.value === 'news') useHead({ title: () => `${locale.value === 'en' ? 'News' : 'Aktuality'} · ${settings.value?.siteName ?? ''}` })
// "Draft preview" only for what is not on the website yet.
const isDraft = computed(() => !!data.value?.preview && item.value?.status !== 'published')
const prefix = computed(() => (locale.value === 'en' ? '/en/news/' : '/aktuality/'))
const date = (d: string) => new Intl.DateTimeFormat(locale.value === 'en' ? 'en-GB' : 'cs-CZ', { dateStyle: 'long' }).format(new Date(d))
</script>

<template>
  <div>
    <p v-if="isDraft" class="bg-amber-100 px-4 py-2 text-center text-sm text-amber-900">Náhled konceptu · zatím není na webu</p>

    <!-- a page from blocks, under its parents' trail -->
    <template v-if="kind === 'page' && item">
      <nav v-if="item.breadcrumbs?.length > 1" :aria-label="locale === 'en' ? 'Breadcrumbs' : 'Drobečková navigace'" class="mx-auto max-w-5xl px-4 pt-6 text-sm text-muted">
        <ol class="flex flex-wrap items-center gap-x-2 gap-y-1">
          <li v-for="(b, i) in item.breadcrumbs" :key="b.path" class="flex items-center gap-2">
            <span v-if="i" aria-hidden="true">/</span>
            <span v-if="i === item.breadcrumbs.length - 1" aria-current="page" class="text-default">{{ b.title }}</span>
            <NuxtLink v-else :to="siteHref(b.path)" class="hover:underline">{{ b.title }}</NuxtLink>
          </li>
        </ol>
      </nav>
      <CmsBlocks :blocks="item.sections" />
    </template>

    <!-- the news list -->
    <section v-else-if="kind === 'news'" class="mx-auto max-w-5xl px-4 py-12">
      <h1 class="text-3xl font-bold mb-8">{{ locale === 'en' ? 'News' : 'Aktuality' }}</h1>
      <ul class="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
        <li v-for="n in data?.items ?? []" :key="n.id">
          <NuxtLink :to="prefix + n.slug" class="group block">
            <CmsImage v-if="n.cover" :media="n.cover" sizes="(min-width: 1024px) 20rem, (min-width: 640px) 50vw, 100vw" class="aspect-[3/2] w-full rounded-lg object-cover" />
            <p v-if="n.publishedAt" class="mt-3 text-sm text-muted">{{ date(n.publishedAt) }}</p>
            <h2 class="mt-1 text-lg font-semibold group-hover:underline">{{ n.title }}</h2>
            <p v-if="n.perex" class="mt-1 text-muted line-clamp-3">{{ n.perex }}</p>
          </NuxtLink>
        </li>
      </ul>
      <p v-if="!data?.items?.length" class="text-muted">{{ locale === 'en' ? 'No news yet.' : 'Zatím tu nic není.' }}</p>
    </section>

    <!-- one news item -->
    <article v-else-if="kind === 'article' && item" class="mx-auto max-w-3xl px-4 py-12">
      <NuxtLink :to="prefix.slice(0, -1)" class="text-sm text-muted hover:underline">← {{ locale === 'en' ? 'All news' : 'Všechny aktuality' }}</NuxtLink>
      <h1 class="mt-4 text-4xl font-bold leading-tight">{{ item.title }}</h1>
      <p v-if="item.publishedAt" class="mt-2 text-muted">{{ date(item.publishedAt) }}</p>
      <p v-if="item.perex" class="mt-6 text-lg text-muted">{{ item.perex }}</p>
      <CmsImage v-if="item.cover" :media="item.cover" eager sizes="(min-width: 768px) 46rem, 100vw" class="mt-8 w-full rounded-xl" />
      <CmsContent :doc="item.body" class="prose mt-8 max-w-none" />
    </article>
  </div>
</template>
