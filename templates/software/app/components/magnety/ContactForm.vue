<script setup lang="ts">
// Magnets' contact form: a dark tile with a question as its heading, underlined by nothing but
// a rounded outline. It leaves out the question about the number of people.
import type { SiteForm } from '#imports'

const props = defineProps<{ form: SiteForm; heading: string; eyebrow?: string | null; text?: string | null; first?: boolean; anchor?: string }>()
const words = useSiteWords()
const form = props.form
const size = computed(() => byLength(props.heading, [[28, 'text-[36px] lg:text-[44px]']], 'text-[28px] lg:text-[34px]'))
</script>

<template>
  <div :id="anchor" class="on-dark tile grid content-start gap-4 bg-ink p-6 text-cream sm:grid-cols-2 lg:p-10">
    <div class="sm:col-span-2">
      <p v-if="eyebrow" class="mono">{{ eyebrow }}</p>
      <component :is="first ? 'h1' : 'h2'" class="q mt-3" :class="size"><KitMarked :text="heading" /></component>
      <p v-if="text" class="mt-3 max-w-[32rem] opacity-90">{{ tidyText(text) }}</p>
    </div>
    <p v-if="form.sent.value" class="rounded-xl bg-cream/15 px-4 py-3 text-[15px] sm:col-span-2" role="status">{{ form.successMessage.value }}</p>
    <form v-else-if="!form.unavailable.value" :ref="form.el" class="contents" novalidate @submit.prevent="form.submit">
      <ContactFields :form="form" :skip="['people']" :rows="3" />
      <div class="flex flex-wrap items-center gap-4 sm:col-span-2"><button type="submit" class="btn btn-cream !min-h-[50px] !text-[17px]" :disabled="form.sending.value">{{ form.sending.value ? words.sending : form.submitLabel.value }}</button></div>
    </form>
  </div>
</template>
