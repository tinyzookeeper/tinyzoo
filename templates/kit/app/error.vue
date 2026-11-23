<script setup lang="ts">
// The website's error page (a missing address, a server error), inside the look's own
// header and footer.
import type { NuxtError } from '#app'

const props = defineProps<{ error: NuxtError }>()
const words = computed(() => wordsOf(DEFAULT_LANGUAGE))
const missing = computed(() => props.error.statusCode === 404)
useHead({ title: () => (missing.value ? words.value.notFoundTitle : words.value.errorTitle) })
</script>

<template>
  <UApp>
    <NuxtLayout>
      <LookPart
        part="Message" :code="String(error.statusCode ?? '')"
        :title="missing ? words.notFoundTitle : words.errorTitle" :text="missing ? words.notFoundText : words.errorText"
        :action="words.goHome" @act="clearError({ redirect: '/' })"
      />
    </NuxtLayout>
  </UApp>
</template>
