<script setup lang="ts">
// Čtvrthodinka's newsletter: a rounded block in the brand colour ("20 min, every Sunday") beside
// the most read articles, numbered. The block comes first on the page whatever the order of the
// markup (the most read is first in it, as in Obálka, so both looks read in the same order).
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
  <section class="wrap grid gap-x-12 gap-y-14 py-16 lg:grid-cols-12 lg:py-28">
    <div v-if="read.length" class="order-2 lg:col-span-5" aria-labelledby="mostread-h">
      <h2 id="mostread-h" class="text-[2rem] font-black leading-none tracking-[-0.04em] lg:text-[2.4rem]">{{ block.mostReadHeading }}</h2>
      <ol class="mt-5">
        <li v-for="(a, i) in read" :key="a.id">
          <NuxtLink :to="articleHref(a)" class="grid grid-cols-[3.2rem_1fr] items-baseline border-t border-rule py-4" :class="i === read.length - 1 ? 'border-b' : ''">
            <span class="text-[2.4rem] font-black leading-none tracking-[-0.05em] text-brand">{{ i + 1 }}</span>
            <span class="text-[1.2rem] font-bold leading-[1.2] tracking-[-0.01em]"><span class="lift">{{ tidyText(listTitle(a, words)) }}</span><span class="meta mt-1 block">{{ a.series ? words.series : a.section.name }} &nbsp;·&nbsp; {{ words.min(minutesOf(a)) }}</span></span>
          </NuxtLink>
        </li>
      </ol>
    </div>

    <div :id="anchor" class="order-1 rounded-[1.75rem] bg-brand p-6 text-brand-ink sm:p-10 lg:p-14" :class="read.length ? 'lg:col-span-7' : 'lg:col-span-12'" aria-labelledby="news-h">
      <p class="flex items-center gap-3 font-extrabold"><span class="dial [--dial:var(--brand-ink)] [--dial-ring:var(--brand-ink)] [--size:2.6rem]" :style="`--m:${block.minutes ?? 20}`" aria-hidden="true" />{{ words.min(block.minutes ?? 20) }} &nbsp;·&nbsp; {{ block.schedule }}</p>
      <component :is="tag" id="news-h" class="mt-6 text-[2.9rem] font-black leading-[0.94] tracking-[-0.045em] lg:text-[4.6rem]"><KitMarked :text="block.heading" /></component>
      <p v-if="block.text" class="mt-5 max-w-[34rem] text-[1.15rem] font-medium leading-[1.45] lg:text-[1.25rem]">{{ tidyText(block.text) }}</p>
      <p v-if="form.sent.value" class="mt-8 max-w-[34rem] text-[1.3rem] font-bold" role="status">{{ form.successMessage.value }}</p>
      <form v-else-if="!form.unavailable.value" :ref="form.el" class="mt-8 max-w-[34rem]" novalidate @submit.prevent="form.submit">
        <label :for="form.id('email')" class="text-[0.9rem] font-bold">{{ form.fields.value[0]?.label }}</label>
        <div class="mt-2 flex flex-col gap-3 sm:flex-row">
          <input :id="form.id('email')" v-model="form.values.email" type="email" name="email" required autocomplete="email" :placeholder="words.emailPlaceholder" :aria-invalid="!!form.errors.email" class="h-14 w-full rounded-full border-2 border-brand-ink bg-transparent px-6 text-lg font-medium text-brand-ink placeholder:text-brand-ink/70 focus:outline-offset-4 focus:outline-brand-ink">
          <button type="submit" class="h-14 shrink-0 cursor-pointer rounded-full bg-brand-ink px-8 text-lg font-bold text-brand transition-transform hover:-translate-y-0.5 focus-visible:outline-brand-ink" :disabled="form.sending.value">{{ form.sending.value ? words.sending : form.submitLabel.value }}</button>
        </div>
        <p v-if="form.errors.email" class="mt-2 text-[0.9rem] font-bold" role="alert">{{ form.errors.email }}</p>
        <p v-if="form.failure.value" class="mt-2 text-[0.9rem] font-bold" role="alert">{{ form.failure.value }}</p>
        <KitFormExtras :form="form" />
        <p class="mt-4 text-[0.9rem] font-medium leading-relaxed"><KitMarked :text="words.consent" as="a" :attrs="{ href: consentUrl, class: 'underline underline-offset-2 focus-visible:outline-brand-ink' }" /></p>
      </form>
    </div>
  </section>
</template>
