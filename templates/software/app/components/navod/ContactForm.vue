<script setup lang="ts">
// Návod's contact area: the heading and a line of text on the left, the form on the right, ruled
// off from what is above it. `bare` leaves out the space above, for a form that stands alone.
import type { SiteForm } from '#imports'

const props = defineProps<{ form: SiteForm; heading: string; text?: string | null; note?: string | null; anchor?: string; first?: boolean; bare?: boolean }>()
const words = useSiteWords()
const form = props.form
</script>

<template>
  <div :id="anchor" class="grid gap-8 border-t border-ink pt-10 lg:grid-cols-12 lg:gap-12" :class="bare ? '' : 'mt-16 lg:mt-20'">
    <div class="lg:col-span-4">
      <component :is="first ? 'h1' : 'h2'" class="text-[26px] font-semibold leading-[1.15] tracking-[-0.02em] text-ink lg:text-[30px]"><KitMarked :text="heading" /></component>
      <p v-if="text" class="mt-4 max-w-[26rem]">{{ tidyText(text) }}</p>
    </div>
    <p v-if="form.sent.value" class="bg-tint px-4 py-3 text-[15px] font-medium text-ink lg:col-span-8" role="status">{{ form.successMessage.value }}</p>
    <form v-else-if="!form.unavailable.value" :ref="form.el" class="grid gap-5 sm:grid-cols-2 lg:col-span-8" novalidate @submit.prevent="form.submit">
      <ContactFields :form="form" />
      <div class="flex flex-wrap items-center gap-x-6 gap-y-3 sm:col-span-2">
        <button type="submit" class="btn btn-main" :disabled="form.sending.value">{{ form.sending.value ? words.sending : form.submitLabel.value }}</button>
        <p v-if="note" class="text-[14px] text-quiet"><KitMarked :text="note" as="a" :attrs="{ class: 'link', href: words.privacyUrl }" /></p>
      </div>
    </form>
  </div>
</template>
