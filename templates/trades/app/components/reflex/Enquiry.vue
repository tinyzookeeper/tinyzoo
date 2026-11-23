<script setup lang="ts">
// Reflex's enquiry: on a field of the signal colour, the heading and the phone number on the
// left, the form with heavy-bordered fields on the right.
import type { SiteForm } from '#imports'

const props = defineProps<{ block: BlockOf<'enquiry'>; first?: boolean; anchor?: string; form: SiteForm }>()
const { settings, phone, words } = await useTrades()
const form = props.form
const hours = computed(() => [settings.value?.hoursLine, settings.value?.emergency ? `${words.value.emergency.toLowerCase()} ${settings.value.emergency}` : ''].filter(Boolean).join(' · '))
</script>

<template>
  <section :id="anchor" class="on-brand bg-brand text-brand-ink scroll-mt-0">
    <div class="wrap pt-16 md:pt-24 pb-16 md:pb-24 grid lg:grid-cols-12 gap-x-12 gap-y-10">
      <div class="lg:col-span-5">
        <p v-if="block.eyebrow" class="label">{{ block.eyebrow }}</p>
        <component :is="first ? 'h1' : 'h2'" class="h2 mt-3 lg:!text-[6.4vw]"><KitMarked :text="block.heading" plain /></component>
        <p v-if="block.text" class="mt-6 text-[1.1875rem] leading-[1.4] font-medium max-w-[30rem]">{{ tidyText(block.text) }}</p>
        <div v-if="phone || settings?.email" class="mt-10 pt-6 border-t-2 border-current">
          <template v-if="phone">
            <p v-if="block.callLabel" class="label">{{ block.callLabel }}</p>
            <a :href="phone.href" class="inline-block font-cond font-black text-[4.25rem] max-[380px]:text-[4rem] md:text-[5.5rem] leading-[0.95] tabular-nums whitespace-nowrap underline decoration-transparent decoration-4 underline-offset-8 hover:decoration-current transition-colors">{{ phone.text }}</a>
            <p v-if="hours" class="mt-1 font-bold">{{ hours }}</p>
          </template>
          <a v-if="settings?.email" :href="`mailto:${settings.email}`" class="inline-flex items-center min-h-[44px] font-bold underline decoration-2 underline-offset-4 hover:decoration-4 break-all">{{ settings.email }}</a>
        </div>
      </div>

      <p v-if="form.sent.value" class="lg:col-span-7 text-[1.5rem] md:text-[2rem] leading-[1.2] font-black tracking-[-0.02em]" role="status">{{ form.successMessage.value }}</p>
      <form v-else-if="!form.unavailable.value" :ref="form.el" class="lg:col-span-7 grid sm:grid-cols-2 gap-x-4 gap-y-5 content-start" novalidate @submit.prevent="form.submit">
        <EnquiryFields :form="form" />
        <div class="sm:col-span-2 flex flex-col sm:flex-row sm:items-center gap-4 pt-1">
          <button type="submit" class="btn btn-ink !min-h-[64px] !px-8 !text-[1.1875rem]" style="--paper:#fff" :disabled="form.sending.value">{{ form.sending.value ? words.sending : form.submitLabel.value }} <UIcon name="i-lucide-arrow-right" class="size-[22px]" aria-hidden="true" /></button>
          <p v-if="block.note" class="text-[0.9375rem] font-medium max-w-[20rem]">{{ tidyText(block.note) }}</p>
        </div>
      </form>
    </div>
  </section>
</template>
