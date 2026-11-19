<script setup lang="ts">
import type { NuxtError } from '#app'

const props = defineProps<{ error: NuxtError }>()
const notFound = computed(() => props.error.statusCode === 404)
useHead({ title: notFound.value ? 'Not found · Keeper' : 'Error · Keeper' })
</script>

<template>
  <UApp>
    <div class="moment flex min-h-dvh flex-col items-center justify-center px-6 text-center">
      <img src="/favicon.svg" alt="" class="size-12">
      <h1 class="mt-4 text-2xl font-bold text-highlighted">{{ notFound ? 'Nothing here' : 'Something went wrong' }}</h1>
      <p class="mt-1 max-w-sm text-muted">{{ notFound ? 'This page or site does not exist, or it was removed.' : error.statusMessage || error.message }}</p>
      <UButton label="Back to sites" icon="i-lucide-arrow-left" class="mt-6" @click="clearError({ redirect: '/' })" />
    </div>
  </UApp>
</template>
