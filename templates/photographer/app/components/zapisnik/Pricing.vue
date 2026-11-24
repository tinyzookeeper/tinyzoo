<script setup lang="ts">
// Zápisník's price list: paper cards on the brand colour, the highlighted one dark and
// tilted, with a note stuck on it.
import type { Pack } from '../../lib/cms-content'

defineProps<{ block: BlockOf<'pricing'>; packs: Pack[]; first?: boolean }>()
</script>

<template>
  <section class="on-brand bg-brand text-brand-ink">
    <div class="wrap py-20 md:py-28">
      <div class="grid md:grid-cols-12 gap-x-10 gap-y-4 items-end mb-12 md:mb-16">
        <div class="md:col-span-7">
          <p v-if="block.eyebrow" class="hand text-[1.9rem] md:text-[2.1rem] -rotate-1 origin-left mb-3">{{ block.eyebrow }}</p>
          <component :is="first ? 'h1' : 'h2'" class="!text-brand-ink text-[2.4rem] md:text-[3.6rem] leading-[1.06]"><KitMarked :text="block.heading" plain /></component>
        </div>
        <p v-if="block.text" class="md:col-span-5 max-w-[30rem]">{{ tidyText(block.text) }}</p>
      </div>

      <div class="grid gap-6 md:gap-7 items-start text-body" :class="packs.length >= 3 ? 'md:grid-cols-3' : 'md:grid-cols-2'">
        <article
          v-for="p in packs" :key="p.id"
          :class="p.highlighted
            ? 'relative bg-ink text-[var(--paper)] rounded-[18px] p-7 md:p-8 md:-mt-6 md:rotate-[1.2deg] shadow-[0_22px_40px_-20px_rgba(8,12,10,.7)]'
            : 'bg-card rounded-[18px] p-7 md:p-8'"
        >
          <p v-if="p.highlighted && p.highlightLabel" class="hand absolute -top-5 right-5 md:-right-3 bg-card text-ink text-[1.45rem] px-4 py-2 rotate-[-4deg] shadow-[0_6px_14px_-8px_rgba(8,12,10,.6)]">{{ p.highlightLabel }}</p>
          <h3 class="text-[1.6rem] leading-tight" :class="p.highlighted ? '!text-[var(--paper)]' : ''">{{ tidyText(p.name) }}</h3>
          <p v-if="p.description" class="mt-1.5">{{ tidyText(p.description) }}</p>
          <p class="font-display text-[3.1rem] leading-none mt-6" :class="p.highlighted ? '' : 'text-ink'">{{ formatPrice(p.price) }} <span class="text-[0.5em]">Kč</span></p>
          <ul v-if="p.includes.length" class="mt-6 grid gap-2.5">
            <li v-for="line in p.includes" :key="line.id" class="flex gap-3"><UIcon name="i-lucide-check" class="mt-1 shrink-0 size-[18px]" :class="p.highlighted ? '' : 'text-brand'" aria-hidden="true" />{{ tidyText(line.text) }}</li>
          </ul>
          <NuxtLink v-if="p.highlighted && block.buttonLabel && block.buttonUrl" class="btn btn-paper w-full mt-7" :to="siteHref(block.buttonUrl)">{{ block.buttonLabel }}</NuxtLink>
        </article>
      </div>

      <p v-if="block.footnote" class="mt-10 md:mt-12 max-w-[44rem]">
        {{ tidyText(block.footnote) }}
        <NuxtLink v-if="block.footnoteLinkLabel && block.footnoteLinkUrl" class="font-bold underline underline-offset-4 decoration-2" :to="siteHref(block.footnoteLinkUrl)">{{ tidyText(block.footnoteLinkLabel) }}</NuxtLink>
      </p>
    </div>
  </section>
</template>
