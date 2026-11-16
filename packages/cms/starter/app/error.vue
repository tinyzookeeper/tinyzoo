<script setup lang="ts">
// The website's error page (a missing address, a server error), inside the site's own
// header and footer, in the visitor's language.
import type { NuxtError } from '#app'

const props = defineProps<{ error: NuxtError }>()
const route = useRoute()
const en = computed(() => route.path === '/en' || route.path.startsWith('/en/'))
const missing = computed(() => props.error.statusCode === 404)
useHead({ title: () => (missing.value ? (en.value ? 'Page not found' : 'Stránka nenalezena') : (en.value ? 'Something went wrong' : 'Něco se pokazilo')) })
</script>

<template>
  <UApp>
    <NuxtLayout>
      <section class="mx-auto max-w-2xl px-4 py-24 text-center">
        <p class="text-sm font-semibold text-muted">{{ error.statusCode }}</p>
        <h1 class="mt-2 text-3xl font-bold">
          {{ missing ? (en ? 'This page doesn’t exist' : 'Tahle stránka tu není') : (en ? 'Something went wrong' : 'Něco se pokazilo') }}
        </h1>
        <p class="mt-3 text-muted">
          {{ missing ? (en ? 'It may have moved, or the address has a typo.' : 'Možná se přesunula, nebo je v adrese překlep.') : (en ? 'Please try again in a moment.' : 'Zkuste to prosím za chvíli znovu.') }}
        </p>
        <UButton class="mt-8" size="lg" @click="clearError({ redirect: en ? '/en' : '/' })">{{ en ? 'Go to the home page' : 'Na úvodní stránku' }}</UButton>
      </section>
    </NuxtLayout>
  </UApp>
</template>
