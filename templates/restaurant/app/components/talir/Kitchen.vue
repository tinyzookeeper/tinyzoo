<script setup lang="ts">
// Talíř's kitchen: a black section. The heading with its second half in the accent colour, two
// paragraphs, the suppliers as a boxed grid of distances; the cook beside it with the delivery
// cut into a plate over his corner.
import type { Supplier } from '~/lib/cms-content'

const props = defineProps<{ block: BlockOf<'kitchen'>; first?: boolean; anchor?: string; suppliers: Supplier[] }>()
const { words } = await useRestaurant()
const size = computed(() => byLength(props.block.heading, [[36, 'text-[2.5rem] lg:text-[4.6rem]']], 'text-[2.1rem] lg:text-[3.4rem]'))
const parts = computed(() => twoParagraphs(props.block.text))
</script>

<template>
  <section :id="anchor" class="on-ink bg-ink text-paper scroll-mt-0">
    <div class="wrap py-16 lg:py-24">
      <div class="grid lg:grid-cols-12 gap-x-12 gap-y-10 items-start">
        <div class="lg:col-span-7">
          <p v-if="block.eyebrow" class="cap text-pop">{{ block.eyebrow }}</p>
          <component :is="first ? 'h1' : 'h2'" class="wide mt-4" :class="size"><KitMarked :text="block.heading" as="span" :attrs="{ class: 'text-pop' }" /></component>
          <div class="mt-8 grid sm:grid-cols-2 gap-x-10 gap-y-5">
            <p v-if="parts[0]">{{ tidyText(parts[0]) }}</p>
            <p v-for="(p, i) in parts[1]" :key="i" class="muted">{{ tidyText(p) }}</p>
          </div>
          <template v-if="suppliers.length">
            <h3 v-if="block.suppliersHeading" class="sr-only">{{ block.suppliersHeading }}</h3>
            <dl class="mt-10 lg:mt-12 grid grid-cols-2 sm:grid-cols-3 border-t-2 border-l-2 border-[color-mix(in_srgb,var(--paper)_35%,transparent)] [&>div]:border-r-2 [&>div]:border-b-2 [&>div]:border-[color-mix(in_srgb,var(--paper)_35%,transparent)] [&>div]:p-4 lg:[&>div]:p-5 [&>div]:flex [&>div]:flex-col-reverse [&>div]:justify-end">
              <div v-for="s in suppliers" :key="s.id">
                <dt class="mt-2.5"><span class="block font-bold text-[1.05rem] leading-tight">{{ tidyText(s.name) }}</span><span class="muted text-[.95rem]">{{ tidyText(s.supplier) }}</span></dt>
                <dd v-if="s.distance != null" class="num text-pop text-[2.3rem] lg:text-[2.7rem]">{{ s.distance }} {{ words.km }}</dd>
              </div>
            </dl>
          </template>
        </div>
        <div class="lg:col-span-5 relative pb-16 lg:pb-20 max-w-[30rem] lg:max-w-none">
          <CmsImage v-if="block.image" :media="block.image" sizes="(min-width: 1024px) 28rem, 84vw" class="w-[84%] ml-auto aspect-[4/5] object-cover" />
          <CmsImage v-if="block.secondImage" :media="block.secondImage" sizes="(min-width: 1024px) 15rem, 50vw" class="plate absolute left-0 bottom-0 !w-[50%] shadow-[0_0_0_6px_var(--ink)]" />
        </div>
      </div>
    </div>
  </section>
</template>
