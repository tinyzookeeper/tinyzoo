<script setup lang="ts">
// One Day's testimonials, 15:00: one large quote with a tall portrait, and the others smaller
// under it (the featured one is the large one; the first, when none is marked).
import type { Testimonial } from '~/lib/cms-content'

const props = defineProps<{ block: BlockOf<'testimonials'>; first?: boolean; anchor?: string; items: Testimonial[] }>()
const lead = computed(() => props.items.find((t) => t.featured) ?? props.items[0] ?? null)
const others = computed(() => props.items.filter((t) => t !== lead.value))
</script>

<template>
  <section :id="anchor" class="bg-afternoon">
    <div class="wrap lg:grid lg:grid-cols-[150px_1fr]">
      <JedenDenRail class="pt-12 lg:pt-24" :time="block.time" :note="block.timeNote" />
      <div class="pb-16 pt-6 lg:pb-28 lg:pl-14 lg:pt-24">
        <p v-if="block.eyebrow" class="time text-brand">{{ block.eyebrow }}</p>
        <component :is="first ? 'h1' : 'h2'" class="h2 text-[36px] sm:text-[46px] lg:text-[52px]" :class="block.eyebrow ? 'mt-3' : ''"><KitMarked :text="block.heading" /></component>
        <div class="mt-10 grid gap-8 lg:mt-14 lg:grid-cols-12 lg:gap-10">
          <figure v-if="lead" class="grid gap-6 sm:items-end lg:col-span-12 lg:gap-10" :class="lead.photo ? 'sm:grid-cols-[200px_1fr] lg:grid-cols-[300px_1fr]' : ''">
            <CmsImage v-if="lead.photo" :media="lead.photo" sizes="(min-width: 1024px) 19rem, 62vw" class="aspect-[4/5] w-[62%] rounded-[22px] object-cover sm:w-full" />
            <div>
              <blockquote class="font-display text-[26px] font-medium leading-[1.22] sm:text-[30px] lg:text-[40px] lg:leading-[1.18]">„{{ tidyText(lead.text) }}“</blockquote>
              <figcaption class="mt-5 text-[16px]"><b class="font-semibold">{{ lead.name }}</b><template v-if="lead.role"> · {{ tidyText(lead.role) }}</template></figcaption>
            </div>
          </figure>
          <figure v-for="t in others" :key="t.id" class="flex gap-5 border-t border-ink/25 pt-8 lg:col-span-6">
            <CmsImage v-if="t.photo" :media="t.photo" sizes="6rem" class="h-[72px] w-[72px] flex-none rounded-[16px] object-cover sm:h-[92px] sm:w-[92px] sm:rounded-[18px]" />
            <div>
              <blockquote class="font-display text-[21px] font-medium leading-[1.3]">„{{ tidyText(t.text) }}“</blockquote>
              <figcaption class="mt-3 text-[15px]"><b class="font-semibold">{{ t.name }}</b><template v-if="t.role"> · {{ tidyText(t.role) }}</template></figcaption>
            </div>
          </figure>
        </div>
      </div>
    </div>
  </section>
</template>
