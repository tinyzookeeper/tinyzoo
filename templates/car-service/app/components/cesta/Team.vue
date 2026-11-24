<script setup lang="ts">
// Cesta's people: a portrait, the name, the role in the brand colour and a few sentences.
import type { TeamMember } from '../../lib/cms-content'

defineProps<{ block: BlockOf<'team'>; first?: boolean; anchor?: string; people: TeamMember[] }>()
</script>

<template>
  <section :id="anchor" class="wrap py-16 lg:py-24 scroll-mt-4">
    <div class="grid lg:grid-cols-12 gap-x-14 gap-y-6 items-end">
      <div class="lg:col-span-7">
        <p v-if="block.eyebrow" class="kicker">{{ block.eyebrow }}</p>
        <component :is="first ? 'h1' : 'h2'" class="mt-2 font-extrabold text-[38px] sm:text-[50px]">{{ plainEmphasis(block.heading) }}</component>
      </div>
      <p v-if="block.text" class="lg:col-span-5 text-quiet">{{ tidyText(block.text) }}</p>
    </div>
    <div class="mt-12 grid sm:grid-cols-3 gap-x-6 gap-y-12">
      <article v-for="p in people" :key="p.id">
        <CmsImage v-if="p.photo" :media="p.photo" sizes="(min-width: 640px) 26rem, 100vw" class="w-full aspect-[4/5] object-cover rounded-[24px]" />
        <h3 class="mt-6 font-bold text-[26px]">{{ p.name }}</h3>
        <p v-if="p.role" class="mt-1.5 font-display font-semibold text-[17px] text-brand">{{ p.role }}</p>
        <p v-if="p.text" class="mt-3 text-[17px] text-quiet">{{ tidyText(p.text) }}</p>
      </article>
    </div>
  </section>
</template>
