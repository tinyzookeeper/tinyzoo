<script setup lang="ts">
// The start page of the hosted product: what you get, in a few plain sentences, and the way in.
const t = useT()
const { account } = useAccount()
useHead({ title: () => t('home.metaTitle') })

const peekers = [
  { animal: 'elephant', up: true },
  { animal: 'fox', up: true },
  { animal: 'owl', up: true, busy: true },
  { animal: 'panda', up: true },
]
// What you get, for real: the websites of the templates that exist, one after another. The
// same photographer's site in its three looks, then the plain one.
const demos = computed(() => [
  { template: 'photographer', look: 'atelier', name: t('home.demoPhotographer'), slug: t('home.demoPhotographerSlug') },
  { template: 'photographer', look: 'negativ', name: t('home.demoPhotographer'), slug: t('home.demoPhotographerSlug') },
  { template: 'photographer', look: 'zapisnik', name: t('home.demoPhotographer'), slug: t('home.demoPhotographerSlug') },
  { template: 'basic', look: null, name: t('home.demoName'), slug: t('home.demoSlug') },
])
const at = ref(0)
const demo = computed(() => demos.value[at.value % demos.value.length]!)
let turn: ReturnType<typeof setInterval> | null = null
onMounted(() => {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
  turn = setInterval(() => { at.value = (at.value + 1) % demos.value.length }, 3800)
})
onBeforeUnmount(() => { if (turn) clearInterval(turn) })
const steps = computed(() => [
  { animal: 'chick', title: t('home.step1Title'), text: t('home.step1Text') },
  { animal: 'koala', title: t('home.step2Title'), text: t('home.step2Text') },
  { animal: 'raccoon', title: t('home.step3Title'), text: t('home.step3Text') },
])
const gets = computed(() => [
  { icon: 'i-lucide-panels-top-left', title: t('home.get1Title'), text: t('home.get1Text') },
  { icon: 'i-lucide-pencil-line', title: t('home.get2Title'), text: t('home.get2Text') },
  { icon: 'i-lucide-languages', title: t('home.get3Title'), text: t('home.get3Text') },
  { icon: 'i-lucide-users-round', title: t('home.get4Title'), text: t('home.get4Text') },
])
</script>

<template>
  <div>
    <!-- The opening: cream, the promise in one line, the picture of what you get. -->
    <section class="bg-(--z-moment-bg)">
      <div class="mx-auto grid w-full max-w-6xl items-center gap-10 px-4 pt-12 pb-14 sm:px-6 lg:grid-cols-[1.05fr_1fr] lg:gap-14 lg:pt-20 lg:pb-24">
        <div>
          <p class="z-rise mb-5 inline-flex items-center gap-2 rounded-full border border-(--z-moment-line) bg-(--z-surface) px-3 py-1 text-[0.8125rem] font-medium text-highlighted">
            <span class="size-1.5 rounded-full bg-(--z-ok)" />
            {{ t('home.kicker') }}
          </p>
          <h1 class="z-display z-rise z-rise-1 text-[2.5rem] leading-[1.04] text-balance text-highlighted sm:text-6xl lg:text-[4.25rem]">{{ t('home.title') }}</h1>
          <p class="z-moment-text z-rise z-rise-2 mt-5 max-w-xl text-lg leading-relaxed text-pretty">{{ t('home.lead') }}</p>
          <div class="z-rise z-rise-3 mt-8 flex flex-wrap items-center gap-3">
            <UButton to="/new" :label="t('home.cta')" size="xl" trailing-icon="i-lucide-arrow-right" class="px-5" data-cta />
            <UButton to="/login" :label="t('home.signIn')" size="xl" color="neutral" variant="ghost" />
          </div>
          <p class="z-moment-text z-rise z-rise-4 mt-4 text-sm">{{ t('home.note', { max: account.sites.max }) }}</p>
        </div>
        <div class="z-rise z-rise-2 mx-auto w-full max-w-md lg:max-w-none">
          <MiniSite :name="demo.name" :address="`${demo.slug}${account.siteHost}`" :peekers="peekers" :template="demo.template" :look="demo.look" data-demo :data-demo-look="demo.look ?? demo.template" />
        </div>
      </div>
    </section>

    <!-- How it goes: three steps, each with its animal. -->
    <section class="mx-auto w-full max-w-6xl px-4 py-14 sm:px-6 lg:py-20">
      <h2 class="z-display max-w-2xl text-3xl leading-tight text-balance text-highlighted sm:text-4xl">{{ t('home.howTitle') }}</h2>
      <ol class="mt-8 grid gap-4 md:grid-cols-3">
        <li v-for="(s, i) in steps" :key="s.title" class="z-card flex flex-col overflow-hidden">
          <div class="flex h-28 items-end justify-between bg-(--z-moment-bg) px-5">
            <span class="z-display pb-3 text-5xl text-(--z-moment-line)">{{ i + 1 }}</span>
            <ZAnimal :name="s.animal" class="h-20 w-auto translate-y-px" />
          </div>
          <div class="p-5">
            <h3 class="z-title text-lg text-highlighted">{{ s.title }}</h3>
            <p class="mt-1.5 text-[0.9375rem] leading-relaxed text-pretty text-muted">{{ s.text }}</p>
          </div>
        </li>
      </ol>
    </section>

    <!-- What you get. -->
    <section class="mx-auto w-full max-w-6xl px-4 pb-14 sm:px-6 lg:pb-20">
      <div class="grid gap-x-12 gap-y-8 lg:grid-cols-[1fr_1.6fr]">
        <div>
          <h2 class="z-display text-3xl leading-tight text-balance text-highlighted sm:text-4xl">{{ t('home.getTitle') }}</h2>
          <p class="mt-3 max-w-sm leading-relaxed text-pretty text-muted">{{ t('home.getLead') }}</p>
        </div>
        <dl class="grid gap-x-10 gap-y-7 sm:grid-cols-2">
          <div v-for="g in gets" :key="g.title">
            <dt class="flex items-center gap-2.5 font-semibold text-highlighted">
              <span class="inline-flex size-8 items-center justify-center rounded-lg bg-(--z-moment-bg)"><UIcon :name="g.icon" class="size-[1.125rem]" /></span>
              {{ g.title }}
            </dt>
            <dd class="mt-2 text-[0.9375rem] leading-relaxed text-pretty text-muted">{{ g.text }}</dd>
          </div>
        </dl>
      </div>
    </section>

    <section class="mx-auto w-full max-w-6xl px-4 pb-16 sm:px-6">
      <ZBanner :title="t('home.endTitle')" :text="t('home.endText')" animal="lion">
        <template #actions>
          <UButton to="/new" :label="t('home.cta')" size="lg" trailing-icon="i-lucide-arrow-right" />
        </template>
      </ZBanner>
    </section>
  </div>
</template>
