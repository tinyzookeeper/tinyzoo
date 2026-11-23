<script setup lang="ts">
// Talíř's opening: a headline as wide as the page on the brand colour, under it a row of three
// things (the words and two buttons, a closed box of facts, a plate with a round sticker that
// leads to the lunch), and the room full width below.
const props = defineProps<{ block: BlockOf<'opening'>; first?: boolean; anchor?: string; from?: number | null }>()
const { address, phone, tel, words, state, openText } = await useRestaurant()
const w = computed(() => words.value.talir)
const open = computed(() => openText(w.value.open))
// The heading with its marks taken off.
const headline = computed(() => props.block.heading.replace(/\*/g, '').trim())
// (its last word stands on a line of its own: "Přijďte / hladoví.")
const split = computed(() => {
  const text = tidyText(headline.value)
  const at = text.lastIndexOf(' ')
  return at === -1 ? [text, ''] : [text.slice(0, at + 1), text.slice(at + 1)]
})
// A longer headline needs smaller type to stay inside the page.
const size = computed(() => byLength(headline.value, [
  [18, 'text-[clamp(3rem,14.3vw,6rem)] lg:text-[clamp(6rem,11.4vw,12.4rem)]'],
  [34, 'text-[clamp(2.2rem,9.5vw,4.2rem)] lg:text-[clamp(4rem,7.4vw,8.4rem)]'],
], 'text-[clamp(1.8rem,7vw,3.4rem)] lg:text-[clamp(3rem,5.2vw,6rem)]'))
const plate = computed(() => props.block.plateImage ?? null)
</script>

<template>
  <div :id="anchor">
    <div class="on-brand bg-brand text-brand-ink">
      <section class="wrap pt-3 lg:pt-7 pb-10 lg:pb-14">
        <component :is="first ? 'h1' : 'h2'" class="wide" :class="size">{{ split[0] }}<span v-if="split[1]" class="block">{{ split[1] }}</span></component>
        <!-- the row under the headline: text, the table of facts (the only ruled thing here), the plate -->
        <div class="mt-6 lg:mt-11 grid lg:grid-cols-12 gap-y-8 lg:gap-x-10">
          <div class="lg:col-span-4">
            <p v-if="block.text" class="text-[1.2rem] lg:text-[1.3rem] leading-[1.4] font-medium max-w-[30rem] lg:-mt-1.5">{{ tidyText(block.text) }}</p>
            <div class="mt-6 lg:mt-7 flex flex-wrap gap-3">
              <NuxtLink v-if="block.primaryLabel && block.primaryUrl" class="btn btn-solid" :to="siteHref(block.primaryUrl)">{{ block.primaryLabel }}</NuxtLink>
              <NuxtLink v-if="block.secondaryLabel && block.secondaryUrl" class="btn btn-line" :to="siteHref(block.secondaryUrl)">{{ block.secondaryLabel }}</NuxtLink>
            </div>
          </div>
          <dl class="lg:col-span-4 grid grid-cols-1 md:grid-cols-3 lg:grid-cols-1 auto-rows-fr border-2 border-brand-ink divide-brand-ink divide-y-2 md:divide-y-0 md:divide-x-2 lg:divide-x-0 lg:divide-y-2">
            <div v-if="open" class="py-4 px-5 lg:px-7 flex flex-col justify-center">
              <dt class="cap">{{ w.factOpen }}</dt>
              <dd class="num text-[1.6rem] lg:text-[1.75rem] mt-1.5" data-open :data-state="state?.open ? 'open' : 'closed'"><span class="dot" /><span data-open-text>{{ open }}</span></dd>
            </div>
            <div v-if="address" class="py-4 px-5 lg:px-7 flex flex-col justify-center">
              <dt class="cap">{{ w.factWhere }}</dt>
              <dd class="num text-[1.6rem] lg:text-[1.75rem] mt-1.5"><NuxtLink class="ulink" :to="`/#${anchorOf('hours')}`">{{ address }}</NuxtLink></dd>
            </div>
            <div v-if="phone" class="py-4 px-5 lg:px-7 flex flex-col justify-center">
              <dt class="cap">{{ w.factBook }}</dt>
              <dd class="num text-[1.6rem] lg:text-[1.75rem] mt-1.5"><a class="ulink" :href="tel">{{ phone }}</a></dd>
            </div>
          </dl>
          <div class="lg:col-span-4 flex justify-center lg:justify-end lg:items-start">
            <div v-if="plate" class="relative w-[78%] max-w-[22rem] lg:w-[min(25rem,100%)] lg:max-w-none lg:-mb-32 z-10">
              <CmsImage :media="plate" eager sizes="(min-width: 1024px) 25rem, 78vw" class="plate shadow-[0_0_0_2px_var(--brand-ink)]" />
              <NuxtLink :to="`/#${anchorOf('lunch')}`" class="absolute -left-6 xl:-left-10 bottom-0 lg:bottom-6 w-[8.2rem] h-[8.2rem] rounded-full bg-brand-ink text-brand flex flex-col items-center justify-center text-center -rotate-12 transition-transform hover:rotate-0">
                <span class="cap !text-[.78rem]">{{ w.sticker }}</span>
                <span v-if="from != null" class="num text-[1.7rem] mt-1">{{ words.fromPrice(formatPrice(from)) }}</span>
              </NuxtLink>
            </div>
          </div>
        </div>
      </section>
    </div>

    <!-- the room, full width -->
    <figure v-if="block.image" class="border-y-2 border-ink">
      <CmsImage :media="block.image" eager sizes="100vw" class="w-full aspect-[4/3] md:aspect-[21/9] object-cover" />
    </figure>
  </div>
</template>
