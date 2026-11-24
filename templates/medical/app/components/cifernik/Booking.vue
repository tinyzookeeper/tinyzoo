<script setup lang="ts">
// Ciferník's booking: three numbered steps (call, send a request, a first visit) and what to
// bring on a soft panel; the request form on a white card beside them.
import type { SiteForm } from '#imports'
import type { Insurer, OpeningHour } from '../../lib/cms-content'

const props = defineProps<{ block: BlockOf<'booking'>; first?: boolean; anchor?: string; form: SiteForm; insurers: Insurer[]; hours: OpeningHour[] }>()
const { settings, words, phoneHref, smsHref } = await useMedical()
const form = props.form
// The first visit's steps are one sentence here.
const firstVisit = computed(() => props.block.firstVisit.map((s) => s.text).join(' '))
</script>

<template>
  <section :id="anchor" class="wrap pt-16 lg:pt-24">
    <div class="rounded-[28px] lg:rounded-[40px] bg-soft p-5 sm:p-9 lg:p-12 grid gap-10 lg:grid-cols-[1fr_1.05fr] lg:gap-14">
      <div>
        <component :is="first ? 'h1' : 'h2'" class="text-[2.5rem] sm:text-[3.2rem] lg:text-[3.6rem]"><KitMarked :text="block.heading" plain /></component>
        <ol class="mt-8 grid gap-7">
          <li v-if="settings?.phone && phoneHref" class="grid grid-cols-[3.4rem_1fr] gap-4">
            <span class="grid place-items-center size-[3.4rem] rounded-full bg-brand text-brand-ink disp !text-brand-ink text-[1.6rem] font-medium">1</span>
            <div>
              <h3 class="text-[1.5rem]">{{ words.callUs }}</h3>
              <a :href="phoneHref" class="disp mt-1 inline-flex min-h-11 items-center text-[2.3rem] sm:text-[2.7rem] font-medium num underline decoration-[3px] decoration-brand/40 underline-offset-[7px] hover:decoration-brand">{{ settings.phone }}</a>
              <p class="mt-1">{{ tidyText(settings.phoneNote) }}<template v-if="settings.smsPhone && smsHref">{{ ' ' }}{{ words.smsLabel }} <a :href="smsHref" class="num font-bold text-ink underline underline-offset-4 whitespace-nowrap">{{ settings.smsPhone }}</a>.</template></p>
            </div>
          </li>
          <li class="grid grid-cols-[3.4rem_1fr] gap-4">
            <span class="grid place-items-center size-[3.4rem] rounded-full bg-brand text-brand-ink disp !text-brand-ink text-[1.6rem] font-medium">{{ settings?.phone && phoneHref ? 2 : 1 }}</span>
            <div>
              <h3 class="text-[1.5rem]">{{ words.orSendRequest }}</h3>
              <p class="mt-1">{{ words.requestStep }}</p>
            </div>
          </li>
          <li v-if="firstVisit" class="grid grid-cols-[3.4rem_1fr] gap-4">
            <span class="grid place-items-center size-[3.4rem] rounded-full bg-brand text-brand-ink disp !text-brand-ink text-[1.6rem] font-medium">{{ settings?.phone && phoneHref ? 3 : 2 }}</span>
            <div>
              <h3 class="text-[1.5rem]">{{ words.firstVisit }}</h3>
              <p class="mt-1">{{ tidyText(firstVisit) }}</p>
            </div>
          </li>
        </ol>
        <div v-if="block.bring.length" class="mt-8 panel p-6">
          <h3 class="text-[1.3rem]">{{ words.bring }}</h3>
          <ul class="mt-3 flex flex-wrap gap-2 text-ink font-semibold text-[.97rem]">
            <li v-for="item in block.bring" :key="item.id" class="rounded-full bg-paper px-3.5 py-2">{{ item.text }}</li>
          </ul>
        </div>
      </div>

      <div v-if="!form.unavailable.value" class="panel p-6 sm:p-9 self-start">
        <h3 class="text-[1.9rem]">{{ words.requestTitle }}</h3>
        <p v-if="form.sent.value" class="mt-5 rounded-2xl bg-soft p-4 text-ink font-bold" role="status">{{ form.successMessage.value }}</p>
        <form v-else :ref="form.el" novalidate @submit.prevent="form.submit">
          <p v-if="block.formText" class="mt-2"><KitMarked :text="block.formText" as="strong" :attrs="{ class: 'text-ink' }" /></p>
          <AppointmentFields :form="form" :block="block" :insurers="insurers" :hours="hours" />
          <button class="btn btn-brand mt-7 w-full sm:w-auto" type="submit" :disabled="form.sending.value">{{ form.sending.value ? words.sending : form.submitLabel.value }} <UIcon name="i-lucide-arrow-right" class="ic" aria-hidden="true" /></button>
        </form>
      </div>
    </div>
  </section>
</template>
