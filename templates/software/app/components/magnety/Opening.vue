<script setup lang="ts">
// Magnets' opening: the heading set as three shift bars staggered across a week grid, a few shifts
// of the board around it, a photograph tile and the notification a person gets. Under it the
// text and the button.
const props = defineProps<{ block: BlockOf<'opening'>; first?: boolean; anchor?: string }>()
const words = useSiteWords()
const board = computed(() => words.value.screens.board)
const bars = computed(() => barsOf(props.block.heading))
const size = computed(() => byLength(props.block.heading, [[22, 'text-[64px] sm:text-[88px] lg:text-[104px]'], [34, 'text-[48px] sm:text-[64px] lg:text-[76px]']], 'text-[36px] sm:text-[48px] lg:text-[56px]'))
</script>

<template>
  <div :id="anchor" class="bg-brand">
    <section class="wrap pb-12 pt-2 lg:pb-16 lg:pt-4">
      <div class="hidden grid-cols-7 gap-2.5 lg:grid" aria-hidden="true">
        <span v-for="(d, i) in board.days" :key="i" class="mono flex items-center gap-2 py-2">{{ d[0] }} <i v-if="d[1]" class="rounded-full px-2 py-0.5 not-italic" :class="i === 0 ? 'bg-ink text-cream' : 'bg-cream'">{{ d[1] }}</i></span>
      </div>
      <div class="grid grid-cols-4 gap-2 lg:grid-cols-7 lg:grid-rows-[repeat(3,128px)] lg:gap-2.5">
        <component :is="first ? 'h1' : 'h2'" class="contents">
          <span class="bar col-span-4 h-[84px] w-fit bg-cream sm:h-[110px] lg:col-span-3 lg:col-start-1 lg:row-start-1 lg:h-auto lg:w-auto" :class="size">{{ bars[0] }}</span>{{ ' ' }}
          <span class="bar col-span-4 ml-8 h-[84px] w-fit bg-ink text-cream sm:ml-24 sm:h-[110px] lg:col-span-3 lg:col-start-2 lg:row-start-2 lg:ml-0 lg:h-auto lg:w-auto" :class="size">{{ bars[1] }}</span>{{ ' ' }}
          <span v-if="bars[2]" class="bar col-span-4 ml-16 h-[84px] w-fit bg-sky sm:ml-48 sm:h-[110px] lg:col-span-3 lg:col-start-3 lg:row-start-3 lg:ml-0 lg:h-auto lg:w-auto" :class="size">{{ bars[2] }}</span>
        </component>
        <div class="chip hidden bg-cream lg:col-start-4 lg:row-start-1 lg:flex"><b>{{ board.chips.marek![0] }}</b><span>{{ board.chips.marek![1] }}</span></div>
        <div class="chip hidden border-2 border-dashed border-ink lg:col-start-5 lg:row-start-1 lg:flex"><b>{{ board.chips.free![0] }}</b><span>{{ board.chips.free![1] }}</span></div>
        <div class="chip hidden bg-cream lg:col-start-1 lg:row-start-2 lg:flex"><b>{{ board.chips.bara![0] }}</b><span>{{ board.chips.bara![1] }}</span></div>
        <div class="chip hidden bg-cream lg:col-start-5 lg:row-start-2 lg:flex"><b>{{ board.chips.simon![0] }}</b><span>{{ board.chips.simon![1] }}</span></div>
        <div class="chip hidden bg-ink text-cream lg:col-start-1 lg:row-start-3 lg:flex"><b>{{ board.chips.marekLate![0] }}</b><span>{{ board.chips.marekLate![1] }}</span></div>
        <div class="chip col-span-2 mt-2 bg-cream lg:col-span-1 lg:col-start-2 lg:row-start-3 lg:mt-0"><b>{{ board.chips.morning![0] }}</b><span>{{ board.chips.morning![1] }}</span></div>
        <div class="chip col-span-2 mt-2 bg-ink text-cream lg:hidden"><b>{{ board.chips.afternoon![0] }}</b><span>{{ board.chips.afternoon![1] }}</span></div>
        <CmsImage v-if="block.photo" :media="block.photo" eager sizes="(min-width: 1024px) 28rem, 100vw" class="col-span-4 aspect-[16/10] w-full rounded-[20px] object-cover object-[80%_50%] lg:col-span-2 lg:col-start-6 lg:row-span-2 lg:row-start-1 lg:aspect-auto lg:h-full" />
        <div class="col-span-4 flex items-center gap-3 rounded-[20px] bg-board p-3.5 lg:col-span-2 lg:col-start-6 lg:row-start-3 lg:gap-4 lg:p-5">
          <svg viewBox="0 0 20 20" class="h-10 w-10 flex-none" aria-hidden="true"><circle cx="10" cy="10" r="10" fill="var(--brand)" /><path d="M10 0a10 10 0 0 1 0 20z" fill="var(--ink)" /></svg>
          <p class="min-w-0 text-[15px] leading-snug"><span class="mono block text-[10px] opacity-70">{{ board.noticeFrom }}</span><b class="font-semibold">{{ board.noticeBold }}</b> {{ board.noticeRest }}</p>
        </div>
      </div>

      <div class="mt-8 grid gap-6 lg:mt-10 lg:grid-cols-7 lg:gap-2.5">
        <p v-if="block.text" class="text-[19px] leading-[1.45] lg:col-span-4 lg:text-[22px]"><KitMarked :text="block.text" as="b" :attrs="{ class: 'font-semibold' }" /></p>
        <div class="lg:col-span-3 lg:col-start-5 lg:pl-6">
          <SiteLink v-if="block.primaryLabel && block.primaryUrl" class="btn btn-ink w-full sm:w-auto" :to="block.primaryUrl">{{ tidyText(block.primaryLabel) }} <UIcon name="i-lucide-arrow-right" class="size-5" aria-hidden="true" /></SiteLink>
          <p v-if="block.note" class="mt-3 text-[15px] font-medium">{{ tidyText(block.note) }}</p>
        </div>
      </div>
    </section>
  </div>
</template>
