<script setup lang="ts">
// Sál's "where": a white card with the building's photograph, the address, a line drawn from the
// square over the bridge to the studio, and the ways of getting there with small icons.
defineProps<{ block: BlockOf<'where'>; first?: boolean; anchor?: string }>()
const { settings, name, words } = await useStudio()
</script>

<template>
  <section :id="anchor" class="wrap pt-14 md:pt-20 pb-20 md:pb-28">
    <div class="grid lg:grid-cols-12 rounded-[2rem] overflow-hidden bg-card">
      <div class="lg:col-span-5 min-h-[16rem] bg-tint"><CmsImage v-if="block.image" :media="block.image" sizes="(min-width: 1024px) 35rem, 100vw" class="w-full h-full object-cover aspect-[4/3] lg:aspect-auto" /></div>
      <div class="lg:col-span-7 p-7 md:p-11">
        <p v-if="block.eyebrow" class="label">{{ block.eyebrow }}</p>
        <component :is="first ? 'h1' : 'h2'" class="mt-3 font-display text-[clamp(1.9rem,3vw,2.6rem)] leading-[1.1] tracking-normal text-ink"><KitMarked :text="block.heading" plain /></component>
        <p v-if="block.text" class="mt-2">{{ tidyText(block.text) }}</p>

        <!-- The way on foot: a sketch in place of a map -->
        <div v-if="block.routeFrom && block.routeVia" class="mt-8" role="img" :aria-label="words.routeLabel(block.routeFrom, block.routeFromTime, block.routeVia, block.routeViaTime)">
          <div class="grid grid-cols-[auto_1fr_auto_1fr_auto] items-center gap-3 text-[0.8rem] text-quiet">
            <span class="w-3 h-3 rounded-full shadow-[inset_0_0_0_1.5px_var(--ink)]" />
            <span class="relative h-px bg-ink/40"><span class="absolute left-1/2 -translate-x-1/2 -top-3 px-2 bg-card whitespace-nowrap">{{ block.routeFromTime }}</span></span>
            <span class="w-3 h-3 rounded-full shadow-[inset_0_0_0_1.5px_var(--ink)]" />
            <span class="relative h-px bg-ink/40"><span class="absolute left-1/2 -translate-x-1/2 -top-3 px-2 bg-card whitespace-nowrap">{{ block.routeViaTime }}</span></span>
            <span class="w-4 h-4 rounded-full bg-brand" />
          </div>
          <div class="mt-2 grid grid-cols-3 text-[0.9rem] leading-tight text-ink">
            <span>{{ block.routeFrom }}</span><span class="text-center">{{ block.routeVia }}</span><span class="text-right font-semibold">{{ name }}</span>
          </div>
        </div>

        <dl v-if="block.ways.length" class="mt-9 grid sm:grid-cols-2 gap-x-10 gap-y-6 text-[0.975rem] leading-relaxed">
          <div v-for="w in block.ways" :key="w.id" class="flex gap-3.5">
            <UIcon :name="WAY_ICONS[w.icon ?? 'walk']!" class="mt-1 size-[1em] text-xl text-brand" aria-hidden="true" />
            <div><dt class="font-semibold text-ink">{{ w.label }}</dt><dd>{{ tidyText(w.text) }}</dd></div>
          </div>
        </dl>
        <a v-if="settings?.mapUrl" class="tlink mt-6" :href="settings.mapUrl" target="_blank" rel="noopener">{{ words.openMap }} <UIcon name="i-lucide-arrow-up-right" class="size-[1em]" aria-hidden="true" /></a>
      </div>
    </div>
  </section>
</template>
