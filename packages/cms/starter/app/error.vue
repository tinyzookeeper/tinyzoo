<script setup lang="ts">
// The website's error page (a missing address, a server error), inside the site's own
// header and footer, in the visitor's language.
import type { NuxtError } from '#app'

const props = defineProps<{ error: NuxtError }>()
const route = useRoute()
const locale = computed(() => languageOf(route.path))
const words = computed(() => wordsOf(locale.value))
const missing = computed(() => props.error.statusCode === 404)
useHead({ title: () => (missing.value ? words.value.notFoundTitle : words.value.errorTitle) })
</script>

<template>
  <UApp>
    <NuxtLayout>
      <section class="mx-auto max-w-2xl px-4 py-24 text-center">
        <p class="text-sm font-semibold text-muted">{{ error.statusCode }}</p>
        <h1 class="mt-2 text-3xl font-bold">
          {{ missing ? words.notFoundTitle : words.errorTitle }}
        </h1>
        <p class="mt-3 text-muted">
          {{ missing ? words.notFoundText : words.errorText }}
        </p>
        <UButton class="mt-8" size="lg" @click="clearError({ redirect: inLanguage(locale, '/') })">{{ words.goHome }}</UButton>
      </section>
    </NuxtLayout>
  </UApp>
</template>
