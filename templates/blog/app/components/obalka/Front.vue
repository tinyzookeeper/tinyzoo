<script setup lang="ts">
// Obálka's front page: the lead photograph fills the first screen under the magazine's name, the
// lead headline stands on the picture at the right and the short articles are cover lines (under
// the picture on a phone). The header lies over its top edge.
import type { Article } from '../../lib/cms-content'

const props = defineProps<{ block: BlockOf<'front'>; first?: boolean; articles: Article[] }>()
const { settings, name, words } = await useBlog()
const lead = computed(() => leadOf(props.articles))
const briefs = computed(() => briefsOf(props.articles))
const today = useToday()
const nameSize = computed(() => byLength(name.value, NAME_SIZES, NAME_SIZE_LONG))
const issue = computed(() => (today.value ? words.value.issue(isoWeek(today.value), today.value.date) : ''))
</script>

<template>
  <div class="relative">
    <section class="cover relative isolate text-white">
      <CmsImage v-if="lead?.image" :media="lead.image" eager sizes="100vw" class="absolute inset-x-0 top-0 -z-20 h-[33rem] w-full object-cover object-[10%_50%] lg:h-full lg:object-[50%_100%]" />
      <div class="cover-scrim absolute inset-x-0 top-0 -z-10 h-[33rem] lg:h-full" />

      <div class="wrap flex flex-col pt-16 lg:min-h-[max(100svh,820px)]">
        <!-- the name -->
        <div class="pt-1 text-center lg:pt-0">
          <component :is="first ? 'h1' : 'h2'" class="font-display font-light leading-[0.9] tracking-[-0.025em]" :class="nameSize" data-wordmark><NuxtLink to="/"><ObalkaWordmark /></NuxtLink></component>
          <p class="kicker halo mt-3 flex items-center justify-center gap-4 lg:mt-2">
            <span class="hidden h-px w-16 bg-white/50 sm:block" />
            <span>{{ settings?.tagline }} <span v-if="issue" class="hidden sm:inline">&nbsp;·&nbsp; {{ issue }}</span></span>
            <span class="hidden h-px w-16 bg-white/50 sm:block" />
          </p>
        </div>

        <!-- the lead article -->
        <article v-if="lead" class="pb-9 pt-56 lg:ml-auto lg:mt-auto lg:w-[49rem] lg:pb-11 lg:pt-10">
          <h2 v-if="block.question" class="mb-4 font-display text-[1.3rem] font-light italic leading-snug lg:text-[1.5rem]">{{ block.question }}</h2>
          <NuxtLink :to="articleHref(lead)" class="group block" data-lead>
            <p class="kicker">{{ lead.kind === 'column' ? words.column : lead.section.name }}</p>
            <h2 class="mt-3 font-display text-[2.05rem] font-light leading-[1.08] tracking-[-0.012em] sm:text-5xl lg:text-[3.5rem] lg:leading-[1.04]"><span class="lift">{{ tidyText(lead.title) }}</span></h2>
            <p v-if="lead.perex" class="mt-4 max-w-[40rem] font-display text-[1.08rem] leading-[1.5] text-white/95 lg:text-[1.22rem]">{{ tidyText(lead.perex) }}</p>
            <p class="byline mt-5 text-white/90"><span class="font-bold text-white">{{ lead.author.name }}</span> &nbsp;·&nbsp; {{ formatDate(lead.publishedAt) }} &nbsp;·&nbsp; {{ words.minRead(minutesOf(lead)) }}</p>
          </NuxtLink>
        </article>
      </div>
    </section>

    <!-- the cover lines: at the bottom right of the cover, under it on a phone -->
    <aside v-if="briefs.length" :aria-label="block.briefHeading || words.brief" class="wrap py-9 lg:pointer-events-none lg:absolute lg:inset-x-0 lg:bottom-11 lg:py-0 lg:text-white">
      <div class="lg:pointer-events-auto lg:w-[20.5rem]">
        <p class="kicker text-brand lg:text-white">{{ block.briefHeading }}</p>
        <ul class="mt-2 divide-y divide-line lg:divide-white/30">
          <li v-for="(a, i) in briefs" :key="a.id">
            <NuxtLink :to="articleHref(a)" class="block py-3.5" :class="i === briefs.length - 1 ? 'lg:pb-0' : ''">
              <span class="font-display text-[1.3rem] font-light italic leading-snug lg:text-[1.28rem]"><span class="lift">{{ tidyText(a.title) }}</span></span>
              <span class="byline mt-1 block text-quiet lg:text-white/85">{{ a.section.name }} &nbsp;·&nbsp; {{ words.min(minutesOf(a)) }}</span>
            </NuxtLink>
          </li>
        </ul>
      </div>
    </aside>
  </div>
</template>
