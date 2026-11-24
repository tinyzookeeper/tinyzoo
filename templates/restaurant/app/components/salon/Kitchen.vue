<script setup lang="ts">
// Salon's kitchen: the cook's portrait framed in brass beside a few words, and under them the
// suppliers as a ruled list next to the delivery.
import type { Supplier } from '../../lib/cms-content'

const props = defineProps<{ block: BlockOf<'kitchen'>; first?: boolean; anchor?: string; suppliers: Supplier[] }>()
const { words } = await useRestaurant()
const parts = computed(() => twoParagraphs(props.block.text))
</script>

<template>
  <section :id="anchor" class="border-t border-line scroll-mt-6">
    <div class="wrap py-20 lg:py-24">
      <div class="grid lg:grid-cols-12 gap-12 lg:gap-20 items-center">
        <figure v-if="block.image" class="frame lg:col-span-5 max-w-[26rem] lg:max-w-none">
          <CmsImage :media="block.image" sizes="(min-width: 1024px) 28rem, 90vw" class="w-full aspect-[4/5] object-cover" />
        </figure>
        <div :class="block.image ? 'lg:col-span-7' : 'lg:col-span-12'">
          <p v-if="block.eyebrow" class="label text-brand">{{ block.eyebrow }}</p>
          <component :is="first ? 'h1' : 'h2'" class="mt-5 font-display text-[2.4rem] lg:text-[3.3rem] leading-[1.08] tracking-[-.01em]"><KitMarked :text="block.heading" /></component>
          <div class="mt-7 space-y-5 max-w-[36rem] text-[1.1rem]">
            <p v-if="parts[0]">{{ tidyText(parts[0]) }}</p>
            <p v-for="(p, i) in parts[1]" :key="i" class="text-quiet">{{ tidyText(p) }}</p>
          </div>
          <p v-if="block.signature" class="mt-7 font-display italic text-[1.25rem]">{{ tidyText(block.signature) }}</p>
        </div>
      </div>

      <div v-if="suppliers.length || block.secondImage" class="mt-16 lg:mt-24 grid lg:grid-cols-12 gap-12 lg:gap-20 items-start">
        <div v-if="suppliers.length" :class="block.secondImage ? 'lg:col-span-7' : 'lg:col-span-12'">
          <h3 v-if="block.suppliersHeading" class="font-display italic text-[1.9rem] leading-tight">{{ block.suppliersHeading }}</h3>
          <table class="mt-5 w-full text-left">
            <tbody class="[&_tr]:border-t [&_tr]:border-line [&_td]:py-3.5 [&_td]:align-baseline">
              <tr v-for="(s, i) in suppliers" :key="s.id" :class="i === suppliers.length - 1 ? 'border-b' : ''">
                <td class="pr-4 text-[1.15rem]">{{ tidyText(s.name) }}</td>
                <td class="pr-4 text-quiet">{{ tidyText(s.supplier) }}</td>
                <td class="text-right whitespace-nowrap text-brand">{{ s.distance != null ? `${s.distance} ${words.km}` : '' }}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <figure v-if="block.secondImage" class="frame lg:col-span-5">
          <CmsImage :media="block.secondImage" sizes="(min-width: 1024px) 28rem, 90vw" class="w-full aspect-[3/2] object-cover" />
        </figure>
      </div>
    </div>
  </section>
</template>
