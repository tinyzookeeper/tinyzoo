<script setup lang="ts">
// Vizitka's opening: a solid panel of the brand colour with the statement, the portrait filling
// the other side to the top and bottom of the screen, and under them the facts at a glance in
// a ruled strip.
const props = defineProps<{ block: BlockOf<'opening'>; first?: boolean; anchor?: string }>()
const { name, words } = await useProfile()
// A strip of three gives each its third; the rules between the facts follow their place.
const FACT_CLASSES = [
  'py-6 lg:py-8 pr-5 border-b border-line lg:border-b-0',
  'py-6 lg:py-8 pl-5 lg:px-8 border-l border-b border-line lg:border-b-0',
  'py-6 lg:py-8 pr-5 lg:px-8 lg:border-l border-line',
  'py-6 lg:py-8 pl-5 lg:pl-8 border-l border-line',
]
const facts = computed(() => props.block.facts.slice(0, 4))
</script>

<template>
  <div :id="anchor">
    <section class="lg:grid lg:grid-cols-12">
      <div class="lg:col-span-7 bg-brand text-brand-ink on-brand hero-pad py-14 md:py-20 lg:py-24 lg:min-h-[660px] flex flex-col justify-center">
        <p v-if="block.eyebrow" class="label opacity-85">{{ czText(block.eyebrow) }}</p>
        <component :is="first ? 'h1' : 'h2'" class="mt-6 !text-brand-ink text-[2.3rem] leading-[1.12] md:text-[3.2rem] xl:text-[3.9rem] xl:leading-[1.08] max-w-[18ch]" data-opening-heading><KitMarked :text="block.heading" /></component>
        <p v-if="block.text" class="mt-7 max-w-[35rem] text-[1.125rem] leading-[1.6] opacity-95">{{ czText(block.text) }}</p>
        <div class="mt-9 flex flex-wrap items-center gap-x-8 gap-y-3">
          <NuxtLink v-if="block.primaryLabel && block.primaryUrl" class="btn btn-paper" :to="siteHref(block.primaryUrl)">{{ block.primaryLabel }}</NuxtLink>
          <NuxtLink v-if="block.secondaryLabel && block.secondaryUrl" class="tlink" :to="siteHref(block.secondaryUrl)">{{ czText(block.secondaryLabel) }} <UIcon name="i-lucide-arrow-down" aria-hidden="true" /></NuxtLink>
        </div>
        <p v-if="block.note" class="mt-5 text-[0.95rem] opacity-85">{{ czText(block.note) }}</p>
      </div>
      <figure v-if="block.image" class="lg:col-span-5 relative bg-tint">
        <!-- (beside the panel on a desktop it fills the column: about 42vw wide) -->
        <CmsImage :media="block.image" eager sizes="(min-width: 1024px) 42vw, 100vw" class="w-full aspect-[4/5] sm:aspect-[3/2] lg:aspect-auto lg:absolute lg:inset-0 lg:h-full object-cover" />
        <figcaption class="absolute left-0 bottom-0 bg-paper px-5 py-3 label text-ink">{{ name }}</figcaption>
      </figure>
    </section>

    <section v-if="facts.length" :aria-label="words.inShort" class="border-b border-line">
      <dl class="wrap grid grid-cols-2" :class="facts.length === 3 ? 'lg:grid-cols-3' : 'lg:grid-cols-4'">
        <div v-for="(fact, i) in facts" :key="i" :class="FACT_CLASSES[i]">
          <dt class="label text-quiet">{{ fact.label }}</dt>
          <dd class="serif text-ink text-[1.1rem] lg:text-[1.2rem] leading-[1.35] mt-2">{{ czText(fact.value) }}</dd>
        </div>
      </dl>
    </section>
  </div>
</template>
