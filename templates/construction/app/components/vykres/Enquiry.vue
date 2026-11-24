<script setup lang="ts">
// Výkres's enquiry: one framed card in two parts divided by a heavy rule: what happens next and
// the phone on the left, the form with square fields on the right.
import type { SiteForm } from '#imports'

const props = defineProps<{ block: BlockOf<'enquiry'>; first?: boolean; anchor?: string; form: SiteForm }>()
const { settings, words, tel } = await useFirm()
const form = props.form
</script>

<template>
  <section :id="anchor" class="wrap scroll-mt-24 pt-16 lg:pt-24">
    <div class="grid border-2 border-ink bg-card lg:grid-cols-12">
      <div class="border-b-2 border-ink p-6 sm:p-10 lg:col-span-5 lg:border-b-0 lg:border-r-2">
        <p v-if="block.eyebrow" class="lab">{{ block.eyebrow }}</p>
        <component :is="first ? 'h1' : 'h2'" class="mt-4 font-display text-[32px] font-light leading-[1.1] tracking-[-.02em] text-ink sm:text-[42px]"><KitMarked :text="block.heading" as="span" /></component>
        <p v-if="block.text" class="mt-6 leading-[1.65]">{{ tidyText(block.text) }}</p>
        <ol v-if="block.steps.length" class="mt-8 border-t border-ink text-[15px]">
          <li v-for="(s, i) in block.steps" :key="i" class="flex items-baseline justify-between gap-6 py-3" :class="i === block.steps.length - 1 ? 'border-b border-ink' : 'border-b border-hair'"><span class="text-ink">{{ s.text }}</span><span class="lab flex-none">{{ s.when }}</span></li>
        </ol>
        <div v-if="tel && settings?.phone" class="mt-8">
          <p v-if="block.callLabel" class="lab">{{ block.callLabel }}</p>
          <a :href="tel" class="mt-2 inline-block font-display text-[34px] font-light tracking-[-.02em] text-ink hover:text-brand sm:text-[40px]">{{ settings.phone }}</a>
          <p v-if="settings.hoursShort" class="mt-1 text-[15px] text-quiet">{{ settings.hoursShort }}</p>
        </div>
      </div>
      <div class="p-6 sm:p-10 lg:col-span-7">
        <p v-if="form.sent.value" class="font-display text-[22px] font-light leading-snug text-ink" role="status">{{ form.successMessage.value }}</p>
        <form v-else-if="!form.unavailable.value" :ref="form.el" class="relative grid gap-5 sm:grid-cols-2" novalidate @submit.prevent="form.submit">
          <EnquiryFields :form="form" :block="block" label-class="lab mb-2 block" />
          <div class="flex flex-wrap items-center gap-x-6 gap-y-3 sm:col-span-2">
            <button type="submit" class="btn btn-ink" :disabled="form.sending.value">{{ form.sending.value ? words.sending : form.submitLabel.value }} <UIcon name="i-lucide-arrow-right" class="size-[18px]" aria-hidden="true" /></button>
            <p v-if="block.consent" class="text-sm text-quiet">{{ block.consent }}</p>
          </div>
        </form>
      </div>
    </div>
  </section>
</template>
