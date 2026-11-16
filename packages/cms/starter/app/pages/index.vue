<script setup lang="ts">
// The home page: the page whose address is "home" (create it in the admin under Pages).
const route = useRoute()
const preview = computed(() => ('preview' in route.query ? { preview: '' } : {}))
const { data } = await useFetch<{ item: any; preview?: boolean }>('/api/content/page/home', { query: preview, key: 'home' })
const page = computed(() => data.value?.item ?? null)
const { settings } = await useSite()
useCmsSeo(page, { siteName: settings.value?.siteName })
</script>

<template>
  <div>
    <p v-if="data?.preview && page?.status !== 'published'" class="bg-amber-100 px-4 py-2 text-center text-sm text-amber-900">Náhled konceptu · zatím není na webu</p>
    <CmsBlocks v-if="page" :blocks="page.sections" />
    <div v-else class="mx-auto max-w-2xl px-4 py-24 text-center">
      <h1 class="text-3xl font-bold">Web je připravený.</h1>
      <p class="mt-3 text-muted">
        V <NuxtLink to="/admin" class="underline">administraci</NuxtLink> založte stránku s adresou <code>home</code>
        a poskládejte ji z bloků. Objeví se tady.
      </p>
    </div>
  </div>
</template>
