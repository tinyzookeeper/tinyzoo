<script setup lang="ts">
// Talíř's reservation: on the brand colour, a heading, the phone as large type, and the form in
// boxes with a hard shadow.
import type { SiteForm } from '#imports'

const props = defineProps<{ block: BlockOf<'reservation'>; first?: boolean; anchor?: string; form: SiteForm }>()
const { phone, tel, words } = await useRestaurant()
const form = props.form
</script>

<template>
  <section :id="anchor" class="on-brand bg-brand text-brand-ink border-t-2 border-ink scroll-mt-0">
    <div class="wrap py-16 lg:py-24 grid lg:grid-cols-12 gap-x-12 gap-y-10">
      <div class="lg:col-span-5">
        <component :is="first ? 'h1' : 'h2'" class="wide text-[2.9rem] lg:text-[5rem]"><KitMarked :text="block.heading" plain /></component>
        <p v-if="block.text" class="mt-6 max-w-[27rem] text-[1.15rem] font-medium">{{ tidyText(block.text) }}</p>
        <template v-if="phone">
          <p class="mt-7 num text-[2.6rem] lg:text-[3.4rem]"><a class="ulink" :href="tel">{{ phone }}</a></p>
          <p v-if="block.phoneLabel" class="cap mt-2">{{ block.phoneLabel }}</p>
        </template>
      </div>
      <p v-if="form.sent.value" class="lg:col-span-7 num text-[1.8rem] leading-tight" role="status">{{ form.successMessage.value }}</p>
      <form v-else-if="!form.unavailable.value" :ref="form.el" class="lg:col-span-7 relative grid sm:grid-cols-6 gap-x-5 gap-y-5 content-start" novalidate @submit.prevent="form.submit">
        <ReservationFields :form="form" :block="block" />
        <div class="sm:col-span-6 flex flex-wrap items-center gap-x-6 gap-y-4 mt-1">
          <button class="btn btn-solid w-full sm:w-auto !px-9 cursor-pointer" type="submit" :disabled="form.sending.value">{{ form.sending.value ? words.sending : form.submitLabel.value }} <UIcon name="i-lucide-arrow-right" aria-hidden="true" /></button>
          <p v-if="block.note" class="text-[.98rem] max-w-[22rem]">{{ tidyText(block.note) }}</p>
        </div>
      </form>
    </div>
  </section>
</template>
