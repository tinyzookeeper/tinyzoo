<script setup lang="ts">
// Every other address: a page from blocks (/cenik), a category of the gallery
// (/galerie/svatby) or one album (/album/anna-a-vojta).
const route = useRoute()
const words = useSiteWords()
// The home page has one address: /. The query stays (?preview shows a draft).
if (route.path.replace(/\/$/, '') === '/home') await navigateTo({ path: '/', query: route.query }, { redirectCode: 301 })
const { kind, error, page, category, album, isDraft } = await useSitePage()
if (error.value?.statusCode === 404) throw createError({ statusCode: 404, message: words.value.notFoundTitle, fatal: true })
if (error.value) throw createError({ statusCode: error.value.statusCode ?? 500, message: words.value.errorTitle, fatal: true })

const { name } = await useSite()
const item = computed(() => page.value ?? album.value ?? null)
useCmsSeo(item, { siteName: name.value, descriptionField: 'summary', imageField: 'cover', defaultLocale: DEFAULT_LANGUAGE, path: siteHref })
if (kind.value === 'category') {
  useHead({ title: () => `${category.value?.name ?? ''} · ${name.value}` })
  useSeoMeta({ description: () => category.value?.description ?? undefined })
}
</script>

<template>
  <div>
    <SiteDraftNote v-if="isDraft" />
    <CmsBlocks v-if="kind === 'page' && page" :blocks="page.sections" />
    <LookCategory v-else-if="kind === 'category' && category" :category="category" />
    <LookAlbum v-else-if="kind === 'album' && album" :album="album" />
  </div>
</template>
