<script setup lang="ts">
// Tabule's sign-up: a block in the colour of the site, the numbered steps on the left, the form
// on the right with outlined fields. A class tapped in the timetable is chosen here already.
import type { SiteForm } from '#imports'

const props = defineProps<{ block: BlockOf<'signup'>; first?: boolean; anchor?: string; form: SiteForm; slots: Slot[] }>()
const { settings, words, tel } = await useStudio()
const form = props.form
</script>

<template>
  <section :id="anchor" class="on-brand bg-brand text-brand-ink">
    <div class="wrap py-16 lg:py-24 grid lg:grid-cols-12 gap-x-10 gap-y-10">
      <div class="lg:col-span-6">
        <p v-if="block.eyebrow" class="mono">{{ block.eyebrow }}</p>
        <component :is="first ? 'h1' : 'h2'" class="h2 h2s mt-4"><KitMarked :text="block.heading" plain /></component>
        <p v-if="block.text" class="mt-7 max-w-[28rem] text-[1.15rem]">{{ tidyText(block.text) }}</p>
        <ol v-if="block.steps.length" class="mono mt-8 max-w-[30rem]">
          <li v-for="(step, i) in block.steps" :key="step.id" class="flex gap-5 py-3 border-brand-ink" :class="i === block.steps.length - 1 ? 'border-y-2' : 'border-t-2'"><span>{{ String(i + 1).padStart(2, '0') }}</span><span>{{ tidyText(step.text) }}</span></li>
        </ol>
      </div>
      <p v-if="form.sent.value" class="lg:col-span-6 lg:pt-9 text-[1.15rem]" role="status">{{ form.successMessage.value }}</p>
      <form v-else-if="!form.unavailable.value" :ref="form.el" class="lg:col-span-6 grid sm:grid-cols-2 gap-5 content-start lg:pt-9" novalidate @submit.prevent="submitTrial(form, words.consentNeeded)">
        <TrialFields :form="form" :block="block" :slots="slots" :full="['lesson', 'date']" consent-class="text-[0.95rem] leading-snug" box-class="mt-0.5 w-5 h-5 accent-[var(--accent)]" />
        <button class="btn sm:col-span-2 !min-h-[64px] !text-[1.15rem]" type="submit" :disabled="form.sending.value">{{ form.sending.value ? words.sending : form.submitLabel.value }} <UIcon name="i-lucide-arrow-right" class="ico size-[1em]" aria-hidden="true" /></button>
        <p v-if="block.phoneNote && settings?.phone" class="mono sm:col-span-2">{{ block.phoneNote }} <a class="ulink !min-h-0" :href="tel">{{ settings.phone }}</a></p>
      </form>
    </div>
  </section>
</template>
