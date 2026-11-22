<script setup lang="ts">
import type { NuxtError } from '#app'

const props = defineProps<{ error: NuxtError }>()
const t = useT()
const notFound = computed(() => props.error.statusCode === 404)
useHead({ title: () => (notFound.value ? t('error.notFoundTitle') : t('error.title')) })
</script>

<template>
  <UApp>
    <div class="relative flex min-h-dvh flex-col items-center justify-center bg-(--z-moment-bg) px-6 pb-16 text-center">
      <ZAnimal :name="notFound ? 'hedgehog' : 'snail'" class="h-24 w-auto" />
      <h1 class="z-display mt-6 text-[1.75rem] leading-tight text-highlighted">{{ notFound ? t('error.notFoundTitle') : t('error.title') }}</h1>
      <p class="z-moment-text mt-2 max-w-sm text-pretty">{{ notFound ? t('error.notFoundText') : t('error.text') }}</p>
      <UButton :label="t('error.back')" icon="i-lucide-arrow-left" class="mt-6" size="lg" @click="clearError({ redirect: '/' })" />
      <footer class="absolute inset-x-0 bottom-6 flex justify-center"><ZLogo size="sm" /><span class="sr-only">tinyzoo</span></footer>
    </div>
  </UApp>
</template>
