<script setup lang="ts">
// One Day's closing call, 22:00: on the night, the heading and one field for an e-mail address with
// the lamp-coloured button.
import type { SiteForm } from '#imports'

const props = defineProps<{ block: BlockOf<'cta'>; first?: boolean; anchor?: string; form: SiteForm }>()
const words = useSiteWords()
const form = props.form
</script>

<template>
  <section :id="anchor" class="dark-band bg-night text-cream">
    <div class="wrap lg:grid lg:grid-cols-[150px_1fr]">
      <JedenDenRail class="pt-12 lg:pt-24" :time="block.time" :note="block.timeNote" />
      <div class="pb-16 pt-6 lg:pb-28 lg:pl-14 lg:pt-24">
        <p v-if="block.eyebrow" class="time mb-4 opacity-80">{{ tidyText(block.eyebrow) }}</p>
        <component :is="first ? 'h1' : 'h2'" class="h2 max-w-[17ch] text-[40px] sm:text-[56px] lg:text-[68px]"><KitMarked :text="block.heading" /></component>
        <div class="mt-8 grid gap-6 lg:grid-cols-12 lg:items-start lg:gap-10">
          <div class="lg:col-span-7">
            <p v-if="form.sent.value" class="rounded-[12px] bg-cream/10 px-5 py-4 text-[16px]" role="status">{{ form.successMessage.value }}</p>
            <form v-else-if="!form.unavailable.value" :ref="form.el" class="flex flex-col gap-3 sm:flex-row" novalidate @submit.prevent="form.submit">
              <label class="sr-only" :for="form.id('email')">{{ words.emailLabel }}</label>
              <input :id="form.id('email')" v-model="form.values.email" type="email" name="email" required autocomplete="email" :placeholder="words.emailPlaceholder" :aria-invalid="!!form.errors.email" class="h-[54px] min-w-0 flex-1 rounded-[12px] bg-cream/10 px-5 text-[17px] text-cream shadow-[inset_0_0_0_1.5px_rgb(251_241_220/.45)] placeholder:text-cream/65 focus:shadow-[inset_0_0_0_2px_var(--lamp)] focus:outline-none">
              <button type="submit" class="btn btn-lamp !min-h-[54px]" :disabled="form.sending.value">{{ form.sending.value ? words.sending : tidyText(block.buttonLabel) }} <UIcon name="i-lucide-arrow-right" class="size-[19px]" aria-hidden="true" /></button>
              <KitFormExtras :form="form" />
            </form>
            <p v-if="form.errors.email || form.failure.value" class="mt-3 text-[15px]" role="alert">{{ form.errors.email || form.failure.value }}</p>
          </div>
          <p v-if="block.text" class="text-[16px] opacity-90 lg:col-span-5"><KitMarked :text="block.text" as="b" :attrs="{ class: 'font-semibold' }" /></p>
        </div>
      </div>
    </div>
  </section>
</template>
