<script setup lang="ts">
// Zdivo's enquiry: a band of clay with the joints of a wall drawn over it; the owner's words and
// the phone on the left, the form on a plaster card on the right.
import type { SiteForm } from '#imports'

const props = defineProps<{ block: BlockOf<'enquiry'>; first?: boolean; anchor?: string; form: SiteForm }>()
const { settings, words, tel } = await useFirm()
const form = props.form
</script>

<template>
  <section :id="anchor" class="bond-bg mt-20 scroll-mt-20 text-brand-ink lg:mt-28">
    <div class="wrap grid gap-10 py-16 lg:grid-cols-12 lg:gap-8 lg:py-24">
      <div class="lg:col-span-5 lg:pr-6">
        <p v-if="block.eyebrow" class="font-semibold">{{ block.eyebrow }}</p>
        <component :is="first ? 'h1' : 'h2'" class="font-display text-[46px] font-extrabold leading-[.96] tracking-[-.015em] sm:text-[64px]" :class="block.eyebrow ? 'mt-2' : ''"><KitMarked :text="block.heading" as="span" /></component>
        <p v-if="block.text" class="mt-6 max-w-[28em] text-[18px] leading-[1.5]">{{ tidyText(block.text) }}</p>
        <p v-if="block.signature" class="mt-2 font-display text-[22px] font-medium italic">{{ block.signature }}</p>
        <ol v-if="block.steps.length" class="mt-8 space-y-2">
          <li v-for="(s, i) in block.steps" :key="i" class="flex items-baseline justify-between gap-6 rounded-[4px] bg-brand-d px-4 py-3"><span>{{ s.text }}</span><span class="flex-none font-semibold">{{ s.when }}</span></li>
        </ol>
        <div v-if="tel && settings?.phone" class="mt-10">
          <p v-if="block.callLabel" class="font-semibold">{{ block.callLabel }}</p>
          <a :href="tel" class="mt-1 inline-block font-display text-[48px] font-extrabold leading-none underline-offset-8 hover:underline sm:text-[60px]">{{ settings.phone }}</a>
          <p v-if="settings.hoursShort" class="mt-2 text-[16px]">{{ settings.hoursShort }}</p>
        </div>
      </div>
      <div class="rounded-[4px] bg-card p-6 text-ink sm:p-9 lg:col-span-7">
        <p v-if="form.sent.value" class="font-display text-[28px] font-bold leading-[1.1]" role="status">{{ form.successMessage.value }}</p>
        <form v-else-if="!form.unavailable.value" :ref="form.el" class="relative grid gap-4 sm:grid-cols-2" novalidate @submit.prevent="form.submit">
          <EnquiryFields :form="form" :block="block" label-class="flabel" />
          <div class="flex flex-wrap items-center gap-x-6 gap-y-3 sm:col-span-2">
            <button type="submit" class="btn btn-brand" :disabled="form.sending.value">{{ form.sending.value ? words.sending : form.submitLabel.value }} <UIcon name="i-lucide-arrow-right" class="size-[18px]" aria-hidden="true" /></button>
            <p v-if="block.consent" class="text-[14px] text-quiet">{{ block.consent }}</p>
          </div>
        </form>
      </div>
    </div>
  </section>
</template>
