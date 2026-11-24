<script setup lang="ts">
// One Day's "who makes it", 21:00: after closing time, among themselves, on the evening blue: the
// team's photograph and a few words, then support and the data on the left, the form card on the right.
import type { SiteForm } from '#imports'

defineProps<{ block: BlockOf<'team'>; first?: boolean; anchor?: string; form: SiteForm }>()
const { settings, words, statusHost } = await useSoftware()
</script>

<template>
  <section :id="anchor" class="dark-band bg-evening text-cream">
    <div class="wrap lg:grid lg:grid-cols-[150px_1fr]">
      <JedenDenRail class="pt-12 lg:pt-24" :time="block.time" :note="block.timeNote" />
      <div class="pb-16 pt-6 lg:pb-28 lg:pl-14 lg:pt-24">
        <div class="grid gap-8 lg:grid-cols-12 lg:items-center lg:gap-10">
          <CmsImage v-if="block.image" :media="block.image" sizes="(min-width: 1024px) 40rem, 100vw" class="aspect-[3/2] w-full rounded-[22px] object-cover lg:col-span-7" />
          <div :class="block.image ? 'lg:col-span-5' : 'lg:col-span-12'">
            <p v-if="block.eyebrow" class="time mb-3 opacity-80">{{ block.eyebrow }}</p>
            <component :is="first ? 'h1' : 'h2'" class="h2 text-[36px] sm:text-[46px] lg:text-[48px]"><KitMarked :text="block.heading" /></component>
            <p v-for="(p, i) in paragraphs(block.text)" :key="i" class="opacity-90" :class="i ? 'mt-4' : 'mt-5'">{{ tidyText(p) }}</p>
          </div>
        </div>

        <div :id="anchorOf('contact')" class="mt-12 grid gap-10 border-t border-cream/25 pt-10 lg:mt-16 lg:grid-cols-12 lg:gap-10 lg:pt-12">
          <div class="space-y-8 lg:col-span-5">
            <div v-if="block.supportLabel">
              <p class="time opacity-80">{{ block.supportLabel }}<template v-if="settings?.supportHours"> · {{ settings.supportHours }}</template></p>
              <a v-if="settings?.supportPhone" :href="telHref(settings.supportPhone)" class="mt-2 block font-display text-[40px] font-semibold leading-none hover:text-lamp">{{ settings.supportPhone }}</a>
              <p class="mt-3 text-[16px] opacity-90"><a v-if="settings?.supportEmail" class="ul font-medium" :href="`mailto:${settings.supportEmail}`">{{ settings.supportEmail }}</a>. {{ tidyText(block.outsideText) }}</p>
            </div>
            <div v-if="block.dataLabel">
              <p class="time opacity-80">{{ block.dataLabel }}</p>
              <p class="mt-2 font-display text-[24px] font-semibold leading-tight">{{ tidyText(block.dataHeadline) }}</p>
              <p class="mt-2 text-[16px] opacity-90">{{ tidyText(block.dataText) }} <template v-if="settings?.statusUrl">{{ words.look['jeden-den'].statusSee }} <a class="ul font-medium" :href="settings.statusUrl" target="_blank" rel="noopener">{{ statusHost }}</a>.</template></p>
            </div>
          </div>
          <JedenDenContactForm :form="form" :heading="block.formHeading" :text="block.formText" :note="block.formNote" class="lg:col-span-7" />
        </div>
      </div>
    </div>
  </section>
</template>
