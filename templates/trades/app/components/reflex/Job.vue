<script setup lang="ts">
// Reflex's page of one job: the name as large type, its facts as small capitals, the photographs
// edge to edge as on the home page, then the text beside a black button.
import type { Job } from '~/lib/cms-content'

const props = defineProps<{ entry: Job }>()
const { phone, cta, words } = await useTrades()
const photos = computed(() => jobPhotos(props.entry))
</script>

<template>
  <article>
    <div class="wrap pt-6 md:pt-10 pb-10 md:pb-14">
      <p><NuxtLink :to="siteHref('/zakazky')" class="label inline-flex items-center gap-2 min-h-[44px] underline decoration-2 underline-offset-4 hover:decoration-4"><UIcon name="i-lucide-arrow-left" class="size-5" aria-hidden="true" /> {{ words.backToJobs }}</NuxtLink></p>
      <h1 class="h2 mt-4 !text-[clamp(2.6rem,7.4vw,6.5rem)]">{{ tidyText(entry.title) }}</h1>
      <p v-if="jobFacts(entry).length" class="label mt-6 flex flex-wrap gap-x-5"><span v-for="fact in jobFacts(entry)" :key="fact">{{ fact }}</span></p>
    </div>

    <div v-if="photos.pair" class="grid grid-cols-2 gap-1">
      <figure class="ph aspect-square md:aspect-[4/3]"><CmsImage :media="photos.pair[0]" eager sizes="50vw" /><span class="tag">{{ words.before }}</span></figure>
      <figure class="ph aspect-square md:aspect-[4/3]"><CmsImage :media="photos.pair[1]" eager sizes="50vw" /><span class="tag tag-after">{{ words.after }}</span></figure>
    </div>
    <figure v-else-if="photos.single" class="ph aspect-[4/3] sm:aspect-[2/1] lg:aspect-[21/9]"><CmsImage :media="photos.single" eager sizes="100vw" /></figure>

    <div class="wrap pt-10 md:pt-14 pb-20 md:pb-28 grid lg:grid-cols-12 gap-x-12 gap-y-8">
      <p v-if="entry.text" class="lg:col-span-7 text-[1.1875rem] md:text-[1.375rem] leading-[1.4] font-medium">{{ tidyText(entry.text) }}</p>
      <div class="lg:col-span-5 flex flex-col sm:flex-row lg:flex-col gap-3 lg:items-start">
        <a v-if="phone" :href="phone.href" class="btn btn-ink font-cond !text-[1.75rem] !font-black tabular-nums" style="--paper:#fff" :aria-label="words.callNumber(phone.text)"><UIcon name="i-lucide-phone-call" class="size-5" aria-hidden="true" /> {{ phone.text }}</a>
        <NuxtLink v-if="cta" :to="cta.url" class="btn btn-line">{{ cta.label }}</NuxtLink>
      </div>
    </div>
  </article>
</template>
