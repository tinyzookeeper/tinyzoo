<script setup lang="ts">
// Tabule's "where": the heading in capitals, the address large, a photograph of the building and
// four large figures (minutes on foot, by bus, places to park, bicycles).
defineProps<{ block: BlockOf<'where'>; first?: boolean; anchor?: string }>()
const { settings, words, short } = await useStudio()
</script>

<template>
  <section :id="anchor" class="on-light wrap py-16 lg:py-24">
    <div class="grid lg:grid-cols-12 gap-x-10 gap-y-10">
      <div class="lg:col-span-8">
        <component :is="first ? 'h1' : 'h2'" class="h2 h2s"><KitMarked :text="block.heading" plain /></component>
        <p v-if="short" class="mt-8 font-display font-bold text-[clamp(1.7rem,3.4vw,3rem)] leading-[1.05] tracking-[-0.03em]">{{ short }}</p>
        <p v-if="block.text" class="mt-3 max-w-[34rem] text-[1.1rem]">{{ tidyText(block.text) }}</p>
        <a v-if="settings?.mapUrl" class="ulink mono mt-4" :href="settings.mapUrl" target="_blank" rel="noopener">{{ words.openMap }} <UIcon name="i-lucide-arrow-up-right" class="size-[1em]" aria-hidden="true" /></a>
      </div>
      <div v-if="block.image" class="ph lg:col-span-4 aspect-[3/2] lg:aspect-[4/3] self-end"><CmsImage :media="block.image" sizes="(min-width: 1024px) 30rem, 100vw" /></div>
    </div>
    <dl v-if="block.ways.length" class="mt-10 lg:mt-14 grid grid-cols-2 lg:grid-cols-4 gap-x-8 gap-y-8">
      <div v-for="w in block.ways" :key="w.id" class="pt-4 border-t-2 border-ink">
        <dt class="mono">{{ w.label }}</dt>
        <dd class="mt-3"><span v-if="w.figure" class="display block text-[1.55rem] sm:text-[2.2rem] lg:text-[3rem] leading-none whitespace-nowrap">{{ w.figure }}</span><span class="block" :class="w.figure ? 'mt-3' : ''">{{ tidyText(w.text) }}</span></dd>
      </div>
    </dl>
  </section>
</template>
