<script setup lang="ts">
// Katastr's seller section: the brand colour across the whole width, the steps as a ruled grid
// of numbered cells, and the price-estimate form on a paper card beside them.
const props = defineProps<{ block: BlockOf<'sellers'>; first?: boolean; anchor?: string; formAnchor?: string; form: SiteForm }>()
const words = useSiteWords()
const w = words.value.katastr
const form = props.form
</script>

<template>
  <section :id="anchor" class="bg-brand text-brand-ink">
    <div class="wrap py-16 md:py-24 grid lg:grid-cols-12 gap-x-12 gap-y-12">
      <div class="lg:col-span-7">
        <p v-if="block.eyebrow" class="label opacity-80">{{ block.eyebrow }}</p>
        <component :is="first ? 'h1' : 'h2'" class="mt-4 text-brand-ink text-[2.1rem] md:text-[2.9rem] leading-[1.1] max-w-[36rem]"><KitMarked :text="block.heading" /></component>
        <p v-if="block.text" class="mt-5 max-w-[34rem] opacity-90">{{ tidyText(block.text) }}</p>
        <div v-if="block.steps.length" class="mt-10 grid sm:grid-cols-2 gap-x-10 border-t border-brand-ink/25">
          <div v-for="(s, i) in block.steps" :key="s.id" class="py-6 border-b border-brand-ink/25">
            <p class="serif italic text-[1.1rem] opacity-80 num">{{ String(i + 1).padStart(2, '0') }}</p>
            <h3 class="mt-1 text-brand-ink text-[1.4rem]">{{ tidyText(s.title) }}</h3>
            <p class="mt-2 opacity-90">{{ tidyText(s.text) }}</p>
          </div>
        </div>
      </div>

      <div :id="formAnchor" class="lg:col-span-5">
        <div class="bg-paper text-body p-7 md:p-9 field" data-valuation>
          <h3 class="text-[1.75rem] leading-[1.15]">{{ tidyText(block.formHeading) }}</h3>
          <p v-if="block.formText" class="mt-2 text-[0.95rem]">{{ tidyText(block.formText) }}</p>
          <p v-if="form.sent.value" class="mt-6 text-ink" role="status">{{ form.successMessage.value }}</p>
          <form v-else-if="!form.unavailable.value" :ref="form.el" novalidate @submit.prevent="form.submit">
            <div class="mt-6 grid grid-cols-2 gap-x-4 gap-y-4">
              <SiteFields :form="form" label-class="label" :cols="{ kind: 'col-span-1', area: 'col-span-1' }" :placeholders="{ address: w.valuation.address, area: w.valuation.area }" />
            </div>
            <button class="btn w-full mt-6" type="submit" :disabled="form.sending.value">{{ form.sending.value ? words.sending : block.formButton || form.submitLabel.value }}</button>
          </form>
        </div>
        <p v-if="block.commission" class="mt-7 serif text-[1.2rem] leading-[1.5]"><KitMarked :text="block.commission" plain /></p>
      </div>
    </div>
  </section>
</template>
