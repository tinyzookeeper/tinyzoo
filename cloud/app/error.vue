<script setup lang="ts">
import type { NuxtError } from '#app'

const props = defineProps<{ error: NuxtError }>()
const t = useT()
const notFound = computed(() => props.error.statusCode === 404)
// A website's sign-in through the account that cannot go on (server/routes/oauth/authorize.get.ts):
// the page says what is wrong in plain words, and sends the browser nowhere.
const oauth = computed(() => {
  const data = props.error.data as { code?: unknown } | string | undefined
  let code: unknown = typeof data === 'object' && data ? data.code : undefined
  if (typeof data === 'string') { try { code = JSON.parse(data)?.code } catch { /* not ours */ } }
  return code === 'oauth.client' || code === 'oauth.redirect' || code === 'oauth.busy' ? code : null
})
const title = computed(() => (oauth.value ? t('oauth.errorTitle') : notFound.value ? t('error.notFoundTitle') : t('error.title')))
const text = computed(() => (oauth.value ? t(`error.${oauth.value}`) : notFound.value ? t('error.notFoundText') : t('error.text')))
useHead({ title })
</script>

<template>
  <UApp>
    <div class="relative flex min-h-dvh flex-col items-center justify-center bg-(--z-moment-bg) px-6 pb-16 text-center" :data-error="oauth ?? (notFound ? 'not-found' : 'error')">
      <ZAnimal :name="notFound ? 'hedgehog' : 'snail'" class="h-24 w-auto" />
      <h1 class="z-display mt-6 text-[1.75rem] leading-tight text-highlighted">{{ title }}</h1>
      <p class="z-moment-text mt-2 max-w-sm text-pretty">{{ text }}</p>
      <UButton :label="t('error.back')" icon="i-lucide-arrow-left" class="mt-6" size="lg" @click="clearError({ redirect: '/' })" />
      <footer class="absolute inset-x-0 bottom-6 flex justify-center"><ZLogo size="sm" /><span class="sr-only">tinyzoo</span></footer>
    </div>
  </UApp>
</template>
