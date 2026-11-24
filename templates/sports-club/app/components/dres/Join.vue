<script setup lang="ts">
// Dres's membership drive: a full block of the club colour. The photograph beside the headline and
// the age groups on shirt stripes, and under them one black strip with the form in a single row.
import type { AgeGroup } from '~/lib/cms-content'
import type { SiteForm } from '#imports'

const props = defineProps<{ block: BlockOf<'join'>; first?: boolean; anchor?: string; groups: AgeGroup[]; form: SiteForm }>()
const words = useSiteWords()
const form = props.form
const field = (key: string) => form.fields.value.find((f) => f.key === key)
</script>

<template>
  <section :id="anchor" class="mt-16 scroll-mt-0 bg-brand text-brand-ink lg:mt-24">
    <div class="grid" :class="block.image ? 'lg:grid-cols-2' : ''">
      <CmsImage v-if="block.image" :media="block.image" sizes="(min-width: 1024px) 50vw, 100vw" class="aspect-[4/3] h-full w-full object-cover lg:aspect-auto lg:min-h-[560px]" />
      <div class="stripes px-5 py-12 lg:px-14 lg:py-20">
        <p v-if="block.eyebrow" class="cap">{{ block.eyebrow }}</p>
        <component :is="first ? 'h1' : 'h2'" class="wide mt-4 text-[clamp(40px,5.6vw,84px)]">{{ plainEmphasis(block.heading) }}</component>
        <p v-if="block.text" class="mt-6 max-w-[32rem] text-lg">{{ tidyText(block.text) }}</p>
        <ul v-if="groups.length" class="mt-8 max-w-[34rem] border-t-2 border-current">
          <li v-for="g in groups" :key="g.id" class="grid grid-cols-[1fr_auto] items-baseline gap-x-4 border-b border-current/40 py-3 sm:grid-cols-[1fr_11rem_8rem]">
            <span class="head text-[19px]">{{ g.name }}</span><span class="wide whitespace-nowrap text-[15px] sm:text-[17px]">{{ g.years }}</span><span class="col-span-2 text-[15px] sm:col-span-1 sm:text-right">{{ g.when }}</span>
          </li>
        </ul>
      </div>
    </div>
    <div class="dark bg-ink text-paper">
      <p v-if="form.sent.value" class="wrap py-10 text-lg lg:py-12" role="status">{{ form.successMessage.value }}</p>
      <form v-else-if="!form.unavailable.value" :ref="form.el" class="wrap relative grid gap-x-3 gap-y-4 py-10 md:grid-cols-2 lg:grid-cols-[1.3fr_.7fr_1.2fr_1.2fr_auto] lg:items-end lg:py-12" novalidate @submit.prevent="form.submit">
        <h3 v-if="block.formHeading" class="wide text-[22px] md:col-span-2 lg:col-span-5 lg:text-[26px]">{{ block.formHeading }}</h3>
        <label class="cap block text-paper/80">{{ field('child')?.label }}<input v-model="form.values.child" class="field mt-2 font-sans text-base font-normal normal-case tracking-normal" type="text" name="child" autocomplete="off" :aria-invalid="!!form.errors.child"><span v-if="form.errors.child" class="field-error block">{{ form.errors.child }}</span></label>
        <label class="cap block text-paper/80">{{ field('birthYear')?.label }}<input v-model="form.values.birthYear" class="field mt-2 font-sans text-base font-normal normal-case tracking-normal" type="text" inputmode="numeric" name="birthYear" maxlength="4" :placeholder="words.placeholders.birthYear" :aria-invalid="!!form.errors.birthYear"><span v-if="form.errors.birthYear" class="field-error block">{{ form.errors.birthYear }}</span></label>
        <label class="cap block text-paper/80">{{ field('parent')?.label }}<input v-model="form.values.parent" class="field mt-2 font-sans text-base font-normal normal-case tracking-normal" type="text" name="parent" autocomplete="name" :aria-invalid="!!form.errors.parent"><span v-if="form.errors.parent" class="field-error block">{{ form.errors.parent }}</span></label>
        <label class="cap block text-paper/80">{{ field('contact')?.label }}<input v-model="form.values.contact" class="field mt-2 font-sans text-base font-normal normal-case tracking-normal" type="text" name="contact" autocomplete="tel" :aria-invalid="!!form.errors.contact"><span v-if="form.errors.contact" class="field-error block">{{ form.errors.contact }}</span></label>
        <KitFormExtras :form="form" />
        <button class="btn bg-brand text-brand-ink hover:bg-paper hover:text-ink md:col-span-2 lg:col-span-1" type="submit" :disabled="form.sending.value">{{ form.sending.value ? words.sending : block.buttonLabel || form.submitLabel.value }}</button>
        <p v-if="form.failure.value" class="field-error md:col-span-2 lg:col-span-5" role="alert">{{ form.failure.value }}</p>
        <p v-if="block.contactText || block.contactPhone" class="text-sm text-paper/70 md:col-span-2 lg:col-span-5">{{ block.contactText }} <a v-if="block.contactPhone" class="font-bold text-paper underline underline-offset-4" :href="contactHref(block.contactPhone)">{{ block.contactPhone }}</a></p>
      </form>
    </div>
  </section>
</template>
