<script setup lang="ts">
// Paragon's reservation: the words and the phone beside a form printed on a sheet, dotted lines
// to write on, and a red stamp that says it is confirmed by text message.
import type { SiteForm } from '#imports'

const props = defineProps<{ block: BlockOf<'reservation'>; first?: boolean; anchor?: string; form: SiteForm }>()
const { name, address, phone, tel, words } = await useRestaurant()
const w = computed(() => words.value.paragon)
const form = props.form
</script>

<template>
  <section :id="anchor" class="wrap pb-16 lg:pb-28 scroll-mt-4">
    <div class="grid lg:grid-cols-12 gap-x-10 gap-y-9 items-start">
      <div class="lg:col-span-4 lg:pt-8">
        <component :is="first ? 'h1' : 'h2'" class="h text-[2.7rem] sm:text-[3.6rem] lg:text-[4.2rem]"><KitMarked :text="block.heading" plain /></component>
        <p v-if="block.text" class="mt-6 max-w-[24rem]">{{ tidyText(block.text) }}</p>
        <template v-if="phone">
          <p v-if="block.phoneLabel" class="mt-7 print">{{ block.phoneLabel }}</p>
          <p class="h mt-2 text-[2.3rem] sm:text-[2.6rem]"><a class="tlink" :href="tel">{{ phone }}</a></p>
        </template>
        <p v-if="block.note" class="mt-7 max-w-[24rem] text-[.95rem]">{{ tidyText(block.note) }}</p>
      </div>
      <p v-if="form.sent.value" class="lg:col-span-8 sheet px-5 pt-9 pb-7 sm:px-10 sm:pt-12 sm:pb-10 h text-[1.7rem] sm:text-[2rem] !leading-tight" role="status">{{ form.successMessage.value }}</p>
      <form v-else-if="!form.unavailable.value" :ref="form.el" class="lg:col-span-8 sheet px-5 pt-9 pb-7 sm:px-10 sm:pt-12 sm:pb-10" novalidate @submit.prevent="form.submit">
        <div class="flex flex-wrap items-end justify-between gap-x-6 gap-y-2 pb-4 border-b-[3px] border-double border-ink">
          <p class="h text-[1.7rem] sm:text-[2rem]">{{ w.ticket }}</p>
          <p class="text-[.92rem]">{{ name }}<template v-if="address">, {{ address }}</template></p>
        </div>
        <div class="relative mt-7 grid sm:grid-cols-6 gap-x-8 gap-y-6">
          <ReservationFields :form="form" :block="block" />
        </div>
        <div class="mt-8 flex flex-wrap items-center justify-between gap-x-8 gap-y-5">
          <button class="btn w-full sm:w-auto cursor-pointer" type="submit" :disabled="form.sending.value">{{ form.sending.value ? words.sending : form.submitLabel.value }}</button>
          <p class="stamp !rotate-[-4deg]">{{ w.confirmed }}</p>
        </div>
      </form>
    </div>
  </section>
</template>
