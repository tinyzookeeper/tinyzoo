<script setup lang="ts">
// Search the website: /hledat (and /en/search). Pages and news in the visitor's
// language, best first, with the words found marked. A plain form, so it also works
// without JavaScript; with it, the results follow the typing.
// (the address in each language: `searchPath` in app/utils/site.ts; Nuxt reads these literally)
definePageMeta({ name: 'search', path: '/hledat', alias: ['/en/search'] })

const route = useRoute()
const router = useRouter()
const locale = useSiteLocale()
const words = useSiteWords()
const { settings } = await useSite()

const q = computed(() => String(route.query.q ?? '').trim().slice(0, 100))
const { items, total, pending } = await useCmsSearch(q, { locale, limit: 30 })

const draft = ref(q.value)
watch(q, (v) => { if (v !== draft.value.trim()) draft.value = v })
let timer: ReturnType<typeof setTimeout> | undefined
const go = () => router.replace({ query: draft.value.trim() ? { q: draft.value.trim() } : {} })
function onInput() {
  clearTimeout(timer)
  timer = setTimeout(go, 250)
}
onBeforeUnmount(() => clearTimeout(timer))

useHead({
  title: () => `${words.value.searchHint} · ${settings.value?.siteName ?? ''}`,
  meta: [{ name: 'robots', content: 'noindex, follow' }],
})
</script>

<template>
  <div class="mx-auto max-w-3xl px-4 py-12">
    <h1 class="text-3xl font-bold">{{ words.searchHint }}</h1>
    <form role="search" :action="searchPathOf(locale)" method="get" class="mt-6 flex gap-2" @submit.prevent="go">
      <UInput
        v-model="draft" name="q" type="search" icon="i-lucide-search" size="xl" class="flex-1" autofocus
        :placeholder="words.searchPlaceholder" :aria-label="words.search" @input="onInput"
      />
      <UButton type="submit" size="xl" :label="words.search" />
    </form>

    <p v-if="q.length < 2" class="mt-6 text-muted">{{ words.searchTooShort }}</p>
    <p v-else-if="!pending && !items.length" class="mt-6 text-muted" aria-live="polite">
      {{ words.searchNothing(q) }}
    </p>
    <template v-else>
      <p class="mt-6 text-sm text-muted" aria-live="polite">{{ words.searchResults(total) }}</p>
      <ol class="mt-4 space-y-3">
        <li v-for="r in items" :key="`${r.entity}:${r.id}`">
          <NuxtLink v-if="r.path" :to="siteHref(r.path)" class="block rounded-lg border border-default p-4 hover:bg-elevated">
            <span class="font-semibold"><CmsHighlight :text="r.title" :ranges="r.titleHighlights" /></span>
            <p v-if="r.excerpt" class="mt-1 text-sm text-muted"><CmsHighlight :text="r.excerpt" :ranges="r.highlights" /></p>
          </NuxtLink>
        </li>
      </ol>
    </template>
  </div>
</template>
