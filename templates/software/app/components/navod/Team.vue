<script setup lang="ts">
// Návod's "who makes it": the team's photograph as the last figure, a few words, and three ruled
// rows (where the data is, how to reach support, what happens out of hours); under it the
// contact area with the form.
import type { SiteForm } from '#imports'

defineProps<{ block: BlockOf<'team'>; first?: boolean; anchor?: string; form: SiteForm }>()
const { settings, words, statusHost } = await useSoftware()
const [sections, figuresBefore, features] = await Promise.all([usePageSections(), useFiguresBefore(), useFeatures()])
const number = computed(() => sectionNumber(sections.value, 'team'))
</script>

<template>
  <section :id="anchor" class="border-t border-ink/15">
    <div class="wrap py-16 lg:py-24">
      <div class="grid gap-10 lg:grid-cols-12 lg:gap-12">
        <figure v-if="block.image" class="lg:col-span-6">
          <CmsImage :media="block.image" sizes="(min-width: 1024px) 36rem, 100vw" class="aspect-[3/2] w-full border border-ink object-cover" />
          <figcaption v-if="block.imageCaption" class="mt-3 font-mono text-[12px] text-quiet"><span class="text-ink">{{ words.figure }} {{ figuresBefore + features.length + 1 }}</span> &nbsp;{{ tidyText(block.imageCaption) }}</figcaption>
        </figure>
        <div :class="block.image ? 'lg:col-span-6' : 'lg:col-span-8'">
          <p v-if="block.eyebrow" class="label text-quiet"><span class="text-brand">{{ number }}</span> · {{ block.eyebrow }}</p>
          <component :is="first ? 'h1' : 'h2'" class="mt-4 text-[32px] font-semibold leading-[1.1] tracking-[-0.03em] text-ink lg:text-[42px]"><KitMarked :text="block.heading" /></component>
          <p v-for="(p, i) in paragraphs(block.text)" :key="i" :class="i ? 'mt-4' : 'mt-6'">{{ tidyText(p) }}</p>
          <dl class="mt-8 border-t border-ink text-[16px]">
            <div v-if="block.dataLabel" class="grid gap-x-6 gap-y-1 border-b border-line py-4 sm:grid-cols-[150px_1fr]"><dt class="label pt-1 text-quiet">{{ block.dataLabel }}</dt><dd class="text-ink">{{ tidyText(block.dataHeadline) }} {{ tidyText(block.dataText) }}</dd></div>
            <div v-if="block.supportLabel" class="grid gap-x-6 gap-y-1 border-b border-line py-4 sm:grid-cols-[150px_1fr]">
              <dt class="label pt-1 text-quiet">{{ block.supportLabel }}</dt>
              <dd class="text-ink">{{ tidyText(settings?.supportHours) }}.<br><a v-if="settings?.supportPhone" class="link font-medium" :href="telHref(settings.supportPhone)">{{ settings.supportPhone }}</a><template v-if="settings?.supportPhone && settings?.supportEmail"> · </template><a v-if="settings?.supportEmail" class="link font-medium" :href="`mailto:${settings.supportEmail}`">{{ settings.supportEmail }}</a></dd>
            </div>
            <div v-if="block.outsideLabel" class="grid gap-x-6 gap-y-1 border-b border-line py-4 sm:grid-cols-[150px_1fr]"><dt class="label pt-1 text-quiet">{{ block.outsideLabel }}</dt><dd class="text-ink">{{ tidyText(block.outsideText) }} <template v-if="settings?.statusUrl">{{ words.look.navod.statusSee }} <a class="link font-medium" :href="settings.statusUrl" target="_blank" rel="noopener">{{ statusHost }}</a>.</template></dd></div>
          </dl>
        </div>
      </div>
      <NavodContactForm :anchor="anchorOf('contact')" :form="form" :heading="block.formHeading" :text="block.formText" :note="block.formNote" />
    </div>
  </section>
</template>
