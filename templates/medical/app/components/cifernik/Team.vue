<script setup lang="ts">
// Ciferník's team: portraits in circles on an offset colour disc, the colour changing from one person to the next.
import type { TeamMember } from '../../lib/cms-content'

defineProps<{ block: BlockOf<'team'>; first?: boolean; anchor?: string; items: TeamMember[] }>()
const DISCS = ['bg-brand', 'bg-second', 'bg-sun']
</script>

<template>
  <section :id="anchor" class="wrap pt-16 lg:pt-24">
    <div class="max-w-[44rem]">
      <component :is="first ? 'h1' : 'h2'" class="text-[2.5rem] sm:text-[3.2rem] lg:text-[3.6rem]"><KitMarked :text="block.heading" plain /></component>
      <p v-if="block.text" class="mt-4 text-[1.08rem]">{{ tidyText(block.text) }}</p>
    </div>
    <ul class="mt-10 grid grid-cols-2 lg:grid-cols-4 gap-x-5 gap-y-10 lg:gap-8">
      <li v-for="(m, i) in items" :key="m.id" class="text-center">
        <div v-if="m.photo" class="relative mx-auto w-[86%]"><span class="absolute inset-0 rounded-full translate-x-[5%] translate-y-[5%]" :class="DISCS[i % 3]" aria-hidden="true" /><CmsImage :media="m.photo" sizes="(min-width: 1024px) 14rem, 40vw" class="relative w-full aspect-square rounded-full object-cover object-[50%_18%]" /></div>
        <h3 class="mt-6 text-[1.3rem] lg:text-[1.5rem]">{{ tidyText(m.name) }}</h3>
        <p v-if="m.role" class="mt-1.5 font-bold text-brand text-[.95rem]">{{ m.role }}</p>
        <p v-if="m.text" class="mt-2 text-[.98rem]">{{ tidyText(m.text) }}</p>
      </li>
    </ul>
  </section>
</template>
