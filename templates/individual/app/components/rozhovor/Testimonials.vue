<script setup lang="ts">
// Rozhovor's testimonials: other people's words are always bubbles. On a rounded panel of the
// brand colour, three bubbles set lower one after another, each with the initials of who said it.
import type { Testimonial } from '~/lib/cms-content'

defineProps<{ block: BlockOf<'testimonials'>; first?: boolean; anchor?: string; items: Testimonial[] }>()
const { name } = await useProfile()
// The first three are staggered; more of them continue the same rhythm.
const OFFSET = ['', 'md:mt-10', 'md:mt-20']
</script>

<template>
  <section :id="anchor" class="panel bg-brand text-brand-ink on-dark">
    <div class="wrap py-16 lg:py-24">
      <div class="flex gap-4 items-center">
        <span class="avatar !bg-brand-ink !text-brand" aria-hidden="true">{{ initialsOf(name) }}</span>
        <component :is="first ? 'h1' : 'h2'" class="!text-brand-ink text-[1.9rem] md:text-[2.6rem] leading-[1.1]"><KitMarked :text="block.heading" plain /></component>
      </div>
      <div class="mt-10 lg:mt-12 grid md:grid-cols-3 gap-x-5 gap-y-10 items-start">
        <figure v-for="(t, i) in items" :key="t.id" :class="OFFSET[i % 3]">
          <blockquote class="bubble block p-6 lg:p-7 text-[1.15rem] leading-[1.5]">„{{ czText(t.text) }}“</blockquote>
          <figcaption class="mt-4 flex items-center gap-3 pl-1">
            <span class="avatar !bg-ink/30 !text-brand-ink" aria-hidden="true">{{ initialsOf(t.name) }}</span>
            <span class="leading-[1.3]"><span class="block font-bold">{{ t.name }}</span><span v-if="t.role" class="block text-[1rem]">{{ czText(t.role) }}</span></span>
          </figcaption>
        </figure>
      </div>
    </div>
  </section>
</template>
