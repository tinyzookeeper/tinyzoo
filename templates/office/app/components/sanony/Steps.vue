<script setup lang="ts">
// Šanony's steps: a heavy heading and a photograph on the left; on the right the steps, each with
// a huge brand-coloured numeral, between heavy rules.
defineProps<{ block: BlockOf<'steps'>; first?: boolean; anchor?: string }>()
</script>

<template>
  <section :id="anchor" class="wrap py-16 lg:py-28">
    <div class="grid gap-10 lg:grid-cols-12 lg:gap-8">
      <div class="lg:col-span-5">
        <component :is="first ? 'h1' : 'h2'" class="display" :class="displaySize(block.heading)"><KitMarked :text="block.heading" as="span" :attrs="{ class: 'text-brand' }" /></component>
        <CmsImage v-if="block.image" :media="block.image" :alt="block.imageAlt || undefined" sizes="(min-width: 1280px) 30rem, (min-width: 1024px) 40vw, 100vw" class="mt-8 aspect-[4/3] w-full object-cover lg:mt-12" />
      </div>
      <ol class="border-t-4 border-ink lg:col-span-6 lg:col-start-7">
        <li v-for="(s, i) in block.items" :key="s.id" class="grid grid-cols-[64px_1fr] gap-x-4 py-6 sm:grid-cols-[110px_1fr]" :class="i === block.items.length - 1 ? 'border-b-4 border-ink' : 'border-b-2 border-ink'">
          <span class="display text-[64px] text-brand sm:text-[92px]" aria-hidden="true">{{ i + 1 }}</span>
          <div class="pt-1 sm:pt-3">
            <h3 class="font-display text-[25px] font-bold leading-tight tracking-[-0.015em] sm:text-[29px]">{{ tidyText(s.title) }}</h3>
            <p v-if="s.text" class="mt-2 max-w-[46ch] text-[16px] leading-[1.55]">{{ tidyText(s.text) }}</p>
          </div>
        </li>
      </ol>
    </div>
  </section>
</template>
