<script setup lang="ts">
// "Not found" and other errors, in the site's own look and the address's language.
const props = defineProps<{ error: { statusCode?: number; message?: string } }>()
const notFound = computed(() => props.error.statusCode === 404)
const { lang, t, to } = useLang()
// The switcher has no same page to offer here (and must not keep the last page's).
useAlternates().value = {}
useAlternatesFallback().value = null
useHead({ htmlAttrs: { lang }, title: () => (notFound.value ? t('notFoundHead') : t('errorTitle')) })
</script>

<template>
  <NuxtLayout>
    <section class="wrap grid min-h-[60vh] place-items-center py-24 text-center">
      <div>
        <img src="/animals/hedgehog.svg" alt="" class="mx-auto h-24 w-auto" aria-hidden="true">
        <h1 class="display mt-8 text-5xl">{{ notFound ? t('notFoundTitle') : t('errorTitle') }}</h1>
        <p class="lede mt-4">{{ notFound ? t('notFoundText') : t('errorText') }}</p>
        <NuxtLink :to="to('/')" class="btn btn-dark mt-8" @click="clearError()">{{ t('goHome') }}</NuxtLink>
      </div>
    </section>
  </NuxtLayout>
</template>
