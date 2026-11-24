<script setup lang="ts">
// Deka's sign-up: a navy block under a strip of the blanket, a few steps with colour swatches on
// the left, the form on the right. A class tapped in the timetable is chosen here already.
import type { SiteForm } from '#imports'

const props = defineProps<{ block: BlockOf<'signup'>; first?: boolean; anchor?: string; form: SiteForm; slots: Slot[] }>()
const { settings, words, tel } = await useStudio()
const form = props.form
// The swatches of the steps: the threads in turn, skipping one.
const stepThread = (i: number) => `th${[1, 3, 5, 2, 4][i % 5]}`
</script>

<template>
  <section :id="anchor" class="on-dark bg-ink text-paper">
    <div class="stripes" aria-hidden="true" />
    <div class="wrap py-16 md:py-24 grid lg:grid-cols-12 gap-x-12 gap-y-10">
      <div class="lg:col-span-5">
        <p v-if="block.eyebrow" class="eyebrow !text-paper mb-3">{{ block.eyebrow }}</p>
        <component :is="first ? 'h1' : 'h2'" class="h2 !text-paper"><KitMarked :text="block.heading" :attrs="{ class: 'font-medium text-brand' }" /></component>
        <p v-if="block.text" class="mt-5 opacity-90">{{ tidyText(block.text) }}</p>
        <ul v-if="block.steps.length" class="mt-7 space-y-3 text-[0.975rem]">
          <li v-for="(step, i) in block.steps" :key="step.id" class="flex gap-3.5"><span class="sw mt-1.5" :class="stepThread(i)" /><span>{{ tidyText(step.text) }}</span></li>
        </ul>
        <p v-if="block.phoneNote && settings?.phone" class="mt-8">{{ block.phoneNote }} <a class="font-semibold underline decoration-brand decoration-[1.5px] underline-offset-4 hover:text-brand" :href="tel">{{ settings.phone }}</a></p>
      </div>
      <p v-if="form.sent.value" class="lg:col-span-7 text-[1.15rem]" role="status">{{ form.successMessage.value }}</p>
      <form v-else-if="!form.unavailable.value" :ref="form.el" class="lg:col-span-7 grid sm:grid-cols-2 gap-5 content-start" novalidate @submit.prevent="submitTrial(form, words.consentNeeded)">
        <TrialFields :form="form" :block="block" :slots="slots" consent-class="text-[0.925rem] leading-snug" box-class="mt-0.5 w-5 h-5 accent-[var(--brand)]" />
        <div class="sm:col-span-2"><button class="btn btn-brand w-full sm:w-auto" type="submit" :disabled="form.sending.value">{{ form.sending.value ? words.sending : form.submitLabel.value }}</button></div>
      </form>
    </div>
  </section>
</template>
