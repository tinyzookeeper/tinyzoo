<script setup lang="ts">
// Mistr's page of one job: the photographs, the name, a small table of the facts and the text,
// drawn as the first job of the home page is, with the way back and the phone number.
import type { Job } from '~/lib/cms-content'

const props = defineProps<{ entry: Job }>()
const { settings, phone, cta, words } = await useTrades()
const photos = computed(() => jobPhotos(props.entry))
const rows = computed(() => [{ label: words.value.place, value: props.entry.place }, { label: words.value.finished, value: monthYear(props.entry.date) }, { label: words.value.tookTime, value: props.entry.duration }].filter((r) => !!r.value))
</script>

<template>
  <article class="wrap pt-10 md:pt-16 pb-20 md:pb-28">
    <p><NuxtLink :to="siteHref('/zakazky')" class="tlink"><UIcon name="i-lucide-arrow-left" class="size-[18px]" aria-hidden="true" /> {{ words.backToJobs }}</NuxtLink></p>
    <div class="mt-6 grid lg:grid-cols-12 gap-8 lg:gap-12">
      <div class="lg:col-span-8">
        <div v-if="photos.pair" class="grid grid-cols-2 gap-2 sm:gap-3">
          <figure class="ph aspect-[4/5] sm:aspect-[4/3]"><CmsImage :media="photos.pair[0]" eager sizes="(min-width: 1024px) 28rem, 50vw" /><span class="tag">{{ words.before }}</span></figure>
          <figure class="ph aspect-[4/5] sm:aspect-[4/3]"><CmsImage :media="photos.pair[1]" eager sizes="(min-width: 1024px) 28rem, 50vw" /><span class="tag tag-after">{{ words.after }}</span></figure>
        </div>
        <figure v-else-if="photos.single" class="ph aspect-[4/3]"><CmsImage :media="photos.single" eager sizes="(min-width: 1024px) 56rem, 100vw" /></figure>
      </div>
      <div class="lg:col-span-4">
        <p class="label">{{ words.jobLabel }}</p>
        <h1 class="mt-3 text-[1.9rem] md:text-[2.4rem] leading-[1.1] tracking-[-0.03em] font-bold">{{ tidyText(entry.title) }}</h1>
        <dl v-if="rows.length" class="mt-5 text-[0.9375rem] border-t border-line">
          <div v-for="row in rows" :key="row.label" class="flex justify-between gap-4 py-2.5 border-b border-line"><dt class="text-quiet">{{ row.label }}</dt><dd class="font-semibold text-ink text-right">{{ row.value }}</dd></div>
        </dl>
        <p v-if="entry.text" class="serif mt-5">{{ tidyText(entry.text) }}</p>
        <div class="mt-8 flex flex-col gap-3">
          <a v-if="phone" :href="phone.href" class="btn btn-brand tabular-nums" :aria-label="words.callNumber(phone.text)"><UIcon name="i-lucide-phone" class="size-[18px]" aria-hidden="true" /> {{ phone.text }}</a>
          <NuxtLink v-if="cta" :to="cta.url" class="btn btn-line">{{ cta.label }}</NuxtLink>
          <p v-if="settings?.hoursLine" class="text-[0.9375rem] text-quiet">{{ words.answering }} {{ settings.hoursLine }}</p>
        </div>
      </div>
    </div>
  </article>
</template>
