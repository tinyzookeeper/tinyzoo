<script setup lang="ts">
// Harmonogram's enquiry: a surface between two hairlines; what happens next with its times in
// the colour of the site and the phone large on the left, the form on the right.
import type { SiteForm } from '#imports'

const props = defineProps<{ block: BlockOf<'enquiry'>; first?: boolean; anchor?: string; form: SiteForm }>()
const { settings, words, tel } = await useFirm()
const form = props.form
</script>

<template>
  <section :id="anchor" class="mt-16 scroll-mt-20 border-y border-line bg-surface lg:mt-24">
    <div class="wrap grid gap-12 py-16 lg:grid-cols-12 lg:gap-8 lg:py-24">
      <div class="lg:col-span-5 lg:pr-8">
        <p v-if="block.eyebrow" class="mono">{{ block.eyebrow }}</p>
        <component :is="first ? 'h1' : 'h2'" class="text-[40px] font-extrabold leading-[.95] tracking-[-.04em] text-text sm:text-[64px]" :class="block.eyebrow ? 'mt-3' : ''"><KitMarked :text="block.heading" as="span" :attrs="{ class: 'text-brand' }" /></component>
        <p v-if="block.text" class="mt-6 leading-[1.6] text-quiet">{{ tidyText(block.text) }}</p>
        <ol v-if="block.steps.length" class="mt-9 border-t border-line">
          <li v-for="(s, i) in block.steps" :key="i" class="flex items-baseline justify-between gap-6 border-b border-line py-3.5"><span class="text-text">{{ s.text }}</span><span class="num flex-none text-[14px] text-brand">{{ s.when }}</span></li>
        </ol>
        <template v-if="tel && settings?.phone">
          <p v-if="block.callLabel" class="mono mt-10">{{ block.callLabel }}</p>
          <a :href="tel" class="num mt-2 inline-block text-[36px] font-medium tracking-[-.03em] text-text hover:text-brand sm:text-[46px]">{{ settings.phone }}</a>
          <p v-if="settings.hoursShort" class="mt-1 text-[15px] text-quiet">{{ settings.hoursShort }}</p>
        </template>
      </div>
      <div class="lg:col-span-7">
        <p v-if="form.sent.value" class="text-[26px] font-bold leading-snug tracking-[-.02em] text-text" role="status">{{ form.successMessage.value }}</p>
        <form v-else-if="!form.unavailable.value" :ref="form.el" class="relative grid gap-5 sm:grid-cols-2" novalidate @submit.prevent="form.submit">
          <EnquiryFields :form="form" :block="block" label-class="mono mb-2 block" />
          <div class="flex flex-wrap items-center gap-x-6 gap-y-3 sm:col-span-2">
            <button type="submit" class="btn btn-brand" :disabled="form.sending.value">{{ form.sending.value ? words.sending : form.submitLabel.value }} <UIcon name="i-lucide-arrow-right" class="size-[18px]" aria-hidden="true" /></button>
            <p v-if="block.consent" class="text-sm text-quiet">{{ block.consent }}</p>
          </div>
        </form>
      </div>
    </div>
  </section>
</template>
