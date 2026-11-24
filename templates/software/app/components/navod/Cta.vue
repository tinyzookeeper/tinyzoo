<script setup lang="ts">
// Návod's closing call: a dark strip with the heading and one field for an e-mail address.
import type { SiteForm } from '#imports'

const props = defineProps<{ block: BlockOf<'cta'>; first?: boolean; anchor?: string; form: SiteForm }>()
const words = useSiteWords()
const form = props.form
</script>

<template>
  <section :id="anchor" class="border-t border-ink bg-ink text-sheet">
    <div class="wrap grid gap-8 py-16 lg:grid-cols-12 lg:items-end lg:gap-12 lg:py-20">
      <div class="lg:col-span-7">
        <p v-if="block.eyebrow" class="label text-sheet/70">{{ tidyText(block.eyebrow) }}</p>
        <component :is="first ? 'h1' : 'h2'" class="mt-5 text-[34px] font-semibold leading-[1.06] tracking-[-0.03em] sm:text-[44px] lg:text-[52px]"><KitMarked :text="block.heading" /></component>
      </div>
      <div class="lg:col-span-5">
        <p v-if="form.sent.value" class="bg-sheet/10 px-4 py-3 text-[15px] font-medium" role="status">{{ form.successMessage.value }}</p>
        <form v-else-if="!form.unavailable.value" :ref="form.el" class="flex flex-col gap-3 sm:flex-row" novalidate @submit.prevent="form.submit">
          <label class="sr-only" :for="form.id('email')">{{ words.emailLabel }}</label>
          <input :id="form.id('email')" v-model="form.values.email" type="email" name="email" required autocomplete="email" :placeholder="words.emailPlaceholder" :aria-invalid="!!form.errors.email" class="h-[52px] min-w-0 flex-1 border border-sheet/40 bg-transparent px-4 text-[16px] text-sheet placeholder:text-sheet/60 focus:border-sheet">
          <button type="submit" class="btn h-[52px] bg-sheet text-ink hover:bg-brand hover:text-brand-ink" :disabled="form.sending.value">{{ form.sending.value ? words.sending : block.buttonLabel }} <UIcon name="i-lucide-arrow-right" class="size-[18px]" aria-hidden="true" /></button>
          <KitFormExtras :form="form" />
        </form>
        <p v-if="form.errors.email || form.failure.value" class="mt-3 text-[15px] text-sheet" role="alert">{{ form.errors.email || form.failure.value }}</p>
        <p v-if="block.text" class="mt-4 text-[15px] leading-[1.55] text-sheet/75"><KitMarked :text="block.text" as="b" :attrs="{ class: 'font-semibold' }" /></p>
      </div>
    </div>
  </section>
</template>
