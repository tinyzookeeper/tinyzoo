<script setup lang="ts">
// The website's error page (a missing address, a server error), inside the look's own
// header and footer. When the site's design could not be loaded there is no look to draw it
// in: then a plain message in the kit's words.
import type { NuxtError } from '#app'
import type { Design } from './utils/design'

const props = defineProps<{ error: NuxtError }>()
const design = useNuxtApp().$design as Design | null | undefined
const words = computed(() => (design ? design.site.wordsOf(design.site.DEFAULT_LANGUAGE) : KIT_WORDS.cs) as ReturnType<typeof wordsOf>)
const missing = computed(() => props.error.statusCode === 404)
useHead({ title: () => (missing.value ? words.value.notFoundTitle : words.value.errorTitle) })
</script>

<template>
  <UApp>
    <NuxtLayout v-if="design">
      <LookPart
        part="Message" :code="String(error.statusCode ?? '')"
        :title="missing ? words.notFoundTitle : words.errorTitle" :text="missing ? words.notFoundText : words.errorText"
        :action="words.goHome" @act="clearError({ redirect: '/' })"
      />
    </NuxtLayout>
    <main v-else class="mx-auto max-w-2xl px-5 py-24 text-center">
      <h1 class="text-3xl">{{ missing ? words.notFoundTitle : words.errorTitle }}</h1>
      <p class="mt-3">{{ missing ? words.notFoundText : words.errorText }}</p>
    </main>
  </UApp>
</template>
