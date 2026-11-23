<script setup lang="ts">
// An event's own page (/akce/…): the card of the nearest event drawn for this one, in the
// tint of its season, with its photograph beside it. A past event says so and tells how it went.
import type { Event as CalendarEvent } from '~/lib/cms-content'

const props = defineProps<{ entry: CalendarEvent }>()
const { words, today } = await useAssociation()
const events = await useEvents()
const { coming } = useCalendar(() => events.value)
const topic = useTopic()
const parts = computed(() => dayParts(props.entry.date)!)
const season = computed(() => seasonOfMonth(parts.value.month))
const past = computed(() => parts.value.key < today.value)
const left = computed(() => placesLeft(props.entry))
// (the next events beside a card that has no photograph)
const others = computed(() => coming.value.filter((e) => e.id !== props.entry.id).slice(0, 3))
const clock = computed(() => clockOf(parts.value))
const choose = () => { topic.value = signupTopic(props.entry, words.value) }
</script>

<template>
  <article class="bg-sand pb-20 pt-[calc(80px+2rem)] md:pb-24 md:pt-[calc(80px+3rem)]">
    <div class="wrap">
      <p><NuxtLink class="u tap gap-2" to="/akce"><UIcon name="i-lucide-arrow-left" class="size-[1em]" aria-hidden="true" /> {{ words.allEventsBack }}</NuxtLink></p>
      <div class="mt-6 grid gap-x-10 gap-y-10 lg:grid-cols-12">
        <div class="rounded-[28px] p-6 sm:p-8" :class="[TINT[season], entry.photo ? 'lg:col-span-7' : 'lg:col-span-8']">
          <p class="chip">{{ past ? words.pastEvent : words.seasons[season] }}</p>
          <p class="serif lnum mt-8 text-[clamp(6rem,10vw,8.5rem)] font-extrabold leading-[0.8] tracking-[-0.03em] text-ink">{{ parts.day }}.</p>
          <p class="serif mt-3 text-[1.5rem] font-semibold italic leading-tight text-ink">{{ words.whenLong(words.monthsOf[parts.month - 1]!, words.weekdaysOn[parts.weekday]!, hourOf(clock), hourOf(entry.endTime), past || parts.year !== Number(today.slice(0, 4)) ? parts.year : undefined) }}</p>
          <h1 class="mt-6 text-[clamp(2rem,3.2vw,2.7rem)]">{{ tidy(entry.title) }}</h1>
          <p v-if="entry.text || entry.summary" class="mt-3 text-ink">{{ tidy(entry.text || entry.summary) }}</p>
          <p v-if="past && entry.recap" class="mt-3 text-ink">{{ tidy(entry.recap) }}</p>
          <dl v-if="entry.place || entry.bring || (entry.signup && !past)" class="mt-6 space-y-3 rounded-[18px] bg-paper p-5 text-ink">
            <div v-if="entry.place" class="grid gap-x-3 gap-y-0.5 sm:grid-cols-[6.5rem_1fr]"><dt class="font-semibold">{{ words.where }}</dt><dd>{{ tidy(entry.place) }}</dd></div>
            <div v-if="entry.bring" class="grid gap-x-3 gap-y-0.5 sm:grid-cols-[6.5rem_1fr]" :class="entry.place ? 'border-t border-[var(--rule)] pt-3' : ''"><dt class="font-semibold">{{ words.bring }}</dt><dd>{{ tidy(sentence(entry.bring)) }}</dd></div>
            <div v-if="entry.signup && !past" class="grid gap-x-3 gap-y-0.5 sm:grid-cols-[6.5rem_1fr]" :class="entry.place || entry.bring ? 'border-t border-[var(--rule)] pt-3' : ''"><dt class="font-semibold">{{ words.signupLabel }}</dt><dd>{{ tidy(words.signupYes(signupBy(entry, words), entry.signupNote ?? '')) }}</dd></div>
          </dl>
          <div v-if="entry.signup && !past" class="mt-6 flex flex-wrap items-center gap-x-5 gap-y-3">
            <span v-if="left === 0" class="chip !bg-sand">{{ words.full }}</span>
            <NuxtLink v-else :to="`/#${anchorOf('contact')}`" class="btn" data-signup @click="choose">{{ entry.signupLabel || words.signUpLong }}</NuxtLink>
            <span v-if="left !== null || entry.registered" class="text-ink">{{ left === null ? words.soFar(entry.registered!) : words.placesLeft(left, entry.capacity!) }}</span>
          </div>
        </div>
        <div v-if="entry.photo" class="lg:col-span-5"><CmsImage :media="entry.photo" eager sizes="(min-width: 1024px) 32rem, 100vw" class="aspect-[4/5] w-full rounded-[28px] object-cover" /></div>
        <aside v-else-if="others.length" class="lg:col-span-4 lg:self-start">
          <p class="serif text-[1.9rem] font-semibold italic text-ink">{{ words.moreEvents }}</p>
          <ul class="mt-3 space-y-3">
            <li v-for="e in others" :key="e.id" class="card !rounded-[22px] p-5"><NuxtLink :to="`/akce/${e.slug}`" class="group block"><span class="serif lnum text-[1.6rem] font-extrabold leading-none text-ink">{{ dayParts(e.date)!.day }}. {{ words.monthsOf[dayParts(e.date)!.month - 1] }}</span><span class="serif mt-1 block text-[1.3rem] font-bold leading-[1.15] text-ink group-hover:text-brand">{{ tidy(e.title) }}</span></NuxtLink></li>
          </ul>
        </aside>
      </div>
    </div>
  </article>
</template>
