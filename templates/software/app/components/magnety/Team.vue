<script setup lang="ts">
// Magnets' "who makes it": a mosaic of tiles. The team's photograph beside the words about them,
// under them the orange support tile with the phone number set large and the sky data tile, and
// beside those the dark contact form.
import type { SiteForm } from '#imports'

const props = defineProps<{ block: BlockOf<'team'>; first?: boolean; anchor?: string; form: SiteForm }>()
const { settings, words, statusHost } = await useSoftware()
const size = computed(() => byLength(props.block.heading, [[24, 'text-[40px] sm:text-[52px] lg:text-[56px]'], [40, 'text-[32px] sm:text-[42px] lg:text-[44px]']], 'text-[28px] sm:text-[34px] lg:text-[36px]'))
</script>

<template>
  <section :id="anchor" class="wrap pb-14 lg:pb-24">
    <div class="grid gap-4 lg:grid-cols-12 lg:gap-5">
      <CmsImage v-if="block.image" :media="block.image" sizes="(min-width: 1024px) 50rem, 100vw" class="tile aspect-[3/2] w-full object-cover lg:col-span-7 lg:aspect-auto lg:h-full" />
      <div class="tile bg-board p-6 lg:p-10" :class="block.image ? 'lg:col-span-5' : 'lg:col-span-12'">
        <p v-if="block.eyebrow" class="mono">{{ block.eyebrow }}</p>
        <component :is="first ? 'h1' : 'h2'" class="q mt-4" :class="size"><KitMarked :text="block.heading" /></component>
        <p v-for="(p, i) in paragraphs(block.text)" :key="i" :class="i ? 'mt-4' : 'mt-5'">{{ tidyText(p) }}</p>
      </div>
      <div class="grid gap-4 lg:col-span-5 lg:gap-5">
        <div v-if="block.supportLabel" class="tile bg-brand p-6 lg:p-8">
          <p class="mono">{{ block.supportLabel }}<template v-if="settings?.supportHours"> · {{ settings.supportHours }}</template></p>
          <a v-if="settings?.supportPhone" :href="telHref(settings.supportPhone)" class="mt-3 block font-display text-[40px] font-extrabold leading-none tracking-[-0.03em] hover:underline lg:text-[52px]">{{ settings.supportPhone }}</a>
          <p class="mt-3 text-[16px] font-medium"><a v-if="settings?.supportEmail" class="ul" :href="`mailto:${settings.supportEmail}`">{{ settings.supportEmail }}</a>. {{ tidyText(block.outsideText) }}</p>
        </div>
        <div v-if="block.dataLabel" class="tile bg-sky p-6 lg:p-8">
          <p class="mono">{{ block.dataLabel }}</p>
          <p class="mt-3 font-display text-[26px] font-bold leading-[1.1] tracking-[-0.01em]">{{ tidyText(block.dataHeadline) }}</p>
          <p class="mt-3 text-[16px]">{{ tidyText(block.dataText) }} <template v-if="settings?.statusUrl">{{ words.look.magnety.statusSee }} <a class="ul font-medium" :href="settings.statusUrl" target="_blank" rel="noopener">{{ statusHost }}</a>.</template></p>
        </div>
      </div>
      <MagnetyContactForm :anchor="anchorOf('contact')" :form="form" :heading="block.formHeading" :eyebrow="block.formEyebrow" :text="block.formText" class="lg:col-span-7" />
    </div>
  </section>
</template>
