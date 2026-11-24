<script setup lang="ts">
// The home page: the page whose address is "home".
const design = useDesign()
const { page, isDraft } = await useSitePage()
const { settings, name } = await useSite()
const words = useSiteWords()
useCmsSeo(page, { siteName: name.value, defaultLocale: design.site.DEFAULT_LANGUAGE, path: siteHref })
if (!page.value) useHead({ title: () => settings.value?.metaTitle || name.value })
</script>

<template>
  <div>
    <SiteDraftNote v-if="isDraft" />
    <CmsBlocks v-if="page" :blocks="page.sections" :prefix="design.blockPrefix" />
    <div v-else class="mx-auto max-w-2xl px-5 py-24 text-center">
      <h1 class="text-3xl">{{ words.welcomeTitle }}</h1>
      <p class="mt-3">
        {{ words.welcomeBefore }}<NuxtLink to="/admin" class="underline">{{ words.welcomeAdmin }}</NuxtLink>{{ words.welcomeAfter }}
      </p>
    </div>
  </div>
</template>
