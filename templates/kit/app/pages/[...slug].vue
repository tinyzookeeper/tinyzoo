<script setup lang="ts">
// Every other address: a page from blocks (/cenik) or an entry of a collection the template
// gives an address (`ENTRY_PAGES`: /album/anna-a-vojta).
const route = useRoute()
const words = useSiteWords()
// The home page has one address: /. The query stays (?preview shows a draft).
if (route.path.replace(/\/$/, '') === '/home') await navigateTo({ path: '/', query: route.query }, { redirectCode: 301 })
const { kind, error, page, entry, entryPage, isDraft } = await useSitePage()
if (error.value?.statusCode === 404) throw createError({ statusCode: 404, message: words.value.notFoundTitle, fatal: true })
if (error.value) throw createError({ statusCode: error.value.statusCode ?? 500, message: words.value.errorTitle, fatal: true })

const { name } = await useSite()
// A collection without SEO fields of its own (`titleField`) gets a plain title and description.
const plain = computed(() => entryPage.value?.titleField ?? null)
const item = computed(() => page.value ?? (plain.value ? null : entry.value) ?? null)
useCmsSeo(item, { siteName: name.value, descriptionField: entryPage.value?.descriptionField, imageField: entryPage.value?.imageField, defaultLocale: DEFAULT_LANGUAGE, path: siteHref })
if (plain.value) {
  useHead({ title: () => `${entry.value?.[plain.value!] ?? ''} · ${name.value}` })
  useSeoMeta({ description: () => (entryPage.value?.descriptionField ? entry.value?.[entryPage.value.descriptionField] : undefined) ?? undefined })
}
</script>

<template>
  <div>
    <SiteDraftNote v-if="isDraft" />
    <CmsBlocks v-if="page" :blocks="page.sections" />
    <LookEntry v-else-if="entry && entryPage" :kind="kind" :part="entryPage.part" :entry="entry" />
  </div>
</template>
