<script setup lang="ts">
// Večer's reply form: the one light surface of the page, an ivory card with underlined fields,
// beside the heading and a candlelit photograph.
import type { SiteForm } from '#imports'

const props = defineProps<{ block: BlockOf<'rsvp'>; first?: boolean; anchor?: string; form: SiteForm }>()
const { deadline, words } = await useWedding()
const form = props.form
</script>

<template>
  <section :id="anchor" class="wrap py-24 lg:py-36">
    <div class="grid lg:grid-cols-12 gap-x-12 gap-y-12 items-start">
      <div class="lg:col-span-4 lg:sticky lg:top-10">
        <p v-if="block.eyebrow" class="label text-brand">{{ block.eyebrow }}</p>
        <component :is="first ? 'h1' : 'h2'" class="h2 mt-5"><KitMarked :text="block.heading" /></component>
        <p v-if="block.text" class="mt-6">{{ tidyText(block.text) }}</p>
        <figure v-if="block.image" class="zoom aspect-[4/5] mt-10 max-lg:hidden"><CmsImage :media="block.image" sizes="36rem" /></figure>
      </div>

      <div class="reply lg:col-span-7 lg:col-start-6 px-6 sm:px-12 lg:px-14 py-10 sm:py-14">
        <template v-if="deadline">
          <p class="label text-center">{{ words.replyUntil(deadline.date) }}</p>
          <span class="block w-12 h-px bg-card-ink/50 mx-auto mt-5" aria-hidden="true" />
        </template>
        <p v-if="form.sent.value" class="mt-9 text-center italic text-card-ink text-[1.2rem]" role="status">{{ form.successMessage.value }}</p>
        <form v-else-if="!form.unavailable.value" :ref="form.el" class="relative grid sm:grid-cols-2 gap-x-10 gap-y-8 mt-9" novalidate @submit.prevent="form.submit">
          <RsvpFields :form="form" :block="block" :full="['name', 'meal', 'allergies', 'song', 'message']" choice-gap="gap-3 sm:gap-5" />
          <div class="sm:col-span-2 text-center mt-1">
            <button class="btn btn-night label max-sm:w-full" type="submit" :disabled="form.sending.value">{{ form.sending.value ? words.sending : form.submitLabel.value }}</button>
          </div>
        </form>
      </div>
    </div>
  </section>
</template>
