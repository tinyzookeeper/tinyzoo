<script setup lang="ts">
// Čekárna's location: the house on the left, the address and four facts with round icons on
// the right, in place of a map.
defineProps<{ block: BlockOf<'location'>; first?: boolean; anchor?: string }>()
const { settings, words } = await useMedical()
</script>

<template>
  <section :id="anchor" class="wrap pt-20 lg:pt-28 pb-20 lg:pb-28">
    <div class="grid gap-10 lg:gap-16 lg:grid-cols-[.78fr_1.22fr] items-center">
      <CmsImage v-if="block.image" :media="block.image" sizes="(min-width: 1024px) 28rem, 100vw" class="photo w-full aspect-[4/3] lg:aspect-[4/5]" />
      <div>
        <p v-if="block.eyebrow" class="kicker">{{ block.eyebrow }}</p>
        <component :is="first ? 'h1' : 'h2'" class="mt-2 text-[2.5rem] lg:text-[3rem]"><KitMarked :text="block.heading" plain /></component>
        <p v-if="block.text" class="mt-4 text-[1.12rem] text-ink">{{ tidyText(block.text) }}</p>
        <ul v-if="block.facts.length" class="mt-9 grid sm:grid-cols-2 gap-x-10 gap-y-8">
          <li v-for="f in block.facts" :key="f.id" class="grid grid-cols-[2.75rem_1fr] gap-x-4">
            <span class="grid place-items-center size-11 rounded-full bg-brand-tint text-brand"><UIcon :name="FACT_ICONS[f.icon ?? 'info']!" class="ic size-[21px]" aria-hidden="true" /></span>
            <div><h3 class="text-[1.15rem] leading-snug">{{ tidyText(f.title) }}</h3><p v-if="f.text" class="mt-1 text-[.98rem]">{{ tidyText(f.text) }}</p></div>
          </li>
        </ul>
        <a v-if="settings?.mapUrl" :href="settings.mapUrl" class="btn btn-soft mt-9" target="_blank" rel="noopener">{{ words.openMap }} <UIcon name="i-lucide-arrow-up-right" class="ic text-brand" aria-hidden="true" /></a>
      </div>
    </div>
  </section>
</template>
