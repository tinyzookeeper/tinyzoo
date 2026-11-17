<script setup lang="ts">
// The home page: the page whose address is "home" (create it in the admin under Pages).
const { data, item: page } = await useSitePage()
const { settings } = await useSite()
const words = useSiteWords()
useCmsSeo(page, { siteName: settings.value?.siteName, defaultLocale: DEFAULT_LANGUAGE, path: siteHref })
</script>

<template>
  <div>
    <p v-if="data?.preview && page?.status !== 'published'" class="bg-amber-100 px-4 py-2 text-center text-sm text-amber-900">{{ words.draftPreview }}</p>
    <CmsBlocks v-if="page" :blocks="page.sections" />
    <div v-else class="mx-auto max-w-2xl px-4 py-24 text-center">
      <h1 class="text-3xl font-bold">{{ words.welcomeTitle }}</h1>
      <p class="mt-3 text-muted">
        {{ words.welcomeBefore }}<NuxtLink to="/admin" class="underline">{{ words.welcomeAdmin }}</NuxtLink>{{ words.welcomeAfter }}
      </p>
    </div>
  </div>
</template>
