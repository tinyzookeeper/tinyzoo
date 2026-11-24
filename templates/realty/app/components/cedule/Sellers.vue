<script setup lang="ts">
// Cedule's seller section: black across the whole width. The heading, the steps as a ruled list
// (a big figure, a title, the text) and the commission set large with its first words in the
// brand colour; beside them the price-estimate form on a block of the brand colour.
const props = defineProps<{ block: BlockOf<'sellers'>; first?: boolean; anchor?: string; formAnchor?: string; form: SiteForm }>()
const words = useSiteWords()
const w = words.value.cedule
const form = props.form
</script>

<template>
  <section :id="anchor" class="on-dark bg-ink text-paper">
    <div class="wrap py-14 md:py-24 grid lg:grid-cols-12 gap-x-10 gap-y-12">
      <div class="lg:col-span-7">
        <p v-if="block.eyebrow" class="mono caps text-spark">{{ block.eyebrow }}</p>
        <component :is="first ? 'h1' : 'h2'" class="mt-5 text-[2.7rem] md:text-[4.6rem] tracking-[-0.05em] leading-[0.92]"><KitMarked :text="block.heading" plain /></component>
        <p v-if="block.text" class="mt-6 text-[1.1rem] font-medium max-w-[34rem]">{{ tidyText(block.text) }}</p>
        <ol v-if="block.steps.length" class="mt-10 border-t-2 border-paper">
          <li v-for="(s, i) in block.steps" :key="s.id" class="grid grid-cols-[3rem_1fr] md:grid-cols-[4rem_14rem_1fr] gap-x-4 gap-y-1 py-5 border-b border-paper/40">
            <span class="font-extrabold text-[1.6rem] leading-none tracking-[-0.04em] text-spark num">{{ String(i + 1).padStart(2, '0') }}</span>
            <h3 class="text-[1.3rem] leading-[1.1] tracking-[-0.02em]">{{ tidyText(s.title) }}</h3>
            <p class="col-start-2 md:col-start-3 text-paper/85">{{ tidyText(s.text) }}</p>
          </li>
        </ol>
        <p v-if="block.commission" class="mt-8 font-extrabold text-[1.7rem] md:text-[2.2rem] leading-[1.05] tracking-[-0.04em] max-w-[34rem]"><KitMarked :text="block.commission" as="span" :attrs="{ class: 'text-spark' }" /></p>
      </div>

      <div :id="formAnchor" class="lg:col-span-5">
        <div class="bg-brand text-brand-ink p-6 md:p-9 field on-brand" style="--ink:#111110" data-valuation>
          <h3 class="text-[2.1rem] md:text-[2.6rem] tracking-[-0.045em] leading-[0.95]">{{ tidyText(block.formHeading) }}</h3>
          <p v-if="block.formText" class="mt-3 font-medium">{{ tidyText(block.formText) }}</p>
          <p v-if="form.sent.value" class="mt-6 font-bold" role="status">{{ form.successMessage.value }}</p>
          <form v-else-if="!form.unavailable.value" :ref="form.el" novalidate @submit.prevent="form.submit">
            <div class="mt-6 grid grid-cols-2 gap-x-3 gap-y-4">
              <SiteFields :form="form" label-class="mono caps" :cols="{ kind: 'col-span-1', area: 'col-span-1' }" :placeholders="{ address: w.valuation.address, area: w.valuation.area }" />
            </div>
            <button class="btn w-full mt-6 min-h-[60px] text-[1.1rem]" type="submit" :disabled="form.sending.value">{{ form.sending.value ? words.sending : block.formButton || form.submitLabel.value }} <UIcon name="i-lucide-arrow-right" class="ic size-4" aria-hidden="true" /></button>
          </form>
        </div>
      </div>
    </div>
  </section>
</template>
