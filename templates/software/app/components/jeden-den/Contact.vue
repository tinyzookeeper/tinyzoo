<script setup lang="ts">
// One Day's contact block: only the form card, on a page of its own.
import type { SiteForm } from '#imports'

defineProps<{ block: BlockOf<'contact'>; first?: boolean; anchor?: string; form: SiteForm }>()
</script>

<template>
  <section class="bg-morning">
    <div class="wrap lg:grid lg:grid-cols-[150px_1fr]">
      <JedenDenRail class="pt-12 lg:pt-24" :time="block.time" :note="block.timeNote" />
      <div class="pb-16 pt-6 lg:pb-28 lg:pl-14 lg:pt-24">
        <p v-if="block.eyebrow" class="time mb-3 text-brand">{{ block.eyebrow }}</p>
        <JedenDenContactForm :anchor="anchor" :form="form" :heading="block.heading" :text="block.text" :note="block.note" :first="first" class="max-w-[48rem]" />
      </div>
    </div>
  </section>
</template>
