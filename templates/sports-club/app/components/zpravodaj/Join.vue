<script setup lang="ts">
// Zpravodaj's membership drive: the one tinted band of the page. The headline, the photograph and
// the age groups as a ruled table on one side, the trial-training form on a paper card on the other.
import type { AgeGroup } from '~/lib/cms-content'
import type { SiteForm } from '#imports'

const props = defineProps<{ block: BlockOf<'join'>; first?: boolean; anchor?: string; groups: AgeGroup[]; form: SiteForm }>()
const words = useSiteWords()
const form = props.form
const field = (key: string) => form.fields.value.find((f) => f.key === key)
</script>

<template>
  <section :id="anchor" class="mt-16 scroll-mt-0 bg-tint lg:mt-24">
    <div class="wrap grid gap-10 py-14 lg:grid-cols-12 lg:gap-14 lg:py-20">
      <div class="lg:col-span-6">
        <p v-if="block.eyebrow" class="label">{{ block.eyebrow }}</p>
        <component :is="first ? 'h1' : 'h2'" class="h2 mt-3"><KitMarked :text="block.heading" plain /></component>
        <p v-if="block.text" class="mt-4 max-w-[34rem]">{{ tidyText(block.text) }}</p>
        <div v-if="block.image" class="frame mt-8"><CmsImage :media="block.image" sizes="(min-width: 1024px) 38rem, 100vw" class="aspect-[16/10] w-full object-cover" /></div>
      </div>
      <div class="lg:col-span-6">
        <table v-if="groups.length" class="w-full text-[15px]">
          <caption v-if="block.listLabel" class="label pb-3 text-left">{{ block.listLabel }}</caption>
          <tbody class="border-t border-ink">
            <tr v-for="g in groups" :key="g.id" class="border-b border-line">
              <th scope="row" class="py-3 pr-3 text-left font-display text-[17px] font-bold text-ink">{{ g.name }}</th>
              <td class="num py-3 pr-3">{{ g.years }}</td>
              <td class="py-3 text-right sm:text-left">{{ g.when }}</td>
            </tr>
          </tbody>
        </table>

        <div class="border border-line bg-paper p-6 sm:p-8" :class="groups.length ? 'mt-9' : ''">
          <h3 v-if="block.formHeading" class="text-[22px] font-bold leading-tight">{{ block.formHeading }}</h3>
          <p v-if="form.sent.value" class="mt-5" role="status">{{ form.successMessage.value }}</p>
          <form v-else-if="!form.unavailable.value" :ref="form.el" class="relative" novalidate @submit.prevent="form.submit">
            <div class="mt-5 grid gap-4 sm:grid-cols-[1fr_9rem]">
              <label class="block text-sm font-medium text-ink">{{ field('child')?.label }}<input v-model="form.values.child" class="field mt-1.5" type="text" name="child" autocomplete="off" :placeholder="words.placeholders.child" :aria-invalid="!!form.errors.child"><span v-if="form.errors.child" class="field-error block">{{ form.errors.child }}</span></label>
              <label class="block text-sm font-medium text-ink">{{ field('birthYear')?.label }}<input v-model="form.values.birthYear" class="field num mt-1.5" type="text" inputmode="numeric" name="birthYear" maxlength="4" :placeholder="words.placeholders.birthYear" :aria-invalid="!!form.errors.birthYear"><span v-if="form.errors.birthYear" class="field-error block">{{ form.errors.birthYear }}</span></label>
            </div>
            <div class="mt-4 grid gap-4 sm:grid-cols-2">
              <label class="block text-sm font-medium text-ink">{{ field('parent')?.label }}<input v-model="form.values.parent" class="field mt-1.5" type="text" name="parent" autocomplete="name" :aria-invalid="!!form.errors.parent"><span v-if="form.errors.parent" class="field-error block">{{ form.errors.parent }}</span></label>
              <label class="block text-sm font-medium text-ink">{{ field('contact')?.label }}<input v-model="form.values.contact" class="field mt-1.5" type="text" name="contact" autocomplete="tel" :aria-invalid="!!form.errors.contact"><span v-if="form.errors.contact" class="field-error block">{{ form.errors.contact }}</span></label>
            </div>
            <KitFormExtras :form="form" />
            <p v-if="form.failure.value" class="field-error mt-4" role="alert">{{ form.failure.value }}</p>
            <div class="mt-6 flex flex-wrap items-center gap-x-6 gap-y-3">
              <button class="btn btn-fill" type="submit" :disabled="form.sending.value">{{ form.sending.value ? words.sending : block.buttonLabel || form.submitLabel.value }}</button>
              <p v-if="block.contactText || block.contactPhone" class="text-sm">{{ block.contactText }} <a v-if="block.contactPhone" class="link !font-medium" :href="contactHref(block.contactPhone)">{{ block.contactPhone }}</a></p>
            </div>
          </form>
        </div>
      </div>
    </div>
  </section>
</template>
