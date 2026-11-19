<script setup lang="ts">
import type { NuxtError } from '#app'

const props = defineProps<{ error: NuxtError }>()
const notFound = computed(() => props.error.statusCode === 404)
useHead({ title: notFound.value ? 'Not found · Keeper' : 'Error · Keeper' })
</script>

<template>
  <UApp>
    <div class="flex min-h-dvh flex-col items-center justify-center bg-(--k-moment-bg) px-6 text-center">
      <KAnimal :name="notFound ? 'hedgehog' : 'snail'" class="h-24 w-auto" />
      <h1 class="k-display mt-6 text-[1.75rem] leading-tight text-highlighted">{{ notFound ? 'Nothing here' : 'Something went wrong' }}</h1>
      <p class="mt-1 max-w-sm text-(--k-moment-text)">{{ notFound ? 'This page or site does not exist, or it was removed.' : error.statusMessage || error.message }}</p>
      <UButton label="Back to sites" icon="i-lucide-arrow-left" class="mt-6" @click="clearError({ redirect: '/' })" />
    </div>
  </UApp>
</template>
