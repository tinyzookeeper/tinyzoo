<script setup lang="ts">
// Reflex's jobs: an edge-to-edge wall of tiles on black. A job with a before and after pair takes
// a full row (two photographs and its text), a job with one photograph half a row (its photograph
// and its text), and the link to all jobs fills the rest in the signal colour.
import type { Job } from '~/lib/cms-content'

const props = defineProps<{ block: BlockOf<'jobs'>; first?: boolean; anchor?: string; jobs: Job[]; total: number }>()
const words = useSiteWords()
const pairs = computed(() => props.jobs.filter((j) => jobPhotos(j).pair))
const singles = computed(() => props.jobs.filter((j) => !jobPhotos(j).pair))
</script>

<template>
  <section :id="anchor" class="on-dark bg-ink text-white scroll-mt-0">
    <div class="wrap pt-16 md:pt-24 pb-10 md:pb-14 flex flex-wrap items-end justify-between gap-x-10 gap-y-5">
      <div>
        <p v-if="block.eyebrow" class="label text-brand-lit">{{ block.eyebrow }}</p>
        <component :is="first ? 'h1' : 'h2'" class="h2 mt-3"><KitMarked :text="block.heading" plain /></component>
      </div>
      <p v-if="block.text" class="text-[1.125rem] leading-[1.4] font-medium max-w-[26rem] text-[#d6d9d4] md:pb-2">{{ tidyText(block.text) }}</p>
    </div>

    <!-- Jobs with a before and after pair: one full row each, the text first in every second one -->
    <div v-if="pairs.length" class="grid grid-cols-2 md:grid-cols-12 gap-1 pb-1">
      <template v-for="(job, i) in pairs" :key="job.id">
        <article v-if="i % 2" class="jtext col-span-2 md:col-span-4 order-last md:order-none mb-6 md:mb-0" :data-job="job.id">
          <h3 class="md:!text-[2.25rem]"><NuxtLink :to="`/zakazka/${job.slug}`" class="hover:underline decoration-4 underline-offset-4">{{ tidyText(job.title) }}</NuxtLink></h3>
          <p class="jmeta !p-0 !text-brand-lit"><span v-for="fact in jobFacts(job)" :key="fact">{{ fact }}</span></p>
          <p v-if="job.text">{{ tidyText(job.text) }}</p>
        </article>
        <figure class="ph aspect-square md:aspect-auto md:min-h-[22.5rem] md:col-span-4"><CmsImage :media="jobPhotos(job).pair![0]" sizes="(min-width: 768px) 34vw, 50vw" /><span class="tag">{{ words.before }}</span></figure>
        <figure class="ph aspect-square md:aspect-auto md:min-h-[22.5rem] md:col-span-4"><CmsImage :media="jobPhotos(job).pair![1]" sizes="(min-width: 768px) 34vw, 50vw" /><span class="tag tag-after">{{ words.after }}</span></figure>
        <article v-if="!(i % 2)" class="jtext col-span-2 md:col-span-4 mb-6 md:mb-0" :data-job="job.id">
          <h3 class="md:!text-[2.25rem]"><NuxtLink :to="`/zakazka/${job.slug}`" class="hover:underline decoration-4 underline-offset-4">{{ tidyText(job.title) }}</NuxtLink></h3>
          <p class="jmeta !p-0 !text-brand-lit"><span v-for="fact in jobFacts(job)" :key="fact">{{ fact }}</span></p>
          <p v-if="job.text">{{ tidyText(job.text) }}</p>
        </article>
      </template>
    </div>

    <!-- Jobs with one photograph: half a row each -->
    <div v-if="singles.length || !block.all" class="grid md:grid-cols-2 xl:grid-cols-12 gap-1">
      <template v-for="job in singles" :key="job.id">
        <figure v-if="jobPhotos(job).single" class="ph aspect-[4/3] md:aspect-auto md:min-h-[22.5rem] xl:col-span-3"><CmsImage :media="jobPhotos(job).single!" sizes="(min-width: 1280px) 25vw, (min-width: 768px) 50vw, 100vw" /></figure>
        <article class="jtext xl:col-span-3 mb-6 md:mb-0" :data-job="job.id">
          <h3><NuxtLink :to="`/zakazka/${job.slug}`" class="hover:underline decoration-4 underline-offset-4">{{ tidyText(job.title) }}</NuxtLink></h3>
          <p class="jmeta !p-0 !text-brand-lit"><span v-for="fact in jobFacts(job)" :key="fact">{{ fact }}</span></p>
          <p v-if="job.text">{{ tidyText(job.text) }}</p>
        </article>
      </template>
      <NuxtLink v-if="!block.all" :to="siteHref('/zakazky')" class="group md:col-span-2 xl:col-span-6 flex flex-col justify-between gap-8 p-5 md:p-7 min-h-[12rem] bg-brand text-brand-ink transition-colors hover:bg-white hover:text-ink focus-visible:!outline-white">
        <span class="label">{{ words.jobsArchive }}</span>
        <span class="flex items-end justify-between gap-6">
          <span class="text-[2.5rem] md:text-[3.5rem] font-black leading-[0.95] tracking-[-0.04em]">{{ words.allJobs(total) }}</span>
          <UIcon name="i-lucide-arrow-right" class="size-12 shrink-0 transition-transform group-hover:translate-x-2" aria-hidden="true" />
        </span>
      </NuxtLink>
    </div>
  </section>
</template>
