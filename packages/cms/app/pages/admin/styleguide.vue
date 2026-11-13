<script setup lang="ts">
// A tour of the admin's foundation: tokens, type, surfaces and the building blocks
// pages are made of. Doubles as the visual regression page for the design system.
definePageMeta({ layout: 'admin' })
const { t } = useCmsI18n()
useHead({ title: () => t('styleguide.title') })

const steps = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950]
const ramps = ['primary', 'neutral', 'success'] as const
const states = [
  { color: 'success', label: 'Success', use: 'Published, saved' },
  { color: 'info', label: 'Info', use: 'Scheduled, hints' },
  { color: 'warning', label: 'Warning', use: 'Unsaved or changed since publishing' },
  { color: 'error', label: 'Error', use: 'Validation, destructive actions' },
] as const
const accents = ['mono', 'indigo', 'blue', 'violet', 'emerald'] as const
const config = useCmsAdminConfig()
const accent = ref<string>(config.value.accent)
// Preview another accent on this page only (the layout restores the configured one on leave).
watch(accent, (a) => { if (import.meta.client) document.documentElement.dataset.cmsAccent = a })
onBeforeUnmount(() => { document.documentElement.dataset.cmsAccent = config.value.accent })

const colors = ['primary', 'neutral', 'success', 'warning', 'error'] as const
const variants = ['solid', 'outline', 'soft', 'subtle', 'ghost', 'link'] as const
const sample = ref('Domácí kváskový chléb')
const toggle = ref(true)
const option = ref('draft')
const brandColors = [
  { name: 'Charcoal', value: '#2E3035', use: 'The mascot' },
  { name: 'Ink', value: '#131313', use: 'Text, the wordmark' },
  { name: 'Cream', value: '#F9F5EF', use: 'Backgrounds, eye whites' },
] as const
const toc = [
  ['brand', 'tinyzoo'], ['color', 'Colour'], ['type', 'Typography'], ['surfaces', 'Surfaces & shape'],
  ['actions', 'Actions'], ['status', 'Status'], ['forms', 'Forms'], ['states', 'Empty & error states'],
] as const
</script>

<template>
  <CmsPage
    :title="t('styleguide.title')" :description="t('styleguide.description')"
    :breadcrumbs="[{ label: t('nav.home'), to: '/admin' }, { label: t('styleguide.title') }]"
  >
    <template #meta>
      <UFieldGroup>
        <UButton
          v-for="a in accents" :key="a" color="neutral" :variant="accent === a ? 'solid' : 'outline'"
          size="sm" class="capitalize" @click="accent = a"
        >{{ a }}</UButton>
      </UFieldGroup>
    </template>

    <nav aria-label="Sections" class="mb-8 flex flex-wrap gap-2">
      <UButton v-for="[id, label] in toc" :key="id" :to="`#${id}`" color="neutral" variant="soft" size="sm">{{ label }}</UButton>
    </nav>

    <div class="space-y-10">
      <section id="brand" class="space-y-4 scroll-mt-20">
        <h2 class="cms-display text-lg font-semibold text-highlighted">tinyzoo</h2>
        <p class="text-muted max-w-2xl">The admin carries the client's name; tinyzoo stays in the background — the sign-in footer, first-run setup, the tab icon and the animals in empty states. Brand guide: docs/brand/brand-guide.md (colour and type are still a working draft).</p>
        <div class="grid gap-3 md:grid-cols-2">
          <div class="cms-card p-8 grid place-items-center" style="background: var(--tz-cream)">
            <img :src="cmsBrand.logoUrl" alt="tinyzoo" class="h-10 w-auto">
          </div>
          <div class="cms-card p-8 grid place-items-center" style="background: var(--tz-charcoal)">
            <img :src="cmsBrand.logoReversedUrl" alt="tinyzoo" class="h-10 w-auto">
          </div>
        </div>
        <div class="grid gap-3 sm:grid-cols-3">
          <div v-for="c in brandColors" :key="c.name" class="cms-card p-4 flex items-center gap-3">
            <span class="size-9 rounded-md border border-default shrink-0" :style="{ backgroundColor: c.value }" />
            <span>
              <span class="block text-sm font-medium text-highlighted">{{ c.name }} <span class="font-mono text-xs text-muted">{{ c.value }}</span></span>
              <span class="block text-xs text-muted">{{ c.use }}</span>
            </span>
          </div>
        </div>
        <CmsSection title="The animals">
          <p class="text-sm text-muted mb-4">One flat colour, the same eyes, everyone looking up and to the right. The muted family appears in empty states (one per place, always the same); the bright six greet a fresh install.</p>
          <ul class="flex flex-wrap items-end gap-x-5 gap-y-4">
            <li v-for="c in cmsCharacters.muted" :key="c.name" class="flex flex-col items-center gap-1.5">
              <img :src="c.url" :alt="c.name" class="h-10 w-auto">
              <span class="text-[0.6875rem] text-muted">{{ c.name }}</span>
            </li>
          </ul>
          <ul class="mt-6 flex flex-wrap items-end gap-x-5 gap-y-4">
            <li v-for="c in cmsCharacters.bright" :key="c.name" class="flex flex-col items-center gap-1.5">
              <img :src="c.url" :alt="c.name" class="h-10 w-auto">
              <span class="text-[0.6875rem] text-muted">{{ c.name }}</span>
            </li>
          </ul>
        </CmsSection>
      </section>

      <section id="color" class="space-y-4 scroll-mt-20">
        <h2 class="cms-display text-lg font-semibold text-highlighted">Colour</h2>
        <p class="text-muted max-w-2xl">Neutral greys, black for primary actions. Colour appears only where it means something: status. A client's accent can replace black.</p>
        <CmsSection v-for="ramp in ramps" :key="ramp" :title="ramp">
          <div class="cms-ramp gap-1.5">
            <div v-for="s in steps" :key="s" class="space-y-1.5">
              <div class="h-12 rounded-md border border-default/50" :style="{ backgroundColor: `var(--ui-color-${ramp}-${s})` }" />
              <div class="text-[0.6875rem] text-muted tabular-nums text-center">{{ s }}</div>
            </div>
          </div>
        </CmsSection>
        <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div v-for="s in states" :key="s.color" class="cms-card p-4 flex items-start gap-3">
            <span class="mt-1 size-3 rounded-full shrink-0" :style="{ backgroundColor: `var(--ui-${s.color})` }" />
            <span>
              <span class="block text-sm font-medium text-highlighted">{{ s.label }}</span>
              <span class="block text-xs text-muted">{{ s.use }}</span>
            </span>
          </div>
        </div>
      </section>

      <section id="type" class="space-y-4 scroll-mt-20">
        <h2 class="cms-display text-lg font-semibold text-highlighted">Typography</h2>
        <div class="grid gap-4 lg:grid-cols-3">
          <CmsSection title="Titles — Geist semibold">
            <p class="cms-display text-2xl font-semibold leading-tight text-highlighted">Dobré ráno, Jano</p>
            <p class="mt-2 text-xs text-muted">Page titles 24 px, section titles 14–18 px. Tight tracking.</p>
          </CmsSection>
          <CmsSection title="Interface — Geist">
            <p class="text-sm text-highlighted font-medium">Uložit a zveřejnit</p>
            <p class="text-sm text-default">Body text in the interface is 14–15 px.</p>
            <p class="text-xs text-muted">Secondary text and metadata, 12–13 px.</p>
            <p class="mt-2 text-xs text-muted tabular-nums">Numbers: 1 234 · 12. 11. 2026 9:00</p>
          </CmsSection>
          <CmsSection title="Writing — Geist">
            <p class="cms-prose text-default">Rich text in the editor reads like the published page, so writers see their words as readers will.</p>
          </CmsSection>
        </div>
      </section>

      <section id="surfaces" class="space-y-4 scroll-mt-20">
        <h2 class="cms-display text-lg font-semibold text-highlighted">Surfaces &amp; shape</h2>
        <p class="text-muted max-w-2xl">Flat white surfaces separated by hairline borders, no shadows. One frame per group — never nested. Radius 6 px for controls, 9 px for cards.</p>
        <div class="grid gap-4 sm:grid-cols-3">
          <div class="cms-card p-5 text-sm">.cms-card</div>
          <div class="rounded-(--ui-radius) bg-elevated p-5 text-sm">bg-elevated (hover, selected)</div>
          <div class="rounded-(--ui-radius) border border-dashed border-accented p-5 text-sm text-muted">Drop zone / placeholder</div>
        </div>
      </section>

      <section id="actions" class="space-y-4 scroll-mt-20">
        <h2 class="cms-display text-lg font-semibold text-highlighted">Actions</h2>
        <p class="text-muted max-w-2xl">At most one solid primary button per view. Verbs on buttons ("Publish post", not "OK"). Destructive actions are red and always confirmed.</p>
        <CmsSection>
          <div class="space-y-3 overflow-x-auto">
            <div v-for="c in colors" :key="c" class="flex items-center gap-2">
              <span class="w-20 text-xs text-muted shrink-0">{{ c }}</span>
              <UButton v-for="v in variants" :key="v" :color="c" :variant="v" size="sm">{{ v }}</UButton>
            </div>
          </div>
        </CmsSection>
      </section>

      <section id="status" class="space-y-4 scroll-mt-20">
        <h2 class="cms-display text-lg font-semibold text-highlighted">Status</h2>
        <CmsSection>
          <div class="flex flex-wrap items-center gap-3">
            <CmsStatusBadge :published="false" />
            <CmsStatusBadge :published="true" />
            <UBadge color="info" variant="subtle" class="rounded-full">Scheduled · 12. 12. 9:00</UBadge>
            <UBadge color="warning" variant="subtle" class="rounded-full">Changed since publishing</UBadge>
            <UBadge color="neutral" variant="outline">3 items</UBadge>
          </div>
        </CmsSection>
      </section>

      <section id="forms" class="space-y-4 scroll-mt-20">
        <h2 class="cms-display text-lg font-semibold text-highlighted">Forms</h2>
        <div class="cms-card p-5 sm:p-6 space-y-6 max-w-2xl">
          <UFormField label="Name" description="Shown as the page heading." required :ui="{ label: 'font-medium text-highlighted' }">
            <UInput v-model="sample" class="w-full" />
          </UFormField>
          <UFormField label="Status" hint="optional" :ui="{ label: 'font-medium text-highlighted', hint: 'text-dimmed' }">
            <USelect v-model="option" :items="[{ label: 'Draft', value: 'draft' }, { label: 'Published', value: 'published' }]" class="w-full" />
          </UFormField>
          <UFormField label="Show on homepage" :ui="{ label: 'font-medium text-highlighted' }">
            <USwitch v-model="toggle" />
          </UFormField>
          <UFormField label="Email" error="Already in use" :ui="{ label: 'font-medium text-highlighted' }">
            <UInput model-value="jana@example.cz" class="w-full" />
          </UFormField>
        </div>
      </section>

      <section id="states" class="space-y-4 scroll-mt-20">
        <h2 class="cms-display text-lg font-semibold text-highlighted">Empty &amp; error states</h2>
        <div class="grid gap-4 lg:grid-cols-3">
          <div class="cms-card">
            <CmsEmptyState icon="i-lucide-newspaper" title="No posts yet" description="Articles on the blog. Drafts stay private until you publish them.">
              <template #actions><UButton icon="i-lucide-plus" size="sm">Create the first one</UButton></template>
            </CmsEmptyState>
          </div>
          <div class="cms-card">
            <CmsEmptyState variant="no-results" title="Nothing matches “chleba”" description="Try a different word, or clear the search.">
              <template #actions><UButton color="neutral" variant="outline" size="sm">Clear search</UButton></template>
            </CmsEmptyState>
          </div>
          <div class="cms-card">
            <CmsEmptyState variant="error" title="Could not load this list" description="The server did not answer.">
              <template #actions><UButton color="neutral" variant="outline" size="sm" icon="i-lucide-rotate-ccw">Try again</UButton></template>
            </CmsEmptyState>
          </div>
        </div>
      </section>
    </div>
  </CmsPage>
</template>
