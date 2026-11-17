<script setup lang="ts">
// The admin's design system: tokens, type, surfaces and the building blocks its screens are
// made of, drawn with the admin's real components. It lives here rather than in every
// installation's admin: /design-system, /en/design-system, /de/designsystem. Reached by
// right-clicking (long-pressing on a phone) the logo in the header, and from the footer menu.
// No site layout: the page wears the admin's own look (cms-admin.css, scoped to
// html[data-cms-admin]), which the website's tokens would otherwise mix with.
import type { FunctionalComponent } from 'vue'
import { DESIGN_SYSTEM_TEXT } from '~/lib/design-system-i18n'
import { DESIGN_SYSTEM_SEGMENT, LANGS, localePath } from '~/lib/site-i18n'

definePageMeta({ layout: false, alias: ['/en/design-system', '/de/designsystem'] })

const { lang, to } = useLang()
const tx = computed(() => DESIGN_SYSTEM_TEXT[lang.value])
const accents = ['mono', 'indigo', 'blue', 'violet', 'emerald'] as const
const accent = ref<(typeof accents)[number]>('mono')
useHead({
  title: () => `${tx.value.title} · tinyzoo`,
  htmlAttrs: { 'lang': lang, 'data-cms-admin': '', 'data-cms-accent': accent },
  meta: [{ name: 'description', content: () => tx.value.description }],
})
// The same page in each language, for the switcher in the bar.
const langLink = (l: (typeof LANGS)[number]) => localePath(`/${DESIGN_SYSTEM_SEGMENT[l]}`, l)

// The admin components below speak the admin's language ("+ Add", "All day", "Draft"): the
// page's, without touching the visitor's admin-language cookie, and given back on the way out.
const cmsLocale = useState<string | undefined>('cms-admin-locale')
const localeBefore = cmsLocale.value
watch(lang, (l) => { cmsLocale.value = l }, { immediate: true })
onBeforeUnmount(() => { cmsLocale.value = localeBefore })

// "**bold**" and "{name}" (a config key, as code) inside a text.
const CODE: Record<string, string> = { editor: 'admin.editor', layout: 'admin.list.layout', sections: 'admin.sections' }
const Rich: FunctionalComponent<{ text: string }> = ({ text }) => text.split(/(\*\*[^*]+\*\*|\{\w+\})/).filter(Boolean).map((part) => {
  if (part.startsWith('**')) return h('b', { class: 'font-medium text-highlighted' }, part.slice(2, -2))
  const code = /^\{(\w+)\}$/.exec(part)?.[1]
  return code && CODE[code] ? h('code', { class: 'font-mono text-xs' }, CODE[code]) : part
})

const steps = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950]
const ramps = ['primary', 'neutral', 'success'] as const
const states = [
  { color: 'success', label: 'Success' },
  { color: 'info', label: 'Info' },
  { color: 'warning', label: 'Warning' },
  { color: 'error', label: 'Error' },
] as const
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
  { key: 'charcoal', name: 'Charcoal', value: '#2E3035' },
  { key: 'ink', name: 'Ink', value: '#131313' },
  { key: 'cream', name: 'Cream', value: '#F9F5EF' },
] as const
const toc = ['brand', 'color', 'type', 'surfaces', 'moments', 'editors', 'actions', 'status', 'forms', 'states'] as const
</script>

<template>
  <div class="min-h-dvh">
    <header class="sticky top-0 z-40 border-b border-default bg-(--cms-page-bg)/85 backdrop-blur">
      <div class="mx-auto flex h-14 max-w-(--cms-content-max) items-center justify-between gap-4 px-4">
        <NuxtLink :to="to('/')" class="flex min-h-11 items-center gap-2" :aria-label="tx.homeLabel">
          <CmsMascot class="h-6 w-auto" />
          <CmsWordmark class="h-3.5 w-auto" />
        </NuxtLink>
        <div class="flex items-center gap-1 sm:gap-3">
          <nav :aria-label="tx.language" class="flex items-center">
            <NuxtLink
              v-for="l in LANGS" :key="l" :to="langLink(l)" :hreflang="l" :lang="l" :aria-current="l === lang ? 'true' : undefined"
              class="grid min-h-11 min-w-9 place-items-center rounded-md text-xs font-semibold"
              :class="l === lang ? 'text-highlighted' : 'text-muted hover:text-highlighted'"
            >{{ l.toUpperCase() }}</NuxtLink>
          </nav>
          <UButton :to="to('/')" color="neutral" variant="ghost" size="sm" icon="i-lucide-arrow-left" class="max-sm:hidden">{{ tx.back }}</UButton>
        </div>
      </div>
    </header>

    <main id="obsah" class="cms-page">
      <header class="mb-6 flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div class="min-w-0">
          <h1 class="cms-display text-[1.75rem] leading-tight text-highlighted">{{ tx.title }}</h1>
          <p class="mt-1 max-w-2xl text-sm text-muted text-pretty">{{ tx.description }}</p>
        </div>
        <UFieldGroup :aria-label="tx.accent">
          <UButton
            v-for="a in accents" :key="a" color="neutral" :variant="accent === a ? 'solid' : 'outline'"
            size="sm" class="capitalize" :aria-pressed="accent === a" @click="() => { accent = a }"
          >{{ a }}</UButton>
        </UFieldGroup>
      </header>

      <nav :aria-label="tx.sections" class="mb-8 flex flex-wrap gap-2">
        <UButton v-for="id in toc" :key="id" :to="`#${id}`" color="neutral" variant="soft" size="sm">{{ tx.toc[id] }}</UButton>
      </nav>

      <div class="space-y-10">
        <section id="brand" class="space-y-4 scroll-mt-20">
          <h2 class="cms-display text-lg font-semibold text-highlighted">{{ tx.toc.brand }}</h2>
          <p class="max-w-2xl text-muted">{{ tx.brand }}</p>
          <div class="grid gap-3 md:grid-cols-2">
            <div class="cms-card grid place-items-center p-8" style="background: var(--tz-cream)">
              <img :src="cmsBrand.logoUrl" alt="tinyzoo" class="h-10 w-auto">
            </div>
            <div class="cms-card grid place-items-center p-8" style="background: var(--tz-charcoal)">
              <img :src="cmsBrand.logoReversedUrl" alt="tinyzoo" class="h-10 w-auto">
            </div>
          </div>
          <div class="grid gap-3 sm:grid-cols-3">
            <div v-for="c in brandColors" :key="c.name" class="cms-card flex items-center gap-3 p-4">
              <span class="size-9 shrink-0 rounded-md border border-default" :style="{ backgroundColor: c.value }" />
              <span>
                <span class="block text-sm font-medium text-highlighted">{{ c.name }} <span class="font-mono text-xs text-muted">{{ c.value }}</span></span>
                <span class="block text-xs text-muted">{{ tx.brandColors[c.key] }}</span>
              </span>
            </div>
          </div>
          <CmsSection :title="tx.animalsTitle">
            <p class="mb-4 text-sm text-muted">{{ tx.animals }}</p>
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
          <h2 class="cms-display text-lg font-semibold text-highlighted">{{ tx.toc.color }}</h2>
          <p class="max-w-2xl text-muted">{{ tx.color }}</p>
          <CmsSection v-for="ramp in ramps" :key="ramp" :title="ramp">
            <div class="ds-ramp gap-1.5">
              <div v-for="s in steps" :key="s" class="space-y-1.5">
                <div class="h-12 rounded-md border border-default/50" :style="{ backgroundColor: `var(--ui-color-${ramp}-${s})` }" />
                <div class="text-center text-[0.6875rem] tabular-nums text-muted">{{ s }}</div>
              </div>
            </div>
          </CmsSection>
          <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div v-for="s in states" :key="s.color" class="cms-card flex items-start gap-3 p-4">
              <span class="mt-1 size-3 shrink-0 rounded-full" :style="{ backgroundColor: `var(--ui-${s.color})` }" />
              <span>
                <span class="block text-sm font-medium text-highlighted">{{ s.label }}</span>
                <span class="block text-xs text-muted">{{ tx.stateUses[s.color] }}</span>
              </span>
            </div>
          </div>
        </section>

        <section id="type" class="space-y-4 scroll-mt-20">
          <h2 class="cms-display text-lg font-semibold text-highlighted">{{ tx.toc.type }}</h2>
          <div class="grid gap-4 lg:grid-cols-3">
            <CmsSection :title="tx.typeDisplayTitle">
              <p class="cms-display text-[1.75rem] leading-tight text-highlighted">{{ tx.typeDisplaySample }}</p>
              <p class="mt-2 text-xs text-muted">{{ tx.typeDisplay }}</p>
            </CmsSection>
            <CmsSection :title="tx.typeUiTitle">
              <p class="text-sm font-medium text-highlighted">{{ tx.typeUiSample }}</p>
              <p class="text-sm text-default">{{ tx.typeUiBody }}</p>
              <p class="text-xs text-muted">{{ tx.typeUiMeta }}</p>
              <p class="mt-2 text-xs tabular-nums text-muted">{{ tx.typeUiNumbers }}</p>
            </CmsSection>
            <CmsSection :title="tx.typeWritingTitle">
              <p class="cms-prose text-default">{{ tx.typeWriting }}</p>
            </CmsSection>
          </div>
        </section>

        <section id="surfaces" class="space-y-4 scroll-mt-20">
          <h2 class="cms-display text-lg font-semibold text-highlighted">{{ tx.toc.surfaces }}</h2>
          <p class="max-w-2xl text-muted">{{ tx.surfaces }}</p>
          <div class="grid gap-4 sm:grid-cols-3">
            <div class="cms-card p-5 text-sm">.cms-card</div>
            <div class="rounded-(--ui-radius) bg-elevated p-5 text-sm">{{ tx.surfaceElevated }}</div>
            <div class="rounded-(--ui-radius) border border-dashed border-accented p-5 text-sm text-muted">{{ tx.surfaceDrop }}</div>
          </div>
        </section>

        <section id="moments" class="space-y-4 scroll-mt-20">
          <h2 class="cms-display text-lg font-semibold text-highlighted">{{ tx.toc.moments }}</h2>
          <p class="max-w-2xl text-muted">{{ tx.moments }}</p>
          <div class="cms-moment flex items-center justify-between gap-6 p-6">
            <div>
              <p class="cms-display text-2xl text-highlighted">{{ tx.momentGreeting }}</p>
              <p class="cms-moment__muted mt-1 text-sm">{{ tx.momentText }}</p>
              <div class="mt-4 flex gap-2"><UButton icon="i-lucide-pen">{{ tx.momentWrite }}</UButton><UButton color="neutral" variant="outline" class="bg-(--cms-surface)">{{ tx.momentAdd }}</UButton></div>
            </div>
            <img :src="cmsCharacter('owl').url" alt="" class="h-20 w-auto max-sm:hidden">
          </div>
          <div class="cms-card flex max-w-md items-start gap-4 p-4 shadow-[0_18px_40px_-14px_rgba(0,0,0,.35)]">
            <img :src="cmsCharacter('whale').url" alt="" class="h-12 w-auto">
            <div><p class="cms-display text-base text-highlighted">{{ tx.momentLiveTitle }}</p><p class="text-sm text-muted">{{ tx.momentLiveText }}</p></div>
          </div>
        </section>

        <section id="editors" class="space-y-4 scroll-mt-20">
          <h2 class="cms-display text-lg font-semibold text-highlighted">{{ tx.toc.editors }}</h2>
          <p class="max-w-2xl text-muted"><Rich :text="tx.editors" /></p>
          <div class="grid gap-3 md:grid-cols-3">
            <CmsSection :title="tx.editorWriteTitle">
              <p class="text-sm text-muted">{{ tx.editorWrite }}</p>
            </CmsSection>
            <CmsSection :title="tx.editorFormTitle">
              <p class="text-sm text-muted">{{ tx.editorForm }}</p>
            </CmsSection>
            <CmsSection :title="tx.editorPreviewTitle">
              <p class="text-sm text-muted">{{ tx.editorPreview }}</p>
            </CmsSection>
          </div>
          <p class="max-w-2xl text-sm text-muted"><Rich :text="tx.lists" /></p>
        </section>

        <section id="actions" class="space-y-4 scroll-mt-20">
          <h2 class="cms-display text-lg font-semibold text-highlighted">{{ tx.toc.actions }}</h2>
          <p class="max-w-2xl text-muted">{{ tx.actions }}</p>
          <CmsSection>
            <div class="space-y-3 overflow-x-auto">
              <div v-for="c in colors" :key="c" class="flex items-center gap-2">
                <span class="w-20 shrink-0 text-xs text-muted">{{ c }}</span>
                <UButton v-for="v in variants" :key="v" :color="c" :variant="v" size="sm">{{ v }}</UButton>
              </div>
            </div>
          </CmsSection>
        </section>

        <section id="status" class="space-y-4 scroll-mt-20">
          <h2 class="cms-display text-lg font-semibold text-highlighted">{{ tx.toc.status }}</h2>
          <CmsSection>
            <div class="flex flex-wrap items-center gap-3">
              <CmsStatusBadge :published="false" />
              <CmsStatusBadge :published="true" />
              <CmsStatusBadge :published="true" :scheduled-for="soon" />
            </div>
          </CmsSection>
        </section>

        <section id="forms" class="space-y-4 scroll-mt-20">
          <h2 class="cms-display text-lg font-semibold text-highlighted">{{ tx.toc.forms }}</h2>
          <p class="max-w-2xl text-muted"><Rich :text="tx.forms" /></p>
          <div class="max-w-[40rem]">
            <CmsFormSections :fields="demoFields" :sections="demoSections" :state="demo" disclose id-prefix="ds-">
              <template #field="{ field: f }">
                <CmsField v-model="demo[f.key]" :field="f" entity="event" placement="main" id-prefix="ds-" hide-optional />
              </template>
            </CmsFormSections>
          </div>
        </section>

        <section id="states" class="space-y-4 scroll-mt-20">
          <h2 class="cms-display text-lg font-semibold text-highlighted">{{ tx.toc.states }}</h2>
          <div class="grid gap-4 lg:grid-cols-3">
            <div class="cms-card">
              <CmsEmptyState icon="i-lucide-newspaper" :title="tx.emptyTitle" :description="tx.emptyText">
                <template #actions><UButton icon="i-lucide-plus" size="sm">{{ tx.emptyAction }}</UButton></template>
              </CmsEmptyState>
            </div>
            <div class="cms-card">
              <CmsEmptyState variant="no-results" :title="tx.noResultsTitle" :description="tx.noResultsText">
                <template #actions><UButton color="neutral" variant="outline" size="sm">{{ tx.noResultsAction }}</UButton></template>
              </CmsEmptyState>
            </div>
            <div class="cms-card">
              <CmsEmptyState variant="error" :title="tx.errorTitle" :description="tx.errorText">
                <template #actions><UButton color="neutral" variant="outline" size="sm" icon="i-lucide-rotate-ccw">{{ tx.errorAction }}</UButton></template>
              </CmsEmptyState>
            </div>
          </div>
        </section>
      </div>
    </main>
  </div>
</template>

<style scoped>
/* Colour ramps: a fixed 11 columns (no dynamic class names). */
.ds-ramp { display: grid; grid-template-columns: repeat(11, minmax(0, 1fr)); }
</style>
