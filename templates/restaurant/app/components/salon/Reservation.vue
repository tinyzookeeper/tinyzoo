<script setup lang="ts">
// Salon's reservation: a cream card with the words and the phone beside the form, underlined
// fields like a card that is filled in.
import type { SiteForm } from '#imports'

const props = defineProps<{ block: BlockOf<'reservation'>; first?: boolean; anchor?: string; form: SiteForm }>()
const { phone, tel, words } = await useRestaurant()
const form = props.form
</script>

<template>
  <section :id="anchor" class="wrap pb-20 lg:pb-24 scroll-mt-6">
    <div class="sheet px-6 py-12 sm:px-12 sm:py-16 lg:px-20 lg:py-20 grid lg:grid-cols-12 gap-12 lg:gap-16">
      <div class="lg:col-span-5">
        <p v-if="block.eyebrow" class="label ink-muted">{{ block.eyebrow }}</p>
        <component :is="first ? 'h1' : 'h2'" class="mt-5 font-display font-medium text-[2.6rem] lg:text-[3.6rem] leading-[1.03] tracking-[-.015em]"><KitMarked :text="block.heading" :attrs="{ class: 'font-normal' }" /></component>
        <p v-if="block.text" class="mt-6 max-w-[26rem]">{{ tidyText(block.text) }}</p>
        <template v-if="phone">
          <p v-if="block.phoneLabel" class="mt-8 label ink-muted">{{ block.phoneLabel }}</p>
          <p class="mt-2 font-display text-[2.2rem] leading-tight"><a class="link" :href="tel">{{ phone }}</a></p>
        </template>
        <p v-if="block.note" class="mt-8 text-[.98rem] ink-muted max-w-[26rem]">{{ tidyText(block.note) }}</p>
      </div>
      <p v-if="form.sent.value" class="lg:col-span-7 font-display italic text-[1.5rem] leading-snug" role="status">{{ form.successMessage.value }}</p>
      <form v-else-if="!form.unavailable.value" :ref="form.el" class="lg:col-span-7 relative grid sm:grid-cols-6 gap-x-8 gap-y-7" novalidate @submit.prevent="form.submit">
        <ReservationFields :form="form" :block="block" />
        <div class="sm:col-span-6 flex flex-wrap items-center gap-x-8 gap-y-4">
          <button class="btn btn-ink w-full sm:w-auto cursor-pointer" type="submit" :disabled="form.sending.value">{{ form.sending.value ? words.sending : form.submitLabel.value }}</button>
          <p v-if="block.formNote" class="text-[.98rem] ink-muted">{{ tidyText(block.formNote) }}</p>
        </div>
      </form>
    </div>
  </section>
</template>
