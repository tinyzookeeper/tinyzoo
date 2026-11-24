<script setup lang="ts">
// Oznámení's reply form: a double-framed card on the tinted ground, underlined fields.
import type { SiteForm } from '#imports'

const props = defineProps<{ block: BlockOf<'rsvp'>; first?: boolean; anchor?: string; form: SiteForm }>()
const words = useSiteWords()
const form = props.form
</script>

<template>
  <section :id="anchor" class="bg-tint">
    <div class="wrap py-20 lg:py-28">
      <div class="max-w-[52rem] mx-auto bg-card border border-line p-2">
        <div class="border border-line px-6 sm:px-12 lg:px-16 py-12 lg:py-16">
          <div class="text-center">
            <p v-if="block.eyebrow" class="label text-brand">{{ block.eyebrow }}</p>
            <component :is="first ? 'h1' : 'h2'" class="text-[2.6rem] lg:text-[3.4rem] leading-[1.08] mt-4"><KitMarked :text="block.heading" plain /></component>
            <p v-if="block.text" class="mt-4 italic">{{ tidyText(block.text) }}</p>
          </div>

          <p v-if="form.sent.value" class="mt-12 text-center italic text-ink text-[1.15rem]" role="status">{{ form.successMessage.value }}</p>
          <form v-else-if="!form.unavailable.value" :ref="form.el" class="relative grid sm:grid-cols-2 gap-x-10 gap-y-7 mt-12" novalidate @submit.prevent="form.submit">
            <RsvpFields :form="form" :block="block" :full="['name', 'song', 'message']" choice-gap="gap-4" />
            <div class="sm:col-span-2 text-center mt-2">
              <button class="btn label" type="submit" :disabled="form.sending.value">{{ form.sending.value ? words.sending : form.submitLabel.value }}</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  </section>
</template>
