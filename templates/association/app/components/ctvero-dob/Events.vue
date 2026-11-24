<script setup lang="ts">
// Čtvero dob's calendar: the nearest event as a tall card in its season's tint, the coming ones
// beside it grouped by month, and below a look back at past events with a photograph (on a
// phone a row to swipe). What is coming and what is past depends on the day.
import type { Event as CalendarEvent } from '../../lib/cms-content'

const props = defineProps<{ block: BlockOf<'events'>; first?: boolean; anchor?: string; events: CalendarEvent[] }>()
const { words } = await useAssociation()
const { coming, past, nearest } = useCalendar(() => props.events)
const topic = useTopic()

const later = computed(() => coming.value.slice(1, 1 + (props.block.limit ?? 8)))
const more = computed(() => coming.value.length - 1 > later.value.length)
const groups = computed(() => groupByMonth(later.value))
const back = computed(() => past.value.filter((e) => e.photo).slice(0, props.block.pastLimit ?? 3))

const parts = (e: CalendarEvent) => dayParts(e.date)!
const season = (e: CalendarEvent) => seasonOfMonth(parts(e).month)
const clock = (e: CalendarEvent) => clockOf(parts(e))
const when = (e: CalendarEvent) => `${words.value.weekdays[parts(e).weekday]}${clock(e) ? ` ${clock(e)}` : ''}`
const left = (e: CalendarEvent) => placesLeft(e)
const choose = (e: CalendarEvent) => { topic.value = signupTopic(e, words.value) }
</script>

<template>
  <section :id="anchor" class="scroll-mt-6 bg-sand" :class="first ? 'pb-20 pt-[calc(80px+5rem)] md:pb-24 md:pt-[calc(80px+6rem)]' : 'py-20 md:py-24'">
    <div class="wrap">
      <div class="grid gap-6 lg:grid-cols-12 lg:items-end">
        <component :is="first ? 'h1' : 'h2'" class="h2 lg:col-span-7"><KitMarked :text="block.heading" /></component>
        <p v-if="block.text" class="text-[1.1rem] text-ink lg:col-span-5">{{ tidy(block.text) }}</p>
      </div>

      <p v-if="!nearest" class="mt-12 text-ink">{{ words.noEvents }}</p>
      <div v-else class="mt-12 grid gap-x-10 gap-y-10 lg:grid-cols-12">
        <!-- The nearest event -->
        <article class="rounded-[28px] p-6 sm:p-8 lg:col-span-5 lg:self-start" :class="TINT[season(nearest)]" data-nearest-card>
          <p class="chip">{{ words.nearest }}</p>
          <p class="serif lnum mt-8 text-[clamp(6rem,10vw,8.5rem)] font-extrabold leading-[0.8] tracking-[-0.03em] text-ink">{{ parts(nearest).day }}.</p>
          <p class="serif mt-3 text-[1.5rem] font-semibold italic leading-tight text-ink">{{ words.whenLong(words.monthsOf[parts(nearest).month - 1]!, words.weekdaysOn[parts(nearest).weekday]!, hourOf(clock(nearest)), hourOf(nearest.endTime)) }}</p>
          <h3 class="mt-6 text-[clamp(2rem,3.2vw,2.7rem)]"><NuxtLink :to="`/akce/${nearest.slug}`" class="hover:text-brand">{{ tidy(nearest.title) }}</NuxtLink></h3>
          <p v-if="nearest.text || nearest.summary" class="mt-3 text-ink">{{ tidy(nearest.text || nearest.summary) }}</p>
          <dl v-if="nearest.place || nearest.bring || nearest.signup" class="mt-6 space-y-3 rounded-[18px] bg-paper p-5 text-ink">
            <div v-if="nearest.place" class="grid gap-x-3 gap-y-0.5 sm:grid-cols-[6.5rem_1fr]"><dt class="font-semibold">{{ words.where }}</dt><dd>{{ tidy(nearest.place) }}</dd></div>
            <div v-if="nearest.bring" class="grid gap-x-3 gap-y-0.5 sm:grid-cols-[6.5rem_1fr]" :class="nearest.place ? 'border-t border-[var(--rule)] pt-3' : ''"><dt class="font-semibold">{{ words.bring }}</dt><dd>{{ tidy(sentence(nearest.bring)) }}</dd></div>
            <div v-if="nearest.signup" class="grid gap-x-3 gap-y-0.5 sm:grid-cols-[6.5rem_1fr]" :class="nearest.place || nearest.bring ? 'border-t border-[var(--rule)] pt-3' : ''"><dt class="font-semibold">{{ words.signupLabel }}</dt><dd>{{ tidy(words.signupYes(signupBy(nearest, words), nearest.signupNote ?? '')) }}</dd></div>
          </dl>
          <div class="mt-6 flex flex-wrap items-center gap-x-5 gap-y-3">
            <NuxtLink v-if="nearest.signup" :to="`/#${anchorOf('contact')}`" class="btn" data-signup @click="choose(nearest)">{{ nearest.signupLabel || words.signUpLong }}</NuxtLink>
            <NuxtLink v-else :to="`/akce/${nearest.slug}`" class="btn">{{ words.details }}</NuxtLink>
            <span v-if="nearest.signup && nearest.registered" class="text-ink">{{ words.soFar(nearest.registered) }}</span>
          </div>
        </article>

        <!-- The rest, by month -->
        <div class="lg:col-span-7">
          <template v-for="(g, gi) in groups" :key="g.key">
            <h3 class="serif flex items-baseline gap-3 text-[1.9rem] italic" :class="gi ? 'mt-8' : ''"><span class="font-semibold">{{ words.months[g.month - 1]!.replace(/^./, (c) => c.toUpperCase()) }}</span></h3>
            <ul class="mt-3 space-y-3">
              <li v-for="e in g.events" :key="e.id" class="card grid gap-x-5 gap-y-2 !rounded-[22px] p-5 sm:grid-cols-[5.25rem_1fr]" :data-event="e.slug">
                <p class="text-ink"><span class="serif lnum block text-[2.6rem] font-extrabold leading-[0.9]">{{ parts(e).day }}.</span><span class="text-[0.92rem] font-semibold">{{ when(e) }}</span></p>
                <div>
                  <div class="flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
                    <h4 class="serif text-[1.45rem] font-bold leading-[1.15] text-ink"><NuxtLink :to="`/akce/${e.slug}`" class="hover:text-brand">{{ tidy(e.title) }}</NuxtLink></h4>
                    <template v-if="e.signup">
                      <span v-if="left(e) === 0" class="chip !bg-sand">{{ words.full }}</span>
                      <NuxtLink v-else :to="`/#${anchorOf('contact')}`" class="chip !min-h-[44px] !bg-brand !text-brand-ink hover:!bg-ink" data-signup @click="choose(e)">{{ left(e) === null ? words.signUpLong : words.signUpFree(left(e)!, e.capacity!) }}</NuxtLink>
                    </template>
                    <span v-else class="chip !bg-sand">{{ words.noSignup }}</span>
                  </div>
                  <p class="mt-1">{{ tidy(eventLead(e)) }}<template v-if="e.bring">{{ ' ' }}<strong class="font-semibold text-ink">{{ tidy(words.bringShort) }}</strong> {{ tidy(sentence(e.bring)) }}</template></p>
                </div>
              </li>
            </ul>
          </template>
          <p v-if="more && block.allLabel && block.allUrl" class="mt-6"><NuxtLink class="u tap gap-2" :to="siteHref(block.allUrl)">{{ block.allLabel }} <UIcon name="i-lucide-arrow-right" class="size-[1em]" aria-hidden="true" /></NuxtLink></p>
        </div>
      </div>

      <!-- Looking back -->
      <div v-if="back.length" class="mt-20">
        <h3 class="text-[clamp(1.8rem,3vw,2.4rem)]"><KitMarked :text="block.lookbackHeading" /></h3>
        <UCarousel
          v-slot="{ item, index }" :items="back" align="start" drag-free
          :breakpoints="{ '(min-width: 768px)': { active: false } }" class="-mx-5 mt-7 md:mx-0"
          :ui="{ viewport: 'px-5 md:overflow-visible md:px-0', container: '-ms-5 items-stretch md:ms-0 md:grid md:grid-cols-3 md:items-start md:gap-8', item: 'basis-[calc(78%+4.4px)] ps-5 md:basis-auto md:ps-0' }"
        >
          <article :class="index % 2 ? 'md:translate-y-10' : ''">
            <CmsImage v-if="item.photo" :media="item.photo" sizes="(min-width: 1024px) 26rem, (min-width: 768px) 30vw, 80vw" class="aspect-[4/3] w-full rounded-[24px] object-cover" />
            <p class="mt-4 flex items-center gap-2 text-[0.95rem] font-semibold text-ink"><span class="h-3 w-3 rounded-full" :class="MARK[season(item)]" />{{ parts(item).day }}. {{ words.monthsOf[parts(item).month - 1] }} {{ parts(item).year }}</p>
            <h4 class="serif mt-1 text-[1.5rem] font-bold leading-[1.15] text-ink"><NuxtLink :to="`/akce/${item.slug}`" class="hover:text-brand">{{ tidy(item.title) }}</NuxtLink></h4>
            <p v-if="item.recap" class="mt-1.5 text-ink">{{ tidy(item.recap) }}</p>
          </article>
        </UCarousel>
        <div class="hidden md:block md:h-10" />
      </div>
    </div>
  </section>
</template>
