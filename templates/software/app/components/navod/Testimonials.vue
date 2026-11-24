<script setup lang="ts">
// Návod's testimonials: three quotes ruled off under the section above them (the heading is only
// for screen readers: the section continues the one before it).
import type { Testimonial } from '../../lib/cms-content'

defineProps<{ block: BlockOf<'testimonials'>; first?: boolean; anchor?: string; items: Testimonial[] }>()
</script>

<template>
  <section :id="anchor" class="nv-quotes">
    <div class="wrap nv-quotes-wrap">
      <component :is="first ? 'h1' : 'h2'" class="sr-only"><KitMarked :text="block.heading" plain /></component>
      <div class="grid gap-10 border-t border-ink pt-10 md:grid-cols-3 md:gap-8">
        <figure v-for="t in items" :key="t.id" class="flex flex-col">
          <blockquote class="text-[18px] leading-[1.5] text-ink">„{{ tidyText(t.text) }}“</blockquote>
          <figcaption class="mt-6 flex items-center gap-3 text-[14px] leading-snug">
            <CmsImage v-if="t.photo" :media="t.photo" sizes="3.5rem" class="h-14 w-14 flex-none border border-ink object-cover" />
            <span><b class="font-semibold text-ink">{{ t.name }}</b><template v-if="t.role"><br><span class="text-quiet">{{ tidyText(t.role) }}</span></template></span>
          </figcaption>
        </figure>
      </div>
    </div>
  </section>
</template>
