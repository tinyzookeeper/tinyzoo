<script setup lang="ts">
// One Day's features, 07:00: each is a moment of the day, told in the layout of the screen it is
// about: notifications stacked beside the text; a photograph with the attendance card laid over
// it; the week grid on a card under the text; a photograph beside the payroll table.
import type { Feature } from '../../lib/cms-content'

defineProps<{ block: BlockOf<'features'>; first?: boolean; anchor?: string; items: Feature[] }>()
// The first moment is closer to the heading than the rest are to each other.
const gap = (i: number) => (i === 0 ? 'mt-14 lg:mt-20' : 'mt-16 lg:mt-28')
const layout = (f: Feature) => (f.screen === 'attendance' ? 'overlap' : f.screen === 'payroll' ? 'beside' : f.screen === 'week' || f.screen === 'template' ? 'under' : 'cards')
</script>

<template>
  <section :id="anchor" class="bg-morning">
    <div class="wrap lg:grid lg:grid-cols-[150px_1fr]">
      <JedenDenRail class="pt-12 lg:pt-24" :time="block.time" :note="block.timeNote" />
      <div class="pb-16 pt-6 lg:pb-28 lg:pl-14 lg:pt-24">
        <component :is="first ? 'h1' : 'h2'" class="h2 max-w-[18ch] text-[36px] sm:text-[46px] lg:text-[52px]"><KitMarked :text="block.heading" /></component>
        <p v-if="block.text" class="mt-5 max-w-[36rem]">{{ tidyText(block.text) }}</p>

        <template v-for="(f, i) in items" :key="f.id">
          <!-- notifications beside the text -->
          <article v-if="layout(f) === 'cards'" class="grid gap-8 lg:grid-cols-12 lg:items-center lg:gap-10" :class="gap(i)">
            <div class="lg:col-span-6">
              <p v-if="f.when" class="time text-brand">{{ f.when }}</p>
              <h3 class="h2 mt-3 text-[28px] lg:text-[34px]">{{ tidyText(f.title) }}</h3>
              <p v-if="f.text" class="mt-4 max-w-[33rem]">{{ tidyText(f.text) }}</p>
              <p v-if="f.note" class="mt-4 max-w-[33rem] text-[16px] opacity-85">{{ tidyText(f.note) }}</p>
            </div>
            <div v-if="f.image || f.screen !== 'none'" class="lg:col-span-6"><JedenDenScreen :kind="f.screen" :image="f.image" place="feature" /></div>
          </article>

          <!-- a photograph with the card laid over it -->
          <article v-else-if="layout(f) === 'overlap'" :class="gap(i)">
            <div class="relative">
              <CmsImage v-if="f.photo" :media="f.photo" sizes="(min-width: 1280px) 64rem, 100vw" class="aspect-[4/3] w-full rounded-[22px] object-cover sm:aspect-[16/9] lg:aspect-[21/10]" />
              <JedenDenScreen :kind="f.screen" :image="f.image" place="feature" :class="f.photo ? 'relative z-10 mx-3 -mt-12 lg:absolute lg:-bottom-20 lg:right-8 lg:mx-0 lg:mt-0 lg:w-[430px]' : ''" />
            </div>
            <div class="mt-8" :class="f.photo ? 'lg:max-w-[calc(100%-500px)]' : ''">
              <p v-if="f.when" class="time text-brand">{{ f.when }}</p>
              <h3 class="h2 mt-3 text-[28px] lg:text-[34px]">{{ tidyText(f.title) }}</h3>
              <p v-if="f.text" class="mt-4 max-w-[33rem]">{{ tidyText(f.text) }}</p>
              <p v-if="f.note" class="mt-4 max-w-[33rem] text-[16px] opacity-85">{{ tidyText(f.note) }}</p>
            </div>
          </article>

          <!-- the screen on a card under the text -->
          <article v-else-if="layout(f) === 'under'" :class="gap(i)">
            <div class="grid gap-x-10 gap-y-4 lg:grid-cols-12">
              <div class="lg:col-span-6">
                <p v-if="f.when" class="time text-brand">{{ f.when }}</p>
                <h3 class="h2 mt-3 text-[28px] lg:text-[34px]">{{ tidyText(f.title) }}</h3>
              </div>
              <div class="lg:col-span-6 lg:pt-1">
                <p v-if="f.text">{{ tidyText(f.text) }}</p>
                <p v-if="f.note" class="mt-3 text-[16px] opacity-85">{{ tidyText(f.note) }}</p>
              </div>
            </div>
            <JedenDenScreen :kind="f.screen" :image="f.image" place="feature" class="mt-8" />
          </article>

          <!-- a photograph beside the text and the table -->
          <article v-else class="grid gap-8 lg:grid-cols-12 lg:items-center lg:gap-10" :class="gap(i)">
            <CmsImage v-if="f.photo" :media="f.photo" sizes="(min-width: 1024px) 28rem, 100vw" class="aspect-[4/3] w-full rounded-[22px] object-cover object-[62%_50%] lg:col-span-5 lg:aspect-[4/5]" />
            <div :class="f.photo ? 'lg:col-span-7' : 'lg:col-span-12'">
              <p v-if="f.when" class="time text-brand">{{ f.when }}</p>
              <h3 class="h2 mt-3 text-[28px] lg:text-[34px]">{{ tidyText(f.title) }}</h3>
              <p v-if="f.text" class="mt-4 max-w-[35rem]">{{ tidyText(f.text) }}</p>
              <JedenDenScreen v-if="f.image || f.screen !== 'none'" :kind="f.screen" :image="f.image" place="feature" class="mt-7" />
              <p v-if="f.note" class="mt-4 text-[16px] opacity-85">{{ tidyText(f.note) }}</p>
            </div>
          </article>
        </template>
      </div>
    </div>
  </section>
</template>
