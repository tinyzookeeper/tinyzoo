<script setup lang="ts">
// Lhůty's case studies: on the brand colour, one row for each case: the title with who and how
// long, the problem, what was done, and the result on a lighter panel. The title leads to the
// case's page.
import type { CaseStudy } from '~/lib/cms-content'

const props = defineProps<{ block: BlockOf<'cases'>; first?: boolean; anchor?: string; items: CaseStudy[] }>()
const { words } = await useOffice()
const rule = (i: number) => (i === props.items.length - 1 ? 'border-brand-ink/60' : 'border-brand-ink/25')
</script>

<template>
  <section :id="anchor" class="bg-brand text-brand-ink">
    <div class="wrap py-16 lg:py-24">
      <p v-if="block.eyebrow" class="label text-brand-soft"><span class="ticks" />{{ block.eyebrow }}</p>
      <div class="grid items-end gap-6 lg:grid-cols-12 lg:gap-12" :class="block.eyebrow ? 'mt-5' : ''">
        <component :is="first ? 'h1' : 'h2'" class="font-display text-[32px] leading-[1.15] sm:text-[42px] lg:col-span-7"><KitMarked :text="block.heading" /></component>
        <p v-if="block.text" class="max-w-[52ch] text-[16.5px] leading-[1.6] text-brand-soft lg:col-span-5">{{ tidyText(block.text) }}</p>
      </div>

      <div v-if="items.length" class="mt-12 border-t border-brand-ink/60">
        <article v-for="(c, i) in items" :key="c.id" class="grid gap-x-10 gap-y-5 border-b py-8 lg:grid-cols-12" :class="rule(i)" data-case>
          <div class="lg:col-span-3">
            <h3 class="font-display text-[24px] leading-[1.2]"><NuxtLink :to="`/pripad/${c.slug}`" class="underline decoration-brand-ink/40 underline-offset-4 hover:decoration-brand-ink">{{ tidyText(c.title) }}</NuxtLink></h3>
            <p v-if="c.client || c.duration" class="num mt-3 text-[12.5px] leading-[1.6] text-brand-soft"><template v-if="c.client">{{ c.client }}<br></template><template v-if="c.duration">{{ words.took(c.duration) }}</template></p>
          </div>
          <div class="lg:col-span-3"><p class="label text-[11px] text-brand-soft">{{ words.problem }}</p><p class="mt-2 text-[15.5px] leading-[1.6]">{{ tidyText(c.problem) }}</p></div>
          <div class="lg:col-span-3"><p class="label text-[11px] text-brand-soft">{{ words.whatWeDid }}</p><p class="mt-2 text-[15.5px] leading-[1.6]">{{ tidyText(c.solution) }}</p></div>
          <div class="bg-brand-ink/10 p-5 lg:col-span-3"><p class="label text-[11px] text-signal">{{ words.result }}</p><p class="mt-2 text-[16.5px] font-medium leading-[1.5]">{{ tidyText(c.outcome) }}</p></div>
        </article>
      </div>
    </div>
  </section>
</template>
