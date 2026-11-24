<script setup lang="ts">
// Výkres's people: the heading and a few words on the left, a portrait with name and role under
// it for each person on the right.
import type { Person } from '~/lib/cms-content'

defineProps<{ block: BlockOf<'team'>; first?: boolean; anchor?: string; people: Person[] }>()
</script>

<template>
  <section :id="anchor" class="wrap scroll-mt-24 pt-20 lg:pt-28">
    <div class="grid gap-10 lg:grid-cols-12 lg:gap-8">
      <div class="lg:col-span-3">
        <p v-if="block.eyebrow" class="lab mb-3">{{ block.eyebrow }}</p>
        <component :is="first ? 'h1' : 'h2'" class="font-display text-[32px] font-light leading-tight tracking-[-.02em] text-ink sm:text-[42px]"><KitMarked :text="block.heading" as="span" /></component>
        <p v-if="block.text" class="mt-6 text-[15px] leading-[1.65]">{{ tidyText(block.text) }}</p>
        <p v-if="block.note" class="text-[15px] leading-[1.65]" :class="block.text ? 'mt-3' : 'mt-6'">{{ tidyText(block.note) }}</p>
      </div>
      <div class="grid gap-8 sm:grid-cols-3 lg:col-span-9">
        <article v-for="p in people" :key="p.id" data-person>
          <div class="aspect-[4/5] overflow-hidden bg-tint"><CmsImage v-if="p.photo" :media="p.photo" sizes="(min-width: 1280px) 22rem, (min-width: 640px) 28vw, 100vw" class="h-full w-full object-cover" /></div>
          <h3 class="mt-4 font-display text-[20px] font-normal tracking-[-.01em] text-ink">{{ p.name }}</h3>
          <p v-if="p.role" class="lab mt-1">{{ p.role }}</p>
          <p v-if="p.text" class="mt-3 text-[15px] leading-relaxed">{{ tidyText(p.text) }}</p>
        </article>
      </div>
    </div>
  </section>
</template>
