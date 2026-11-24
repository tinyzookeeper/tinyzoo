<script setup lang="ts">
// Ode dveří's "in the house": on a soft band, a heading, a line and a photograph beside the
// list of what the house offers, each led by how far it is from the rooms.
import type { Feature } from '~/lib/cms-content'

defineProps<{ block: BlockOf<'house'>; first?: boolean; anchor?: string; features: Feature[] }>()
</script>

<template>
  <section :id="anchor" class="soft mt-20 md:mt-28 bg-soft">
    <div class="wrap py-16 md:py-24 grid lg:grid-cols-12 gap-x-12 gap-y-10">
      <div class="lg:col-span-5">
        <component :is="first ? 'h1' : 'h2'" class="h2"><KitMarked :text="block.heading" plain /></component>
        <p v-if="block.text" class="mt-4 text-quiet max-w-[40ch]">{{ tidyText(block.text) }}</p>
        <div v-if="block.image" class="ph aspect-[4/3] mt-8"><CmsImage :media="block.image" sizes="(min-width: 1024px) 36rem, 100vw" /></div>
        <p v-if="block.imageCaption" class="mt-3 text-sm text-quiet">{{ tidyText(block.imageCaption) }}</p>
      </div>
      <ul class="lg:col-span-6 lg:col-start-7 self-center">
        <li v-for="(f, i) in features" :key="f.id" class="py-5 grid grid-cols-[5.5rem_1fr] md:grid-cols-[7rem_1fr] gap-x-4" :class="i ? 'rule' : ''">
          <p class="font-semibold text-brand num pt-0.5">{{ f.where }}</p>
          <div><h3 class="text-xl tracking-[-0.015em]">{{ f.name }}</h3><p v-if="f.text" class="mt-1.5 text-quiet">{{ tidyText(f.text) }}</p></div>
        </li>
      </ul>
    </div>
  </section>
</template>
