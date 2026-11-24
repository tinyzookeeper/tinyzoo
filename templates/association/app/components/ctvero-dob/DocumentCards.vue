<script setup lang="ts">
// The documents as a card per year (and one for those that always apply), each file a row to
// download. `years` is how many of the newest years to show; 0 shows all.
import type { Document } from '../../lib/cms-content'

const props = withDefaults(defineProps<{ documents: Document[]; years?: number }>(), { years: 0 })
const { words } = await useAssociation()
const groups = computed(() => documentGroups(props.documents, props.years))
</script>

<template>
  <div v-if="groups.length" class="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
    <div v-for="g in groups" :key="g.year ?? 'permanent'" class="card p-6">
      <p v-if="g.year != null" class="serif lnum text-[3.2rem] font-extrabold leading-[0.85] text-ink">{{ g.year }}</p>
      <p v-else class="serif text-[2.1rem] font-bold italic leading-[1.3] text-ink">{{ words.permanent }}</p>
      <ul class="mt-5">
        <li v-for="d in g.items" :key="d.id" class="border-t border-[var(--rule)]">
          <a v-if="d.file" :href="d.file.url" class="group flex min-h-[56px] items-center justify-between gap-3 py-2 text-ink" target="_blank" rel="noopener" data-document>
            <span><span class="block font-semibold group-hover:underline">{{ tidy(d.title) }}</span><span v-if="d.note" class="block text-[0.9rem]">{{ tidy(d.note) }}</span></span><UIcon name="i-lucide-download" class="size-[20px] flex-none" aria-hidden="true" />
          </a>
          <div v-else class="flex min-h-[56px] items-center justify-between gap-3 py-2 text-ink">
            <span><span class="block font-semibold">{{ tidy(d.title) }}</span><span v-if="d.note" class="block text-[0.9rem]">{{ tidy(d.note) }}</span></span>
          </div>
        </li>
      </ul>
    </div>
  </div>
</template>
