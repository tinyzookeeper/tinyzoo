<script setup lang="ts">
// Zrcadlo's hours and address: each day as a bar between 7 and 20 h with today marked, the
// photograph of the house with an address card over its corner, and three ways to get there.
defineProps<{ block: BlockOf<'visit'>; first?: boolean; anchor?: string }>()
const { settings, words, days } = await useSalon()
const today = useToday()
</script>

<template>
  <section :id="anchor" class="wrap py-20 md:py-28 scroll-mt-4">
    <div class="grid lg:grid-cols-12 gap-x-14 gap-y-16">
      <div class="lg:col-span-5">
        <p v-if="block.eyebrow" class="label">{{ block.eyebrow }}</p>
        <component :is="first ? 'h1' : 'h2'" class="mt-4 text-[38px] md:text-[48px] leading-[1.08]">{{ tidyText(block.heading) }}</component>
        <ul class="mt-9">
          <li v-for="d in days" :key="d.index" data-hours-day :data-today="d.index === today ? '' : undefined" class="grid grid-cols-[5.5rem_1fr_6.5rem] items-center gap-4 py-3" :class="d.index === today ? 'text-ink font-semibold' : ''">
            <span class="flex items-center gap-2">{{ d.name }}<span v-if="d.index === today" class="w-2 h-2 rounded-full bg-accent shadow-[0_0_0_1px_var(--ink)]" :title="words.today" /></span>
            <span class="relative h-3 rounded-full bg-surface" aria-hidden="true"><span v-if="barOf(d)" class="absolute inset-y-0 rounded-full" :class="d.index === today ? 'bg-brand' : 'bg-ink/70'" :style="barOf(d)!" /></span>
            <span class="text-right whitespace-nowrap"><template v-if="d.from != null">{{ d.fromText }}–{{ d.toText }} h</template><span v-else class="text-quiet">{{ words.closed }}</span></span>
          </li>
        </ul>
        <p v-if="settings?.hoursNote" class="mt-5 text-sm text-quiet">{{ tidyText(settings.hoursNote) }}</p>
      </div>
      <div class="lg:col-span-7">
        <div class="relative">
          <div class="rounded-[28px] md:rounded-[40px] overflow-hidden aspect-[3/2]"><CmsImage v-if="block.image" :media="block.image" sizes="(min-width: 1024px) 720px, 100vw" class="w-full h-full object-cover" /></div>
          <div v-if="settings?.address" class="md:absolute md:left-6 md:bottom-6 mt-4 md:mt-0 bg-surface rounded-[24px] p-6 md:max-w-[19rem]">
            <p class="label">{{ words.zrcadlo.whereWeAre }}</p>
            <p class="mt-2 font-display text-[28px] leading-[1.15] text-ink">{{ settings.address }}<template v-if="settings.town"><br>{{ settings.town }}</template></p>
            <a v-if="settings.mapUrl" :href="settings.mapUrl" target="_blank" rel="noopener" class="mt-3 inline-flex items-center gap-2 min-h-11 font-semibold text-brand hover:text-ink"><UIcon name="i-lucide-map-pin" aria-hidden="true" />{{ words.openMap }}</a>
          </div>
        </div>
        <dl v-if="block.ways.length" class="mt-8 grid sm:grid-cols-3 gap-x-8 gap-y-6 text-[15px]">
          <div v-for="w in block.ways" :key="w.id"><dt class="font-semibold text-ink">{{ w.label }}</dt><dd class="mt-1">{{ tidyText(w.text) }}</dd></div>
        </dl>
      </div>
    </div>
  </section>
</template>
