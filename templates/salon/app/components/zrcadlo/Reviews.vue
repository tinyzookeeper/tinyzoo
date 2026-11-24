<script setup lang="ts">
// Zrcadlo's reviews: the first one large, the next two beside it in plain type.
import type { Review } from '~/lib/cms-content'

defineProps<{ block: BlockOf<'reviews'>; first?: boolean; anchor?: string; items: Review[] }>()
</script>

<template>
  <section :id="anchor" class="wrap py-20 md:py-28">
    <component :is="first ? 'h1' : 'h2'" class="label font-sans">{{ tidyText(block.heading) }}</component>
    <div v-if="items.length" class="mt-8 grid lg:grid-cols-12 gap-x-14 gap-y-12">
      <figure class="lg:col-span-7">
        <blockquote class="font-display text-ink text-[28px] leading-[1.25] md:text-[40px] md:leading-[1.2]">„{{ tidyText(items[0]!.text) }}“</blockquote>
        <figcaption class="mt-6 font-semibold text-ink">{{ items[0]!.name }} <span v-if="items[0]!.about" class="font-normal text-quiet">· {{ items[0]!.about }}</span></figcaption>
      </figure>
      <div v-if="items.length > 1" class="lg:col-span-5 grid gap-10 content-center">
        <figure v-for="r in items.slice(1, 3)" :key="r.id">
          <blockquote class="text-[18px] leading-[1.6] text-ink">„{{ tidyText(r.text) }}“</blockquote>
          <figcaption class="mt-3 font-semibold text-ink">{{ r.name }} <span v-if="r.about" class="font-normal text-quiet">· {{ r.about }}</span></figcaption>
        </figure>
      </div>
    </div>
  </section>
</template>
