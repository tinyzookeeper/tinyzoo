<script setup lang="ts">
// Hřiště's membership drive: the one full block of club colour. The training photograph, and over
// its lower edge a panel with chalk lines of the pitch: the age groups on the left, the form on a
// white card on the right.
import type { AgeGroup } from '~/lib/cms-content'
import type { SiteForm } from '#imports'

const props = defineProps<{ block: BlockOf<'join'>; first?: boolean; anchor?: string; groups: AgeGroup[]; form: SiteForm }>()
const words = useSiteWords()
const form = props.form
const field = (key: string) => form.fields.value.find((f) => f.key === key)
</script>

<template>
  <section :id="anchor" class="wrap scroll-mt-4 pt-16 lg:pt-28">
    <div v-if="block.image" class="photo"><CmsImage :media="block.image" sizes="(min-width: 1304px) 1304px, 100vw" class="aspect-[4/3] w-full object-cover sm:aspect-[2/1] lg:aspect-[2.6/1]" /></div>
    <div class="on-dark relative z-10 mx-auto overflow-hidden rounded-[28px] bg-brand text-brand-ink sm:w-[calc(100%-48px)] xl:w-[calc(100%-96px)]" :class="block.image ? '-mt-10 lg:-mt-32' : ''">
      <svg viewBox="0 0 600 600" class="chalk -bottom-72 -right-56 w-[560px] opacity-20 lg:-bottom-80 lg:-right-44 lg:w-[680px]" aria-hidden="true"><circle cx="300" cy="300" r="180" /><circle cx="300" cy="300" r="5" fill="currentColor" /><path d="M300 0v600" /></svg>
      <div class="relative grid gap-x-10 gap-y-8 p-5 pt-8 sm:p-9 lg:grid-cols-2 lg:p-10 xl:grid-cols-12 xl:gap-x-12 xl:p-14">
        <div class="xl:col-span-7">
          <p v-if="block.eyebrow" class="eyebrow !text-brand-ink/85">{{ block.eyebrow }}</p>
          <component :is="first ? 'h1' : 'h2'" class="disp mt-3 text-[clamp(31px,4vw,54px)] !text-brand-ink"><KitMarked :text="block.heading" plain /></component>
          <p v-if="block.text" class="mt-4 max-w-[36rem] text-[18px] text-brand-ink/90">{{ tidyText(block.text) }}</p>
          <ul v-if="groups.length" class="mt-7 max-w-[36rem] border-t border-brand-ink/30">
            <li v-for="g in groups" :key="g.id" class="grid grid-cols-[1fr_auto] items-baseline gap-x-4 border-b border-brand-ink/30 py-3 xl:grid-cols-[1fr_10rem_7.5rem]">
              <span class="font-display text-[18px] font-extrabold">{{ g.name }}</span><span class="whitespace-nowrap text-[15.5px] text-brand-ink/90 max-xl:order-3 max-xl:col-span-2">{{ words.yearsOf(g.years ?? '') }}</span><span class="whitespace-nowrap text-right text-[15.5px] font-semibold">{{ g.when }}</span>
            </li>
          </ul>
        </div>
        <div class="self-start rounded-3xl bg-white p-5 text-ink sm:p-7 xl:col-span-5">
          <h3 v-if="block.formHeading" class="disp text-[24px]">{{ block.formHeading }}</h3>
          <p v-if="form.sent.value" class="mt-4" role="status">{{ form.successMessage.value }}</p>
          <form v-else-if="!form.unavailable.value" :ref="form.el" class="relative" novalidate @submit.prevent="form.submit">
            <div class="mt-4 grid grid-cols-[1fr_7rem] gap-x-3 gap-y-3.5">
              <label class="block text-[14.5px] font-semibold">{{ field('child')?.label }}<input v-model="form.values.child" class="field" type="text" name="child" autocomplete="off" :aria-invalid="!!form.errors.child"><span v-if="form.errors.child" class="field-error block">{{ form.errors.child }}</span></label>
              <label class="block text-[14.5px] font-semibold">{{ field('birthYear')?.label }}<input v-model="form.values.birthYear" class="field" type="text" inputmode="numeric" name="birthYear" maxlength="4" :placeholder="words.placeholders.birthYear" :aria-invalid="!!form.errors.birthYear"><span v-if="form.errors.birthYear" class="field-error block">{{ form.errors.birthYear }}</span></label>
              <label class="col-span-2 block text-[14.5px] font-semibold">{{ field('parent')?.label }}<input v-model="form.values.parent" class="field" type="text" name="parent" autocomplete="name" :aria-invalid="!!form.errors.parent"><span v-if="form.errors.parent" class="field-error block">{{ form.errors.parent }}</span></label>
              <label class="col-span-2 block text-[14.5px] font-semibold">{{ field('contact')?.label }}<input v-model="form.values.contact" class="field" type="text" name="contact" autocomplete="tel" :aria-invalid="!!form.errors.contact"><span v-if="form.errors.contact" class="field-error block">{{ form.errors.contact }}</span></label>
            </div>
            <KitFormExtras :form="form" />
            <p v-if="form.failure.value" class="field-error mt-4" role="alert">{{ form.failure.value }}</p>
            <button class="btn btn-dark mt-5 w-full" type="submit" :disabled="form.sending.value">{{ form.sending.value ? words.sending : block.buttonLabel || form.submitLabel.value }}</button>
            <p v-if="block.contactText || block.contactPhone" class="mt-4 text-[14.5px] leading-snug text-quiet">{{ block.contactText }} <a v-if="block.contactPhone" class="link text-ink" :href="contactHref(block.contactPhone)">{{ block.contactPhone }}</a></p>
          </form>
        </div>
      </div>
    </div>
  </section>
</template>
