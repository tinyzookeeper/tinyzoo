<script setup lang="ts">
// Harmonogram's people: a portrait, the role in mono, the name large and the direct phone in
// the colour of the site: "these three pick up the phone".
import type { Person } from '../../lib/cms-content'

defineProps<{ block: BlockOf<'team'>; first?: boolean; anchor?: string; people: Person[] }>()
</script>

<template>
  <section :id="anchor" class="wrap scroll-mt-20 pt-20 lg:pt-28">
    <div class="grid gap-6 lg:grid-cols-12 lg:items-end lg:gap-8">
      <div class="lg:col-span-7">
        <p v-if="block.eyebrow" class="mono">{{ block.eyebrow }}</p>
        <component :is="first ? 'h1' : 'h2'" class="text-[40px] font-extrabold leading-[.95] tracking-[-.04em] text-text sm:text-[64px]" :class="block.eyebrow ? 'mt-3' : ''"><KitMarked :text="block.heading" as="span" :attrs="{ class: 'text-brand' }" /></component>
      </div>
      <div v-if="block.text || block.note" class="max-w-[32em] leading-[1.6] text-quiet lg:col-span-5">
        <p v-if="block.text">{{ tidyText(block.text) }}</p>
        <p v-if="block.note" :class="block.text ? 'mt-3' : ''">{{ tidyText(block.note) }}</p>
      </div>
    </div>
    <div class="mt-10 grid gap-8 sm:grid-cols-3">
      <article v-for="p in people" :key="p.id" data-person>
        <div class="aspect-[4/5] overflow-hidden bg-surface"><CmsImage v-if="p.photo" :media="p.photo" sizes="(min-width: 1320px) 26rem, (min-width: 640px) 30vw, 100vw" class="h-full w-full object-cover" /></div>
        <p v-if="p.role" class="mono mt-4">{{ p.role }}</p>
        <h3 class="text-[26px] font-extrabold tracking-[-.03em] text-text" :class="p.role ? 'mt-1.5' : 'mt-4'">{{ p.name }}</h3>
        <p v-if="p.text" class="mt-2 text-[15px] leading-relaxed text-quiet">{{ tidyText(p.text) }}</p>
        <a v-if="p.phone" :href="telHref(p.phone)" class="num mt-3 inline-flex min-h-[44px] items-center gap-2 text-[17px] font-medium text-brand hover:text-text"><UIcon name="i-lucide-phone" class="size-4" aria-hidden="true" />{{ p.phone }}</a>
      </article>
    </div>
  </section>
</template>
