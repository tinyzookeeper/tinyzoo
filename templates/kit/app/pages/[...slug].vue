<script setup lang="ts">
// Every other address: a page from blocks (/cenik), an entry of a collection the template
// gives an address (`ENTRY_PAGES`: /album/anna-a-vojta), or an entry of one of the site's own
// types (/kurzy/python), which the kit draws the same way in every look (KitCustomEntry).
const route = useRoute()
const design = useDesign()
// The entry's frame: the template's own LookEntry when it has one (in its own build Nuxt finds
// it under this name; the one app hands it over with the design), else the kit's.
const KitEntry = resolveComponent('LookEntry')
const words = useSiteWords()
// The home page has one address: /. The query stays (?preview shows a draft).
if (route.path.replace(/\/$/, '') === '/home') await navigateTo({ path: '/', query: route.query }, { redirectCode: 301 })
const { kind, error, page, entry, entryPage, customPage, customEntry, isDraft } = await useSitePage()
if (error.value?.statusCode === 404) throw createError({ statusCode: 404, message: words.value.notFoundTitle, fatal: true })
if (error.value) throw createError({ statusCode: error.value.statusCode ?? 500, message: words.value.errorTitle, fatal: true })

const { name } = await useSite()
// An entry of the site's own type: its type's labels and fields (the same request its blocks make).
const custom = customPage.value ? await useCustomTypes() : null
const customType = computed(() => (customPage.value ? custom?.type(customPage.value.type) ?? null : null))
if (customPage.value && (!customEntry.value || !customType.value)) throw createError({ statusCode: 404, message: words.value.notFoundTitle, fatal: true })

// A collection without SEO fields of its own (`titleField`) gets a plain title and description.
const plain = computed(() => entryPage.value?.titleField ?? null)
if (customType.value) {
  // "<title> · <site>", the type's summary as the description, its page picture when the page is shared.
  const t = customType.value
  useCmsSeo(customEntry, { siteName: name.value, titleField: t.titleField, descriptionField: t.page?.summary ?? undefined, imageField: t.page?.image ?? undefined, defaultLocale: design.site.DEFAULT_LANGUAGE, path: siteHref })
}
else {
  const item = computed(() => page.value ?? (plain.value ? null : entry.value) ?? null)
  useCmsSeo(item, { siteName: name.value, descriptionField: entryPage.value?.descriptionField, imageField: entryPage.value?.imageField, defaultLocale: design.site.DEFAULT_LANGUAGE, path: siteHref })
}
if (plain.value) {
  useHead({ title: () => `${entry.value?.[plain.value!] ?? ''} · ${name.value}` })
  useSeoMeta({ description: () => (entryPage.value?.descriptionField ? entry.value?.[entryPage.value.descriptionField] : undefined) ?? undefined })
}
</script>

<template>
  <div>
    <SiteDraftNote v-if="isDraft" />
    <CmsBlocks v-if="page" :blocks="page.sections" :prefix="design.blockPrefix" />
    <component :is="design.entry ?? KitEntry" v-else-if="entry && entryPage" :kind="kind" :part="entryPage.part" :entry="entry" />
    <LazyKitCustomEntry v-else-if="customEntry && customType" :entry="customEntry" :type="customType" />
  </div>
</template>
