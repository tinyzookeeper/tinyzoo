<script setup lang="ts">
// Sál's sign-up: a card in the colour of the site, the steps of the day on the left, a white
// card with the form on the right. A class tapped in the timetable is chosen here already.
import type { SiteForm } from '#imports'

const props = defineProps<{ block: BlockOf<'signup'>; first?: boolean; anchor?: string; form: SiteForm; slots: Slot[] }>()
const { settings, words, tel } = await useStudio()
const form = props.form
</script>

<template>
  <section :id="anchor" class="wrap pb-16 md:pb-24">
    <div class="grid lg:grid-cols-12 gap-x-12 gap-y-10 p-6 sm:p-10 lg:p-16 rounded-[2rem] bg-brand text-brand-ink">
      <div class="lg:col-span-5">
        <p v-if="block.eyebrow" class="text-[0.75rem] font-semibold tracking-[0.14em] uppercase opacity-80">{{ block.eyebrow }}</p>
        <component :is="first ? 'h1' : 'h2'" class="h2 mt-3 !text-brand-ink"><KitMarked :text="block.heading" plain /></component>
        <p v-if="block.text" class="mt-5 opacity-90">{{ tidyText(block.text) }}</p>
        <ol v-if="block.steps.length" class="mt-8 space-y-4 text-[0.975rem]">
          <li v-for="(step, i) in block.steps" :key="step.id" class="flex gap-4"><span class="font-display text-[1.5rem] leading-none flex-none w-5">{{ i + 1 }}</span><span>{{ tidyText(step.text) }}</span></li>
        </ol>
      </div>
      <p v-if="form.sent.value" class="lg:col-span-7 p-6 sm:p-8 rounded-3xl bg-card text-body self-start" role="status">{{ form.successMessage.value }}</p>
      <form v-else-if="!form.unavailable.value" :ref="form.el" class="lg:col-span-7 grid sm:grid-cols-2 gap-5 p-6 sm:p-8 rounded-3xl bg-card text-body" novalidate @submit.prevent="submitTrial(form, words.consentNeeded)">
        <TrialFields :form="form" :block="block" :slots="slots" consent-class="text-[0.9rem] leading-snug" box-class="mt-0.5 w-5 h-5 accent-[var(--brand)]" />
        <div class="sm:col-span-2 flex flex-wrap items-center justify-between gap-4">
          <button class="btn" type="submit" :disabled="form.sending.value">{{ form.sending.value ? words.sending : form.submitLabel.value }}</button>
          <p v-if="block.phoneNote && settings?.phone" class="text-[0.9rem] text-quiet">{{ block.phoneNote }} <a class="text-ink font-semibold" :href="tel">{{ settings.phone }}</a></p>
        </div>
      </form>
    </div>
  </section>
</template>
