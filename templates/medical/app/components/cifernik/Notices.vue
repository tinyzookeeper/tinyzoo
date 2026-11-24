<script setup lang="ts">
// Ciferník's notices: the important one in a soft panel with its dates in a large disc, the
// others as white panels with a small round badge. Only what is valid today (the block hands
// in those); without any, nothing is drawn. The heading is for screen readers only.
import type { Notice } from '~/lib/cms-content'

const props = defineProps<{ block: BlockOf<'notices'>; first?: boolean; anchor?: string; notices: Notice[] }>()
const words = useSiteWords()
const split = computed(() => splitNotices(props.notices))
const mark = { class: 'num whitespace-nowrap font-bold' }
// "21.–31. prosince" → "21.–31." over "prosince"
const disc = (badge: string): [string, string] => { const at = badge.indexOf(' '); return at === -1 ? [badge, ''] : [badge.slice(0, at), badge.slice(at + 1)] }
</script>

<template>
  <section v-if="notices.length" :id="anchor" class="wrap pt-8 lg:pt-12">
    <component :is="first ? 'h1' : 'h2'" class="sr-only"><KitMarked :text="block.heading" plain /></component>
    <article v-if="split.main" data-notice class="rounded-[28px] bg-soft p-6 sm:p-8 lg:p-10 grid gap-6 lg:grid-cols-[auto_1fr] lg:gap-10 items-center">
      <div class="grid place-items-center size-[8.5rem] lg:size-[11rem] rounded-full bg-brand text-brand-ink text-center">
        <p v-if="split.main.badge" class="disp !text-brand-ink leading-none"><span class="block text-[2.3rem] lg:text-[3rem] font-medium num">{{ disc(split.main.badge)[0] }}</span><span v-if="disc(split.main.badge)[1]" class="block mt-1.5 text-[1.05rem] lg:text-[1.25rem]">{{ disc(split.main.badge)[1] }}</span></p>
        <UIcon v-else :name="NOTICE_ICONS[split.main.icon]!" class="ic size-[3.4rem]" aria-hidden="true" />
      </div>
      <div>
        <p class="inline-block rounded-full bg-ink text-paper font-extrabold uppercase tracking-[.1em] text-[.78rem] px-3 py-1">{{ words.important }}</p>
        <h3 class="mt-3 text-[2rem] lg:text-[2.6rem]">{{ tidyText(split.main.title) }}</h3>
        <p class="mt-3 text-ink max-w-[44rem] text-[1.08rem]"><KitMarked :text="noticeParts(split.main.text).first" as="span" :attrs="mark" /><template v-for="(more, i) in noticeParts(split.main.text).more" :key="i">{{ ' ' }}<strong><KitMarked :text="more" as="span" :attrs="mark" /></strong></template></p>
      </div>
    </article>
    <div v-if="split.rest.length" class="grid gap-4 md:grid-cols-2" :class="split.main ? 'mt-4' : ''">
      <article v-for="n in split.rest" :key="n.id" data-notice class="panel p-6 sm:p-7 flex gap-5 items-start">
        <span v-if="n.badge" class="grid place-items-center size-14 rounded-full bg-track text-ink shrink-0 disp text-[1.15rem] font-medium num text-center leading-none">{{ n.badge }}</span>
        <span v-else class="grid place-items-center size-14 rounded-full bg-sun text-ink shrink-0"><UIcon :name="NOTICE_ICONS[n.icon]!" class="ic size-[26px]" aria-hidden="true" /></span>
        <div>
          <h3 class="text-[1.45rem]">{{ tidyText(n.title) }}</h3>
          <p class="mt-2"><KitMarked :text="n.text" as="span" :attrs="mark" /></p>
        </div>
      </article>
    </div>
  </section>
</template>
