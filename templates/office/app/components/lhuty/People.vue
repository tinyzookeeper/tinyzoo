<script setup lang="ts">
// Lhůty's people: a heading beside a wide photograph of the office, then one cell for each
// person (a compact photo-left list on a phone) with the contact in mono under a rule.
import type { Person } from '~/lib/cms-content'

defineProps<{ block: BlockOf<'people'>; first?: boolean; anchor?: string; items: Person[] }>()
</script>

<template>
  <section :id="anchor" class="bg-card">
    <div class="wrap py-16 lg:py-24">
      <div class="grid items-end gap-8 lg:grid-cols-12 lg:gap-12">
        <div class="lg:col-span-5">
          <p v-if="block.eyebrow" class="label text-quiet"><span class="ticks" />{{ block.eyebrow }}</p>
          <component :is="first ? 'h1' : 'h2'" class="font-display text-[32px] leading-[1.15] sm:text-[42px]" :class="block.eyebrow ? 'mt-5' : ''"><KitMarked :text="block.heading" /></component>
          <p v-if="block.text" class="mt-5 max-w-[50ch] text-[16.5px] leading-[1.6] text-ink/85">{{ tidyText(block.text) }}</p>
        </div>
        <figure v-if="block.image" class="lg:col-span-7">
          <CmsImage :media="block.image" sizes="(min-width: 1280px) 45rem, (min-width: 1024px) 55vw, 100vw" class="aspect-[16/9] w-full object-cover" />
        </figure>
      </div>

      <ul v-if="items.length" class="mt-12 grid grid-cols-1 gap-x-6 gap-y-10 border-t border-ink pt-8 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <li v-for="p in items" :key="p.id" class="grid grid-cols-[104px_1fr] content-start gap-x-4 sm:flex sm:flex-col">
          <CmsImage v-if="p.photo" :media="p.photo" sizes="(min-width: 1280px) 14rem, (min-width: 640px) 30vw, 7rem" class="row-span-4 aspect-[4/5] w-full self-start object-cover" />
          <div v-else class="row-span-4 aspect-[4/5] w-full self-start bg-tint" aria-hidden="true" />
          <h3 class="font-display text-[22px] leading-tight sm:mt-4">{{ p.name }}</h3>
          <p v-if="p.role" class="label mt-1.5 text-[11px] leading-[1.3] text-signal-text sm:min-h-[2.6em]">{{ p.role }}</p>
          <p v-if="p.text" class="mt-2 pb-3 text-[15px] leading-[1.5] text-ink/85">{{ tidyText(p.text) }}</p>
          <p v-if="p.email || p.phone" class="num mt-auto border-t border-line pt-3 text-[13px] leading-[1.9]">
            <a v-if="p.email" class="ulink block" :href="`mailto:${p.email}`">{{ p.email }}</a>
            <a v-if="p.phone" class="ulink block" :href="telHref(p.phone)">{{ phoneText(p.phone) }}</a>
          </p>
        </li>
      </ul>
    </div>
  </section>
</template>
