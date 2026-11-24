<script setup lang="ts">
// Ciferník's services: soft white cards beside the heading and a tall arched photograph.
import type { Service } from '~/lib/cms-content'

defineProps<{ block: BlockOf<'services'>; first?: boolean; anchor?: string; items: Service[] }>()
</script>

<template>
  <section :id="anchor" class="wrap pt-16 lg:pt-24">
    <div class="grid gap-8 lg:grid-cols-[22rem_1fr] lg:gap-14">
      <div>
        <component :is="first ? 'h1' : 'h2'" class="text-[2.5rem] sm:text-[3.2rem] lg:text-[3.6rem]"><KitMarked :text="block.heading" plain /></component>
        <p v-if="block.text" class="mt-4 text-[1.08rem]">{{ tidyText(block.text) }}</p>
        <p v-if="block.coveredNote" class="mt-5 inline-flex items-center gap-2.5 rounded-full bg-card px-4 py-2.5 font-bold text-ink"><span class="grid place-items-center size-6 rounded-full bg-ok text-white"><UIcon name="i-lucide-check" class="ic size-[15px]" aria-hidden="true" /></span>{{ block.coveredNote }}</p>
        <CmsImage v-if="block.image" :media="block.image" sizes="24rem" class="arch mt-8 hidden lg:block w-[88%] aspect-[4/5] object-cover" />
      </div>
      <ul class="grid sm:grid-cols-2 gap-3 lg:gap-4 content-start">
        <li v-for="s in items" :key="s.id" class="panel p-6"><h3 class="text-[1.4rem]">{{ tidyText(s.name) }}</h3><p v-if="s.text" class="mt-2">{{ tidyText(s.text) }}</p></li>
      </ul>
    </div>
  </section>
</template>
