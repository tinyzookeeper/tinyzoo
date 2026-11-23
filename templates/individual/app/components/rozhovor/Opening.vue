<script setup lang="ts">
// Rozhovor's opening: a visitor says what brought them in a bubble, the owner answers with
// the heading and a button, the portrait sits on a tilted panel of the brand colour with the
// next free date on a badge, and under them a row of the questions people ask, which works as
// the page's table of contents (a row to swipe on a phone).
const props = defineProps<{ block: BlockOf<'opening'>; first?: boolean; anchor?: string }>()
const { settings, words } = await useProfile()
const chips = computed(() => props.block.chips.filter((c) => c.url))
</script>

<template>
  <section :id="anchor" class="wrap pt-6 lg:pt-10 pb-14 lg:pb-20">
    <div class="grid lg:grid-cols-12 gap-x-12 gap-y-12 items-center">
      <div :class="block.image ? 'lg:col-span-7' : 'lg:col-span-12'">
        <p v-if="block.question" class="bubble serif italic text-[1.05rem] md:text-[1.2rem] px-5 py-3">{{ czText(block.question) }}</p>
        <component :is="first ? 'h1' : 'h2'" class="mt-6 text-[2.35rem] leading-[1.1] md:text-[3.4rem] xl:text-[3.9rem] xl:leading-[1.06] tracking-[-0.03em]" data-opening-heading><KitMarked :text="block.heading" /></component>
        <p v-if="block.text" class="mt-6 max-w-[36rem] text-[1.25rem] leading-[1.5]">{{ czText(block.text) }}</p>
        <div class="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3">
          <NuxtLink v-if="block.primaryLabel && block.primaryUrl" class="btn" :to="siteHref(block.primaryUrl)">{{ block.primaryLabel }}</NuxtLink>
          <span v-if="block.note" class="text-[1.05rem] text-quiet">{{ czText(block.note) }}</span>
        </div>
      </div>
      <figure v-if="block.image" class="lg:col-span-5 relative max-w-[26rem] lg:max-w-none mx-auto w-full pb-6 pr-3">
        <span class="absolute inset-0 bottom-6 right-3 bg-brand rounded-[2.25rem] rotate-[4deg] translate-x-3 translate-y-2" aria-hidden="true" />
        <div class="ph relative aspect-[4/5] rounded-[2.25rem]"><CmsImage :media="block.image" eager sizes="(min-width: 1024px) 30rem, 26rem" /></div>
        <figcaption v-if="settings?.nextFree" class="absolute left-[-0.5rem] lg:left-[-1.5rem] bottom-0 bg-card text-ink rounded-full pl-4 pr-5 py-3 flex items-center gap-3 text-[1.02rem] font-medium shadow-[0_14px_30px_-18px_rgba(0,0,0,.45)]">
          <span class="w-2.5 h-2.5 rounded-full bg-brand" aria-hidden="true" /> {{ czText(settings.nextFree) }}
        </figcaption>
      </figure>
    </div>

    <!-- The questions people ask: the page's own table of contents -->
    <div v-if="chips.length" class="mt-12 lg:mt-16">
      <p v-if="block.chipsTitle" class="kicker text-quiet">{{ czText(block.chipsTitle) }}</p>
      <nav class="mt-4" :aria-label="block.chipsTitle || words.inShort">
        <!-- (a phone swipes the row; from a tablet's width the chips wrap) -->
        <UCarousel v-slot="{ item }" :items="chips" align="start" contain-scroll="trimSnaps" drag-free class="md:hidden" :ui="{ viewport: '-mx-5 px-5 pb-2', container: 'items-start -ms-3', item: 'basis-auto ps-3' }">
          <NuxtLink class="qchip" :to="siteHref(item.url!)">{{ czText(item.label) }}</NuxtLink>
        </UCarousel>
        <div class="hidden md:flex flex-wrap gap-3 pb-2">
          <NuxtLink v-for="(c, i) in chips" :key="i" class="qchip" :to="siteHref(c.url!)">{{ czText(c.label) }}</NuxtLink>
        </div>
      </nav>
    </div>
  </section>
</template>
