<script setup lang="ts">
// Rozsvíceno's seller section: a slab of the lamp colour with rounded corners and a margin
// round it, as if one window of the street were lit. The steps as four rounded tiles; the
// price-estimate form in the dark beside them.
const props = defineProps<{ block: BlockOf<'sellers'>; first?: boolean; anchor?: string; formAnchor?: string; form: SiteForm }>()
const words = useSiteWords()
const w = words.value.rozsviceno
const form = props.form
</script>

<template>
  <section :id="anchor" class="on-lamp mt-20 md:mt-32 mx-2 md:mx-5 rounded-[2rem] md:rounded-[3rem] bg-lamp text-lamp-ink">
    <div class="wrap py-14 md:py-24 grid lg:grid-cols-12 gap-x-12 gap-y-12">
      <div class="lg:col-span-7">
        <p v-if="block.eyebrow" class="serif italic font-medium text-[1.2rem]">{{ block.eyebrow }}</p>
        <component :is="first ? 'h1' : 'h2'" class="mt-2 text-[2.4rem] md:text-[3.5rem] max-w-[36rem]"><KitMarked :text="block.heading" plain /></component>
        <p v-if="block.text" class="mt-5 max-w-[34rem] text-[1.1rem] font-medium">{{ tidyText(block.text) }}</p>
        <div v-if="block.steps.length" class="mt-9 grid sm:grid-cols-2 gap-3">
          <div v-for="(s, i) in block.steps" :key="s.id" class="p-6 rounded-[1.4rem] bg-lamp-ink/[0.09]">
            <p class="serif italic font-semibold text-[1.5rem] leading-none">{{ i + 1 }}.</p>
            <h3 class="mt-3 text-[1.35rem]">{{ tidyText(s.title) }}</h3>
            <p class="mt-2 text-[0.98rem]">{{ tidyText(s.text) }}</p>
          </div>
        </div>
        <p v-if="block.commission" class="mt-7 max-w-[34rem] serif font-medium text-[1.2rem] leading-[1.45]"><KitMarked :text="block.commission" plain /></p>
      </div>

      <div :id="formAnchor" class="lg:col-span-5">
        <div class="field rounded-[2rem] bg-night text-cream p-6 md:p-9" data-valuation>
          <h3 class="text-[1.9rem] md:text-[2.2rem]">{{ tidyText(block.formHeading) }}</h3>
          <p v-if="block.formText" class="mt-3 text-quiet text-[0.98rem]">{{ tidyText(block.formText) }}</p>
          <p v-if="form.sent.value" class="mt-6 font-medium" role="status">{{ form.successMessage.value }}</p>
          <form v-else-if="!form.unavailable.value" :ref="form.el" novalidate @submit.prevent="form.submit">
            <div class="mt-6 grid grid-cols-2 gap-x-3 gap-y-4">
              <SiteFields :form="form" :cols="{ kind: 'col-span-1', area: 'col-span-1' }" :placeholders="{ address: w.valuation.address, area: w.valuation.area }" />
            </div>
            <button class="btn w-full mt-6" type="submit" :disabled="form.sending.value">{{ form.sending.value ? words.sending : block.formButton || form.submitLabel.value }}</button>
          </form>
        </div>
      </div>
    </div>
  </section>
</template>
