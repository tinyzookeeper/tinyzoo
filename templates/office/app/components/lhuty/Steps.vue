<script setup lang="ts">
// Lhůty's steps: a photograph on the left and, on the right, the steps between rules, each
// dated in mono capitals ("den 0", "do týdne", "+ 3 dny").
const props = defineProps<{ block: BlockOf<'steps'>; first?: boolean; anchor?: string }>()
const rule = (i: number) => (i === props.block.items.length - 1 ? 'border-b border-ink' : 'border-b border-line')
</script>

<template>
  <section :id="anchor" class="wrap py-16 lg:py-24">
    <div class="grid gap-10 lg:grid-cols-12 lg:gap-12">
      <figure v-if="block.image" class="lg:col-span-5">
        <CmsImage :media="block.image" :alt="block.imageAlt || undefined" sizes="(min-width: 1280px) 31rem, (min-width: 1024px) 40vw, 100vw" class="aspect-[4/3] w-full object-cover lg:aspect-[4/5]" />
      </figure>
      <div :class="block.image ? 'lg:col-span-7' : 'lg:col-span-12'">
        <p v-if="block.eyebrow" class="label text-quiet"><span class="ticks" />{{ block.eyebrow }}</p>
        <component :is="first ? 'h1' : 'h2'" class="font-display text-[32px] leading-[1.15] sm:text-[42px]" :class="block.eyebrow ? 'mt-5' : ''"><KitMarked :text="block.heading" /></component>
        <ol class="mt-9 border-t border-ink">
          <li v-for="(s, i) in block.items" :key="s.id" class="grid gap-x-8 gap-y-1 py-5 sm:grid-cols-[9.5rem_1fr]" :class="rule(i)">
            <p class="num pt-1 text-[13px] uppercase tracking-[.08em] text-signal-text">{{ s.label }}</p>
            <div>
              <h3 class="text-[19px] font-semibold">{{ tidyText(s.title) }}</h3>
              <p v-if="s.text" class="mt-1 max-w-[52ch] text-[15.5px] leading-[1.55] text-ink/85">{{ tidyText(s.text) }}</p>
            </div>
          </li>
        </ol>
      </div>
    </div>
  </section>
</template>
