<script setup lang="ts">
// Mistr's jobs: on a tinted band, the first job large (its pair of photographs, a small table
// of the facts and the text), the others in two columns with the photographs on top.
import type { Job } from '~/lib/cms-content'

const props = defineProps<{ block: BlockOf<'jobs'>; first?: boolean; anchor?: string; jobs: Job[]; total: number }>()
const words = useSiteWords()
const lead = computed(() => props.jobs[0] ?? null)
const others = computed(() => props.jobs.slice(1))
const rows = (job: Job) => [{ label: words.value.place, value: job.place }, { label: words.value.finished, value: monthYear(job.date) }, { label: words.value.tookTime, value: job.duration }].filter((r) => !!r.value)
const rest = (job: Job) => [monthYear(job.date), job.duration].filter(Boolean).join(' · ')
</script>

<template>
  <section :id="anchor" class="bg-tint scroll-mt-20">
    <div class="wrap py-20 md:py-28">
      <div class="flex flex-wrap items-end justify-between gap-x-10 gap-y-3">
        <div>
          <component :is="first ? 'h1' : 'h2'" class="h2"><KitMarked :text="block.heading" plain /></component>
          <p v-if="block.text" class="serif mt-4 max-w-[36rem]">{{ tidyText(block.text) }}</p>
        </div>
        <NuxtLink v-if="!block.all" :to="siteHref('/zakazky')" class="tlink">{{ words.allJobs(total) }} <UIcon name="i-lucide-arrow-right" class="size-[18px]" aria-hidden="true" /></NuxtLink>
      </div>

      <!-- The newest job, large -->
      <article v-if="lead" class="mt-12 grid lg:grid-cols-12 gap-8 lg:gap-12" :class="others.length ? 'pb-12 md:pb-16 border-b border-line' : ''" :data-job="lead.id">
        <div class="lg:col-span-8">
          <div v-if="jobPhotos(lead).pair" class="grid grid-cols-2 gap-2 sm:gap-3">
            <figure class="ph aspect-[4/5] sm:aspect-[4/3]"><CmsImage :media="jobPhotos(lead).pair![0]" sizes="(min-width: 1024px) 28rem, 50vw" /><span class="tag">{{ words.before }}</span></figure>
            <figure class="ph aspect-[4/5] sm:aspect-[4/3]"><CmsImage :media="jobPhotos(lead).pair![1]" sizes="(min-width: 1024px) 28rem, 50vw" /><span class="tag tag-after">{{ words.after }}</span></figure>
          </div>
          <figure v-else-if="jobPhotos(lead).single" class="ph aspect-[4/3]"><CmsImage :media="jobPhotos(lead).single!" sizes="(min-width: 1024px) 56rem, 100vw" /></figure>
        </div>
        <div class="lg:col-span-4">
          <h3 class="text-[1.6rem] md:text-[1.85rem] leading-[1.15] tracking-[-0.025em]"><NuxtLink :to="`/zakazka/${lead.slug}`" class="hover:text-brand transition-colors">{{ tidyText(lead.title) }}</NuxtLink></h3>
          <dl v-if="rows(lead).length" class="mt-5 text-[0.9375rem] border-t border-line">
            <div v-for="row in rows(lead)" :key="row.label" class="flex justify-between gap-4 py-2.5 border-b border-line"><dt class="text-quiet">{{ row.label }}</dt><dd class="font-semibold text-ink text-right">{{ row.value }}</dd></div>
          </dl>
          <p v-if="lead.text" class="serif mt-5">{{ tidyText(lead.text) }}</p>
        </div>
      </article>

      <!-- The others -->
      <div v-if="others.length" class="mt-12 md:mt-16 grid md:grid-cols-2 gap-x-10 lg:gap-x-12 gap-y-14">
        <article v-for="job in others" :key="job.id" :data-job="job.id">
          <div v-if="jobPhotos(job).pair" class="grid grid-cols-2 gap-2">
            <figure class="ph aspect-[4/5] sm:aspect-[3/4] lg:aspect-[4/5]"><CmsImage :media="jobPhotos(job).pair![0]" sizes="(min-width: 1024px) 20rem, 46vw" /><span class="tag">{{ words.before }}</span></figure>
            <figure class="ph aspect-[4/5] sm:aspect-[3/4] lg:aspect-[4/5]"><CmsImage :media="jobPhotos(job).pair![1]" sizes="(min-width: 1024px) 20rem, 46vw" /><span class="tag tag-after">{{ words.after }}</span></figure>
          </div>
          <figure v-else-if="jobPhotos(job).single" class="ph aspect-[5/4] sm:aspect-[3/2] md:aspect-[8/5]"><CmsImage :media="jobPhotos(job).single!" sizes="(min-width: 1024px) 40rem, 100vw" /></figure>
          <h3 class="mt-5 text-[1.375rem] leading-[1.2]"><NuxtLink :to="`/zakazka/${job.slug}`" class="hover:text-brand transition-colors">{{ tidyText(job.title) }}</NuxtLink></h3>
          <p class="mt-1.5 text-[0.9375rem] text-quiet"><span v-if="job.place" class="font-semibold text-ink">{{ job.place }}</span><template v-if="rest(job)"> · {{ rest(job) }}</template></p>
          <p v-if="job.text" class="serif mt-3 !text-[1.0625rem]">{{ tidyText(job.text) }}</p>
        </article>
      </div>
    </div>
  </section>
</template>
