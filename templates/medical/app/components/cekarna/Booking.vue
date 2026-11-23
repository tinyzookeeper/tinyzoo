<script setup lang="ts">
// Čekárna's booking: the phone number as a headline, what a first visit looks like and what to
// bring on the left; the request form on a soft panel on the right.
import type { SiteForm } from '#imports'
import type { Insurer, OpeningHour } from '~/lib/cms-content'

const props = defineProps<{ block: BlockOf<'booking'>; first?: boolean; anchor?: string; form: SiteForm; insurers: Insurer[]; hours: OpeningHour[] }>()
const { settings, words, phoneHref, smsHref } = await useMedical()
const form = props.form
</script>

<template>
  <section :id="anchor" class="wrap pt-20 lg:pt-28">
    <div class="grid gap-12 lg:gap-20 lg:grid-cols-[1fr_1.05fr]">
      <div>
        <p v-if="block.eyebrow" class="kicker">{{ block.eyebrow }}</p>
        <component :is="first ? 'h1' : 'h2'" class="mt-2 text-[2.5rem] sm:text-[3rem] lg:text-[3.5rem]"><KitMarked :text="block.heading" plain /></component>

        <div v-if="settings?.phone && phoneHref" class="mt-9">
          <h3 class="text-[1.3rem]">{{ words.byPhone }}</h3>
          <a :href="phoneHref" class="mt-2 inline-flex min-h-11 items-center font-display font-semibold tracking-[-0.02em] text-[2.4rem] sm:text-[2.8rem] leading-none text-brand hover:text-ink transition-colors">{{ settings.phone }}</a>
          <p v-if="settings.phoneNote" class="mt-3 max-w-[30rem]">{{ tidyText(settings.phoneNote) }}</p>
          <p v-if="settings.smsPhone && smsHref" class="mt-2">{{ words.smsLabel }} <a class="num text-ink font-semibold underline underline-offset-4 decoration-line decoration-2 hover:decoration-brand whitespace-nowrap" :href="smsHref">{{ settings.smsPhone }}</a></p>
        </div>

        <div v-if="block.firstVisit.length" class="mt-11">
          <h3 class="text-[1.3rem]">{{ words.firstVisit }}</h3>
          <ol class="mt-4 grid gap-4 max-w-[31rem]">
            <li v-for="(step, i) in block.firstVisit" :key="step.id" class="flex gap-4"><span class="num grid place-items-center size-8 shrink-0 rounded-full bg-brand-tint text-brand font-semibold text-[.95rem]">{{ i + 1 }}</span><span>{{ tidyText(step.text) }}</span></li>
          </ol>
        </div>

        <div v-if="block.bring.length" class="mt-11">
          <h3 class="text-[1.3rem]">{{ words.bring }}</h3>
          <ul class="mt-4 grid gap-x-10 gap-y-2.5 sm:grid-cols-2">
            <li v-for="item in block.bring" :key="item.id" class="flex gap-3"><UIcon name="i-lucide-check" class="ic text-brand mt-[.35rem] shrink-0" aria-hidden="true" />{{ tidyText(item.text) }}</li>
          </ul>
        </div>
      </div>

      <div v-if="!form.unavailable.value" class="bg-tint rounded-[24px] lg:rounded-[28px] p-6 sm:p-9 lg:p-11 self-start">
        <h3 class="text-[1.8rem]">{{ words.requestTitle }}</h3>
        <p v-if="form.sent.value" class="mt-4 rounded-xl bg-brand-tint p-4 text-ink font-semibold" role="status">{{ form.successMessage.value }}</p>
        <form v-else :ref="form.el" novalidate @submit.prevent="form.submit">
          <p v-if="block.formText" class="mt-3"><KitMarked :text="block.formText" as="strong" :attrs="{ class: 'text-ink' }" /></p>
          <AppointmentFields :form="form" :block="block" :insurers="insurers" :hours="hours" />
          <button class="btn btn-brand mt-7 w-full sm:w-auto" type="submit" :disabled="form.sending.value">{{ form.sending.value ? words.sending : form.submitLabel.value }} <UIcon name="i-lucide-arrow-right" class="ic" aria-hidden="true" /></button>
        </form>
      </div>
    </div>
  </section>
</template>
