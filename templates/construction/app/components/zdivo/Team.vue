<script setup lang="ts">
// Zdivo's people: the owner speaking in the first person beside his portrait, the site managers
// as small cards, and a brick for the rest of the crew.
import type { Person } from '~/lib/cms-content'

const props = defineProps<{ block: BlockOf<'team'>; first?: boolean; anchor?: string; people: Person[] }>()
const owner = computed(() => props.people[0] ?? null)
const others = computed(() => props.people.slice(1))
</script>

<template>
  <section :id="anchor" class="wrap scroll-mt-24 pt-20 lg:pt-28">
    <p v-if="block.eyebrow" class="eyebrow">{{ block.eyebrow }}</p>
    <component :is="first ? 'h1' : 'h2'" class="h2" :class="block.eyebrow ? 'mt-2' : ''"><KitMarked :text="block.heading" as="span" /></component>
    <p v-if="block.text" class="mt-4 max-w-[34em] leading-[1.55]">{{ tidyText(block.text) }}</p>
    <div class="mt-10 grid gap-2 lg:grid-cols-12">
      <template v-if="owner">
        <div class="overflow-hidden rounded-[4px] bg-brand-3 lg:col-span-4"><CmsImage v-if="owner.photo" :media="owner.photo" sizes="(min-width: 1280px) 26rem, (min-width: 1024px) 30vw, 100vw" class="aspect-[4/5] h-full w-full object-cover" /></div>
        <div class="flex flex-col rounded-[4px] bg-card p-6 sm:p-9 lg:col-span-4" data-person>
          <blockquote v-if="owner.quote" class="font-display text-[30px] font-medium italic leading-[1.12] text-ink sm:text-[34px]">„{{ tidyText(owner.quote) }}“</blockquote>
          <div :class="owner.quote ? 'mt-8 lg:mt-auto' : ''">
            <h3 class="font-display text-[28px] font-bold leading-none text-ink">{{ owner.name }}</h3>
            <p v-if="owner.role" class="mt-1.5 font-semibold text-brand">{{ owner.role }}</p>
            <p v-if="owner.text" class="mt-4 text-[15px] leading-[1.5]">{{ tidyText(owner.text) }}</p>
          </div>
        </div>
      </template>
      <div class="flex flex-col gap-2 lg:col-span-4">
        <article v-for="p in others" :key="p.id" class="grid flex-1 grid-cols-[120px_1fr] gap-4 rounded-[4px] bg-card p-2 sm:grid-cols-[150px_1fr]" data-person>
          <div class="overflow-hidden rounded-[3px] bg-brand-3"><CmsImage v-if="p.photo" :media="p.photo" sizes="10rem" class="aspect-[4/5] h-full w-full object-cover" /></div>
          <div class="self-center py-2 pr-3"><h3 class="font-display text-[25px] font-bold leading-none text-ink">{{ p.name }}</h3><p v-if="p.role" class="mt-1.5 text-[15px] font-semibold text-brand">{{ p.role }}</p><p v-if="p.text" class="mt-2.5 text-[15px] leading-[1.45]">{{ tidyText(p.text) }}</p></div>
        </article>
        <p v-if="block.note" class="rounded-[4px] bg-brand-3 px-5 py-4 text-[15px] font-medium leading-[1.45] text-ink">{{ tidyText(block.note) }}</p>
      </div>
    </div>
  </section>
</template>
