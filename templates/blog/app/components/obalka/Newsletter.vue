<script setup lang="ts">
// Obálka's most read (numbered in italics) beside the newsletter, a block in the brand colour
// with a field and a button.
import type { SiteForm } from '#imports'
import type { Article } from '../../lib/cms-content'

const props = defineProps<{ block: BlockOf<'newsletter'>; first?: boolean; anchor?: string; articles: Article[]; form: SiteForm }>()
const { words } = await useBlog()
const tag = await useHeadingTag(() => props.first)
const form = props.form
const read = computed(() => (props.block.mostReadHeading ? mostReadOf(props.articles) : []))
const consentUrl = computed(() => siteHref(props.block.consentUrl))
</script>

<template>
  <section class="wrap grid gap-x-14 gap-y-16 pb-16 lg:grid-cols-12 lg:pb-28">
    <div v-if="read.length" class="lg:col-span-5" aria-labelledby="mostread-h">
      <h2 id="mostread-h" class="kicker">{{ block.mostReadHeading }}</h2>
      <ol class="mt-4">
        <li v-for="(a, i) in read" :key="a.id">
          <NuxtLink :to="articleHref(a)" class="grid grid-cols-[3.4rem_1fr] items-baseline border-t border-ink/20 py-4" :class="i === read.length - 1 ? 'border-y' : ''">
            <span class="font-display text-[2.6rem] font-extralight italic leading-none text-brand">{{ i + 1 }}</span>
            <span class="font-display text-[1.3rem] leading-[1.22]"><span class="lift">{{ tidyText(listTitle(a, words)) }}</span><span class="byline mt-1 block text-quiet">{{ a.series ? words.series : a.section.name }} &nbsp;·&nbsp; {{ words.min(minutesOf(a)) }}</span></span>
          </NuxtLink>
        </li>
      </ol>
    </div>

    <div :id="anchor" class="bg-brand px-6 py-10 text-brand-ink sm:px-10 lg:px-14 lg:py-14" :class="read.length ? 'lg:col-span-7' : 'lg:col-span-12'" aria-labelledby="news-h">
      <p class="kicker opacity-90">{{ block.eyebrow }} &nbsp;·&nbsp; {{ block.schedule }}</p>
      <component :is="tag" id="news-h" class="mt-4 font-display text-[3rem] font-extralight leading-none tracking-[-0.025em] lg:text-[4.4rem]"><KitMarked :text="block.heading" /></component>
      <p v-if="block.text" class="mt-6 max-w-[33rem] font-display text-[1.18rem] leading-[1.55]">{{ tidyText(block.text) }}</p>
      <p v-if="form.sent.value" class="mt-8 max-w-[33rem] font-display text-[1.3rem] italic" role="status">{{ form.successMessage.value }}</p>
      <form v-else-if="!form.unavailable.value" :ref="form.el" class="mt-8 max-w-[33rem]" novalidate @submit.prevent="form.submit">
        <label :for="form.id('email')" class="byline block opacity-90">{{ form.fields.value[0]?.label }}</label>
        <div class="mt-2 flex flex-col gap-3 sm:flex-row">
          <input :id="form.id('email')" v-model="form.values.email" type="email" name="email" required autocomplete="email" :placeholder="words.emailPlaceholder" :aria-invalid="!!form.errors.email" class="h-13 w-full border border-brand-ink/60 bg-transparent px-4 text-lg text-brand-ink placeholder:text-brand-ink/70 focus:border-brand-ink focus:outline-none">
          <button type="submit" class="h-13 shrink-0 cursor-pointer bg-brand-ink px-7 text-lg text-brand transition-opacity hover:opacity-90" :disabled="form.sending.value">{{ form.sending.value ? words.sending : form.submitLabel.value }}</button>
        </div>
        <p v-if="form.errors.email" class="byline mt-2 font-bold" role="alert">{{ form.errors.email }}</p>
        <p v-if="form.failure.value" class="byline mt-2 font-bold" role="alert">{{ form.failure.value }}</p>
        <KitFormExtras :form="form" />
        <p class="byline mt-4 leading-relaxed opacity-90"><KitMarked :text="words.consent" as="a" :attrs="{ href: consentUrl, class: 'underline underline-offset-2' }" /></p>
      </form>
    </div>
  </section>
</template>
