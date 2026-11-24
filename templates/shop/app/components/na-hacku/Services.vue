<script setup lang="ts">
// Na háčku's services: rounded rows, each with an icon in a green circle, the text and the
// price as an outlined pill (under the text on a phone, at the right from a tablet), beside a
// rounded photograph of the counter.
import type { Service } from '../../lib/cms-content'

defineProps<{ block: BlockOf<'services'>; first?: boolean; anchor?: string; items: Service[] }>()
</script>

<template>
  <section :id="anchor" class="wrap scroll-mt-6 py-16 md:py-24">
    <div class="grid gap-10 lg:grid-cols-12 lg:gap-14">
      <div class="lg:col-span-5">
        <p v-if="block.eyebrow" class="eyebrow">{{ block.eyebrow }}</p>
        <component :is="first ? 'h1' : 'h2'" :class="block.eyebrow ? 'mt-5' : ''" class="text-[2.3rem] md:text-[3.3rem]"><KitMarked :text="block.heading" /></component>
        <p v-if="block.text" class="mt-5 max-w-md text-[1.08rem]">{{ tidyText(block.text) }}</p>
        <CmsImage v-if="block.image" :media="block.image" sizes="(min-width: 1024px) 34rem, 100vw" class="mt-8 aspect-[4/3] w-full rounded-[26px] object-cover" />
      </div>
      <ul class="grid gap-3 self-start lg:col-span-7">
        <li v-for="s in items" :key="s.id" class="flex items-start gap-4 rounded-[26px] bg-tint p-4 md:items-center md:gap-5 md:p-5">
          <span class="flex size-12 shrink-0 items-center justify-center rounded-full bg-brand text-[1.35rem] text-card md:size-14"><UIcon :name="`i-lucide-${s.icon ?? 'wrench'}`" aria-hidden="true" /></span>
          <div class="min-w-0 flex-1"><h3 class="text-[1.3rem] md:text-[1.45rem]">{{ s.name }}</h3><p v-if="s.text" class="mt-1 text-[0.97rem]">{{ tidyText(s.text) }}</p><p class="pill price mt-3 md:hidden" aria-hidden="true">{{ s.price }}</p></div>
          <p class="pill price hidden !text-[1rem] md:inline-flex">{{ s.price }}</p>
        </li>
      </ul>
    </div>
  </section>
</template>
