<script setup lang="ts">
// One Day's contact form: a light card with its heading on top and the small print beside the
// button.
import type { SiteForm } from '#imports'

const props = defineProps<{ form: SiteForm; heading: string; text?: string | null; note?: string | null; first?: boolean; anchor?: string }>()
const words = useSiteWords()
const form = props.form
</script>

<template>
  <div :id="anchor" class="card grid gap-4 p-6 sm:grid-cols-2 lg:p-8">
    <component :is="first ? 'h1' : 'h2'" class="font-display text-[24px] font-semibold leading-tight sm:col-span-2"><KitMarked :text="heading" /></component>
    <p v-if="text" class="-mt-2 sm:col-span-2">{{ tidyText(text) }}</p>
    <p v-if="form.sent.value" class="rounded-[10px] bg-am px-4 py-3 text-[15px] font-medium sm:col-span-2" role="status">{{ form.successMessage.value }}</p>
    <form v-else-if="!form.unavailable.value" :ref="form.el" class="contents" novalidate @submit.prevent="form.submit">
      <ContactFields :form="form" :rows="3" />
      <div class="flex flex-wrap items-center gap-x-5 gap-y-3 sm:col-span-2">
        <button type="submit" class="btn btn-brand" :disabled="form.sending.value">{{ form.sending.value ? words.sending : form.submitLabel.value }}</button>
        <p v-if="note" class="text-[14px] opacity-75"><KitMarked :text="note" as="a" :attrs="{ class: 'ul', href: words.privacyUrl }" /></p>
      </div>
    </form>
  </div>
</template>
