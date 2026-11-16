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
// A live sectioned form, as every form and preview editor uses (see CmsFormSections).
const demoFields = [
  { key: 'kind', type: 'select', ui: { edit: 'CmsFieldSelect' }, meta: {
    label: { en: 'Kind', cs: 'Druh', de: 'Art' }, options: ['race', 'club', 'camp'],
    labels: { race: { en: 'Race', cs: 'Závod', de: 'Wettkampf' }, club: { en: 'Club', cs: 'Klub', de: 'Verein' }, camp: { en: 'Camp', cs: 'Soustředění', de: 'Trainingslager' } },
    icons: { race: 'i-lucide-trophy', club: 'i-lucide-users', camp: 'i-lucide-tent' },
  } },
  { key: 'organised', type: 'boolean', ui: { edit: 'CmsFieldBoolean' }, meta: { label: { en: 'We organise it', cs: 'Pořádáme ji my', de: 'Wir veranstalten es' }, help: { en: 'It gets an “Organised by us” label in the calendar.', cs: 'V kalendáři dostane štítek „Pořádáme“.', de: 'Erhält im Kalender die Kennzeichnung „Von uns veranstaltet“.' } } },
  { key: 'startsAt', type: 'datetime', ui: { edit: 'CmsFieldDate' }, meta: { label: { en: 'Starts', cs: 'Začátek', de: 'Beginn' }, allDay: true } },
  { key: 'endsAt', type: 'datetime', optional: true, ui: { edit: 'CmsFieldDate' }, meta: { label: { en: 'Ends', cs: 'Konec', de: 'Ende' }, allDay: true } },
  { key: 'place', type: 'text', optional: true, ui: { edit: 'CmsFieldText' }, meta: { label: { en: 'Place', cs: 'Místo', de: 'Ort' }, icon: 'i-lucide-map-pin' } },
  { key: 'url', type: 'text', optional: true, ui: { edit: 'CmsFieldText' }, meta: { label: { en: 'Link to entries', cs: 'Odkaz na přihlášky', de: 'Link zur Anmeldung' }, format: 'link' } },
]
const demoSections = [
  { label: { en: 'What is it?', cs: 'Co je to za akci?', de: 'Was für eine Veranstaltung?' }, icon: 'i-lucide-tag', fields: ['kind', 'organised'] },
  { label: { en: 'When?', cs: 'Kdy?', de: 'Wann?' }, icon: 'i-lucide-calendar', fields: ['startsAt', 'endsAt'] },
  { label: { en: 'Where?', cs: 'Kde?', de: 'Wo?' }, icon: 'i-lucide-map-pin', description: { en: 'Empty optional fields wait behind “+ Add”.', cs: 'Prázdná nepovinná pole čekají za „+ Přidat“.', de: 'Leere optionale Felder erscheinen unter „+ Hinzufügen“.' }, fields: ['place', 'url'] },
]
const demo = reactive<Record<string, any>>({ kind: 'race', organised: true, startsAt: '2026-06-13T07:00:00.000Z', endsAt: null, place: 'Koupaliště Ostrov, Tábor', url: null })
const soon = '2030-06-01T07:00:00.000Z' // fixed: the same on the server and in the browser
const brandColors = [
  { name: 'Charcoal', value: '#2E3035', use: 'The mascot · primary actions · dark-mode surfaces' },
  { name: 'Ink', value: '#131313', use: 'Text · the wordmark' },
  { name: 'Cream', value: '#F9F5EF', use: 'Moments · dark-mode text and primary' },
] as const
const toc = [
  ['brand', 'tinyzoo'], ['color', 'Colour'], ['type', 'Typography'], ['surfaces', 'Surfaces & shape'],
  ['moments', 'Moments'], ['editors', 'Editors & lists'],
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
        <p class="text-muted max-w-2xl">Playful, calm, simple. The client's name leads; tinyzoo signs the sidebar and the sign-in, gives the tab its icon, and sends one animal to each moment. Brand guide: docs/brand/brand-guide.md.</p>
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
          <p class="text-sm text-muted mb-4">One flat colour, the same eyes, everyone looking up and to the right. One animal per moment, never in the chrome: the hedgehog at sign-in, the owl on the welcome, the bird before publishing, the whale when it's live (the turtle when it's scheduled), a muted animal per empty place. The bright six greet a fresh install.</p>
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
        <p class="text-muted max-w-2xl">Light: a white workspace with true greys and ink text, charcoal for the one primary action, cream only for moments. Dark ("charcoal night"): greys tinted toward the charcoal, cream text, and a cream primary. Colour otherwise appears only where it means something: status. A client's accent can replace charcoal.</p>
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
          <CmsSection title="Titles & moments — Manrope bold">
            <p class="cms-display text-[1.75rem] leading-tight text-highlighted">Dobré ráno, Jano</p>
            <p class="mt-2 text-xs text-muted">The wordmark's face. Page titles 28 px, entry titles 30–36 px, greetings and moments. Tight tracking.</p>
          </CmsSection>
          <CmsSection title="Interface — Inter">
            <p class="text-sm text-highlighted font-medium">Uložit a zveřejnit</p>
            <p class="text-sm text-default">Body text in the interface is 14–15 px.</p>
            <p class="text-xs text-muted">Secondary text and metadata, 12–13 px.</p>
            <p class="mt-2 text-xs text-muted tabular-nums">Numbers: 1 234 · 12. 11. 2026 9:00</p>
          </CmsSection>
          <CmsSection title="Writing — Inter">
            <p class="cms-prose text-default">Rich text in the editor reads like the published page, so writers see their words as readers will.</p>
          </CmsSection>
        </div>
      </section>

      <section id="surfaces" class="space-y-4 scroll-mt-20">
        <h2 class="cms-display text-lg font-semibold text-highlighted">Surfaces &amp; shape</h2>
        <p class="text-muted max-w-2xl">Flat surfaces separated by hairline borders, no shadows (only a moment that arrives floats). One frame per group — never nested. Radius 8 px for controls, 12 px for cards, 16 px for moments.</p>
        <div class="grid gap-4 sm:grid-cols-3">
          <div class="cms-card p-5 text-sm">.cms-card</div>
          <div class="rounded-(--ui-radius) bg-elevated p-5 text-sm">bg-elevated (hover, selected)</div>
          <div class="rounded-(--ui-radius) border border-dashed border-accented p-5 text-sm text-muted">Drop zone / placeholder</div>
        </div>
      </section>

      <section id="moments" class="space-y-4 scroll-mt-20">
        <h2 class="cms-display text-lg font-semibold text-highlighted">Moments</h2>
        <p class="text-muted max-w-2xl">Where the brand speaks: a cream panel (charcoal in dark mode), one animal, a Manrope line, one sentence, at most two actions. At most one playful sentence per screen; labels, errors and confirmations stay plain.</p>
        <div class="cms-moment flex items-center justify-between gap-6 p-6">
          <div>
            <p class="cms-display text-2xl text-highlighted">Dobré ráno, Jano</p>
            <p class="cms-moment__muted text-sm mt-1">Jeden koncept čeká na zveřejnění.</p>
            <div class="mt-4 flex gap-2"><UButton icon="i-lucide-pen">Napsat aktualitu</UButton><UButton color="neutral" variant="outline" class="bg-(--cms-surface)">Přidat akci</UButton></div>
          </div>
          <img :src="cmsCharacter('owl').url" alt="" class="h-20 w-auto max-sm:hidden">
        </div>
        <div class="cms-card flex items-start gap-4 p-4 max-w-md shadow-[0_18px_40px_-14px_rgba(0,0,0,.35)]">
          <img :src="cmsCharacter('whale').url" alt="" class="h-12 w-auto">
          <div><p class="cms-display text-base text-highlighted">A je to na webu.</p><p class="text-sm text-muted">Návštěvníci to už vidí.</p></div>
        </div>
      </section>

      <section id="editors" class="space-y-4 scroll-mt-20">
        <h2 class="cms-display text-lg font-semibold text-highlighted">Editors &amp; lists</h2>
        <p class="text-muted max-w-2xl">One top bar (‹ back · status · saved | Preview · Publish) and one set of fields, in three arrangements picked from the content model. Developers override with <code class="font-mono text-xs">admin.editor</code> and <code class="font-mono text-xs">admin.list.layout</code>.</p>
        <div class="grid gap-3 md:grid-cols-3">
          <CmsSection title="Write">
            <p class="text-sm text-muted">A rich-text body with a page on the website (news). The sidebar folds to icons; one centred column as the reader meets it — cover photo, title, summary, text without boxes; details beside it as quiet rows and folded groups.</p>
          </CmsSection>
          <CmsSection title="Form">
            <p class="text-sm text-muted">Facts to fill in (events, partners, settings). Every field in titled sections in one column; a full-height details column on the right; long settings get a section menu.</p>
          </CmsSection>
          <CmsSection title="Preview">
            <p class="text-sm text-muted">The layout is the point (pages from blocks, the home page). The form beside the live page; a full-screen sheet on phones.</p>
          </CmsSection>
        </div>
        <p class="text-sm text-muted max-w-2xl">Lists: a <b class="text-highlighted font-medium">table</b> with an "In progress" strip above it when there are drafts; <b class="text-highlighted font-medium">grid</b> when the picture is the content (albums, logos); <b class="text-highlighted font-medium">Upcoming / Past</b> by month for dated content without drafts. Publishing goes through a review step (warnings never block); settings save straight to the website. An item can open <b class="text-highlighted font-medium">beside its list</b> (the media library): docked, resizable, the list stays usable.</p>
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
            <CmsStatusBadge :published="true" :scheduled-for="soon" />
          </div>
        </CmsSection>
      </section>

      <section id="forms" class="space-y-4 scroll-mt-20">
        <h2 class="cms-display text-lg font-semibold text-highlighted">Forms</h2>
        <p class="text-muted max-w-2xl">Sections named as plain questions (<code class="font-mono text-xs">admin.sections</code>), an icon in each control, a few choices as buttons, a switch with its sentence, dates from a calendar with "All day", empty optional fields behind "+ Add". Try it — this is the real component.</p>
        <div class="max-w-[40rem]">
          <CmsFormSections :fields="demoFields" :sections="demoSections" :state="demo" disclose id-prefix="sg-">
            <template #field="{ field: f }">
              <CmsField v-model="demo[f.key]" :field="f" entity="styleguide" placement="main" id-prefix="sg-" hide-optional />
            </template>
          </CmsFormSections>
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
