<script setup lang="ts">
// Zdivo's build: a house read from the footing up. Three concrete courses (the steps before the
// build), clay courses whose height follows their weeks (the stages), a timber course (the
// handover), the roof (the guarantee) and the topping-out tree on top. On a desktop the list is
// reversed visually, so the first step stands at the bottom, as a house is built; on a phone it
// runs top to bottom as a numbered list in the same colours.
const props = defineProps<{ block: BlockOf<'process'>; first?: boolean; anchor?: string }>()
const words = useSiteWords()
type Step = BlockOf<'process'>['steps'][number]
const courses = computed(() => {
  const before = stepsOf(props.block, 'before')
  const build = stagesOf(props.block).stages
  const after = stepsOf(props.block, 'after')
  const roof = after.length ? after[after.length - 1]! : null
  const timber = after.slice(0, -1)
  const all: Array<{ step: Step; n: number; kind: 'concrete' | 'clay' | 'timber' | 'roof'; tone?: string; height?: number }> = []
  let n = 0
  for (const step of before) all.push({ step, n: ++n, kind: 'concrete' })
  for (const [i, st] of build.entries()) all.push({ step: st.step, n: ++n, kind: 'clay', tone: i % 2 ? 'c-clay-d' : 'c-clay', height: 40 + st.weeks * 8 })
  for (const step of timber) all.push({ step, n: ++n, kind: 'timber' })
  if (roof) all.push({ step: roof, n: ++n, kind: 'roof' })
  return all
})
</script>

<template>
  <section :id="anchor" class="wrap scroll-mt-24 pt-20 lg:pt-28">
    <div class="grid gap-10 lg:grid-cols-12 lg:gap-8">
      <div class="lg:sticky lg:top-28 lg:col-span-4 lg:self-start">
        <p v-if="block.eyebrow" class="eyebrow">{{ block.eyebrow }}</p>
        <component :is="first ? 'h1' : 'h2'" class="h2" :class="block.eyebrow ? 'mt-2' : ''"><KitMarked :text="block.heading" as="span" /></component>
        <p v-if="block.text" class="mt-6 leading-[1.55]">{{ tidyText(block.text) }}</p>
        <div v-if="block.inspectionTitle || block.paymentsTitle" class="mt-8 space-y-2">
          <p v-if="block.inspectionTitle" class="rounded-[4px] bg-card p-5 text-[16px] leading-[1.5]"><strong class="font-display text-[22px] font-bold leading-none text-ink">{{ block.inspectionTitle }}</strong><br>{{ tidyText(block.inspectionText) }}</p>
          <p v-if="block.paymentsTitle" class="rounded-[4px] bg-card p-5 text-[16px] leading-[1.5]"><strong class="font-display text-[22px] font-bold leading-none text-ink">{{ block.paymentsTitle }}</strong><br>{{ tidyText(block.paymentsText) }}</p>
        </div>
        <p class="mt-8 hidden items-center gap-2 font-bold text-brand lg:flex"><UIcon name="i-lucide-arrow-up" class="size-5" aria-hidden="true" />{{ words.readFromBelow }}</p>
      </div>

      <ol class="flex flex-col gap-2 lg:col-span-8 lg:flex-col-reverse">
        <template v-for="c in courses" :key="c.n">
          <li v-if="c.kind === 'roof'" class="relative rounded-[4px] bg-ink px-6 py-5 text-plaster lg:mt-10 lg:rounded-none lg:px-0 lg:pb-6 lg:pt-[92px] lg:text-center lg:[clip-path:polygon(50%_0,100%_100%,0_100%)]">
            <p class="font-display text-[26px] font-bold leading-none lg:text-[30px]"><span class="mr-3 opacity-70 lg:hidden">{{ c.n }}</span>{{ [c.step.name, c.step.duration].filter(Boolean).join(' ') }}</p>
            <p class="mx-auto mt-2 max-w-[30em] text-[15px] leading-[1.4]">{{ tidyText(c.step.text) }}</p>
          </li>
          <li v-else class="course" :class="[c.kind === 'concrete' ? 'c-concrete' : c.kind === 'timber' ? 'c-timber' : [c.tone, 'lg:mx-7']]" :style="c.height ? { minHeight: `${c.height}px` } : undefined">
            <span class="n">{{ c.n }}</span><h3>{{ c.step.name }}</h3><p>{{ tidyText(c.step.text) }}</p><span class="d">{{ durationOf(c.step, words) }}</span>
          </li>
        </template>
        <li v-if="courses.some((c) => c.kind === 'roof')" class="hidden justify-center lg:-mb-12 lg:flex" aria-hidden="true">
          <svg viewBox="0 0 80 96" class="relative z-10 h-[96px] w-[80px]"><path d="M40 4v90" stroke="var(--ink)" stroke-width="3" /><path d="M40 6 26 30h9L20 52h11L14 76h52L49 52h11L45 30h9z" fill="#2f5d44" /><path d="M40 10c8 2 14 0 22-6M40 12c9 5 18 6 28 3M40 14c6 8 12 12 22 14" fill="none" stroke-width="3" stroke-linecap="round" /><path d="M40 10c8 2 14 0 22-6" fill="none" stroke="#d9a824" stroke-width="3" stroke-linecap="round" /><path d="M40 12c9 5 18 6 28 3" fill="none" stroke="#c8402a" stroke-width="3" stroke-linecap="round" /><path d="M40 14c6 8 12 12 22 14" fill="none" stroke="#3b6fb6" stroke-width="3" stroke-linecap="round" /></svg>
        </li>
      </ol>
    </div>
  </section>
</template>
