<script setup lang="ts">
// Cedule's agents: a table with a row for each person, ruled in black. The portrait, the name
// set large, what they do, and the phone number set larger than anything else in the row.
import type { Agent } from '../../lib/cms-content'

defineProps<{ block: BlockOf<'agents'>; first?: boolean; anchor?: string; agents: Agent[] }>()
</script>

<template>
  <section :id="anchor" class="wrap py-14 md:py-24">
    <div class="grid lg:grid-cols-12 gap-x-10 gap-y-4 items-end">
      <div class="lg:col-span-7">
        <p v-if="block.eyebrow" class="mono caps mb-3">{{ block.eyebrow }}</p>
        <component :is="first ? 'h1' : 'h2'" class="text-[3.2rem] md:text-[5rem] tracking-[-0.05em] leading-[0.9]"><KitMarked :text="block.heading" plain /></component>
      </div>
      <p v-if="block.text" class="lg:col-span-5 text-[1.1rem] font-medium max-w-[30rem]">{{ tidyText(block.text) }}</p>
    </div>
    <div class="mt-8 border-t-2 border-x-2 md:border-x-0 border-ink">
      <article v-for="a in agents" :key="a.id" class="grid grid-cols-[38%_1fr] md:grid-cols-[11rem_1fr_auto] md:items-center md:gap-x-10 border-b-2 border-ink">
        <div class="relative row-span-2 md:row-span-1 md:aspect-[4/5] bg-tint overflow-hidden"><CmsImage v-if="a.photo" :media="a.photo" sizes="(min-width: 768px) 11rem, 38vw" class="absolute inset-0 w-full h-full object-cover" /></div>
        <div class="px-4 pt-4 md:p-0 border-l-2 md:border-l-0 border-ink">
          <p v-if="a.role" class="mono caps text-quiet">{{ tidyText(a.role) }}</p>
          <h3 class="mt-2 text-[1.6rem] md:text-[2.6rem] tracking-[-0.045em]">{{ a.name }}</h3>
          <p v-if="a.text" class="mt-2 md:mt-3 text-[0.97rem] md:text-[1.05rem] font-medium max-w-[30rem]">{{ tidyText(a.text) }}</p>
        </div>
        <div class="px-4 pb-3 pt-1 md:p-0 md:text-right border-l-2 md:border-l-0 border-ink">
          <a v-if="a.phone" class="inline-flex items-center min-h-[44px] font-extrabold text-[1.4rem] md:text-[2.4rem] leading-none tracking-[-0.04em] num big-link" :href="telHref(a.phone)">{{ a.phone }}</a><br>
          <a v-if="a.email" class="inline-flex items-center min-h-[44px] mono break-all hover:underline underline-offset-4 decoration-2" :href="`mailto:${a.email}`">{{ a.email }}</a>
        </div>
      </article>
    </div>
  </section>
</template>
