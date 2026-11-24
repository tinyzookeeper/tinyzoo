<script setup lang="ts">
// Magazín's reply form: on the soft tint, white fields and two large toggle boxes, the day to
// reply by set large beside it.
import type { SiteForm } from '#imports'

const props = defineProps<{ block: BlockOf<'rsvp'>; first?: boolean; anchor?: string; form: SiteForm }>()
const { deadline, words } = await useWedding()
const form = props.form
</script>

<template>
  <section :id="anchor" class="bg-tint">
    <div class="wrap py-24 lg:py-36 grid lg:grid-cols-12 gap-x-10 gap-y-12 items-start">
      <div class="lg:col-span-4 lg:sticky lg:top-12">
        <p v-if="block.eyebrow" class="label text-brand">{{ block.eyebrow }}</p>
        <component :is="first ? 'h1' : 'h2'" class="h2 mt-5"><KitMarked :text="block.heading" /></component>
        <p v-if="block.text" class="mt-6 max-w-[26rem]">{{ tidyText(block.text) }}</p>
        <p v-if="deadline" class="mt-8 pt-6 border-t border-ink max-w-[26rem]"><span class="label text-quiet block">{{ words.replyUntilLabel }}</span><span class="serif text-ink text-[2.2rem] leading-tight block mt-1">{{ tidyText(deadline.date) }}</span></p>
      </div>

      <p v-if="form.sent.value" class="lg:col-span-7 lg:col-start-6 serif italic text-ink text-[1.6rem] leading-snug" role="status">{{ form.successMessage.value }}</p>
      <form v-else-if="!form.unavailable.value" :ref="form.el" class="relative lg:col-span-7 lg:col-start-6 grid sm:grid-cols-2 gap-x-6 gap-y-7" novalidate @submit.prevent="form.submit">
        <RsvpFields :form="form" :block="block" :full="['name', 'song', 'message']" choice-gap="gap-3 sm:gap-6" />
        <div class="sm:col-span-2 flex flex-wrap items-center gap-x-8 gap-y-4 mt-1">
          <button class="btn label max-sm:w-full" type="submit" :disabled="form.sending.value">{{ form.sending.value ? words.sending : form.submitLabel.value }}</button>
        </div>
      </form>
    </div>
  </section>
</template>
