<script setup lang="ts">
// A form as a few titled sections ("What is it?", "When?", "Where?") — see
// cmsFormSections for how they are chosen. Empty optional fields wait behind
// "+ Add …" until they are needed; `.group()` fields (e.g. "Search & sharing") fold
// away at the end with a one-line summary. Long forms get a section menu beside them.
//
// The page renders each field through the `field` slot (it owns the field's model,
// errors and translation hints); this component only decides where and whether.
import type { CmsSectionConfig } from '../utils/cmsSections'

const props = defineProps<{
  fields: any[]
  sections?: CmsSectionConfig[] | null
  state: Record<string, any>
  errors?: Record<string, any>
  /** Put empty optional fields behind "+ Add …" (off for translations: everything there is to fill). */
  disclose?: boolean
  /** Allow the section menu (wide forms with room beside them). */
  menu?: boolean
  idPrefix?: string
}>()

const { t, tl, fieldLabel } = useCmsI18n()
const view = computed(() => cmsFormSections(props.fields, props.sections))
const showMenu = computed(() => !!props.menu && cmsNeedsSectionMenu(view.value))
const titleOf = (s: (typeof view.value)[number]) => (s.label != null ? tl(s.label as any) : s.kind ? t(`sections.${s.kind}`) : '')
const anchor = (id: string) => `cms-section-${props.idPrefix ?? ''}${id}`

// Fields once filled stay in view, even when emptied again.
const seen = reactive(new Set<string>())
watchEffect(() => {
  for (const f of props.fields) if (!cmsIsEmpty(props.state[f.key])) seen.add(f.key)
})
const waiting = (s: (typeof view.value)[number]) => (props.disclose ? cmsWaitingFields(s, props.state, seen, props.errors ?? {}) : [])
const shown = (s: (typeof view.value)[number]) => {
  const hide = new Set(waiting(s))
  return s.fields.filter((f) => !hide.has(f.key))
}
const waitingFields = (s: (typeof view.value)[number]) => {
  const hide = new Set(waiting(s))
  return s.fields.filter((f) => hide.has(f.key))
}
async function add(key: string) {
  seen.add(key)
  await nextTick()
  const el = document.getElementById(`cms-field-${props.idPrefix ?? ''}${key}`)
  el?.focus()
  el?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
}

// Folded groups: open by hand, or by themselves when a field inside has an error.
const openGroups = reactive<Record<string, boolean>>({})
watch(() => ({ ...(props.errors ?? {}) }), (errs) => {
  for (const s of view.value) if (s.folded && s.fields.some((f) => errs[f.key])) openGroups[s.id] = true
})
const filledCount = (s: (typeof view.value)[number]) => s.fields.filter((f) => !cmsIsEmpty(props.state[f.key])).length

// The section menu follows the scroll.
const active = ref<string | null>(null)
let observer: IntersectionObserver | null = null
// After a jump the scroll may stop short of the section (the end of the page): the
// menu keeps what was chosen until the scrolling is over.
let chosenUntil = 0
function observe() {
  observer?.disconnect()
  if (!showMenu.value || typeof IntersectionObserver === 'undefined') return
  observer = new IntersectionObserver((entries) => {
    if (Date.now() < chosenUntil) return
    const hit = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0]
    if (hit) active.value = hit.target.id
  }, { rootMargin: '-15% 0px -65% 0px' })
  for (const s of view.value) {
    const el = document.getElementById(anchor(s.id))
    if (el) observer.observe(el)
  }
}
onMounted(observe)
watch(showMenu, () => nextTick(observe))
onBeforeUnmount(() => observer?.disconnect())
function jump(id: string) {
  const s = view.value.find((x) => x.id === id)
  if (s?.folded) openGroups[s.id] = true
  chosenUntil = Date.now() + 1000
  document.getElementById(anchor(id))?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  active.value = anchor(id)
}
</script>

<template>
  <div class="cms-form" :class="showMenu ? 'cms-form--menu' : ''">
    <nav v-if="showMenu" class="cms-form__menu" :aria-label="t('sections.menu')">
      <ul>
        <li v-for="s in view" :key="s.id">
          <button
            v-if="s.label != null || s.kind" type="button" class="cms-form__menu-item"
            :aria-current="active === anchor(s.id) ? 'true' : undefined" @click="jump(s.id)"
          >
            <UIcon v-if="s.icon" :name="s.icon" class="size-4 shrink-0 mt-0.5" />
            <span class="min-w-0 leading-snug text-pretty">{{ titleOf(s) }}</span>
          </button>
        </li>
      </ul>
    </nav>

    <div class="cms-form__body">
      <div v-if="$slots.top" class="cms-form__top"><slot name="top" /></div>
      <template v-for="s in view" :key="s.id">
        <!-- a folded group: a quiet row that opens -->
        <UCollapsible v-if="s.folded" :id="anchor(s.id)" v-model:open="openGroups[s.id]" class="cms-section cms-section--folded">
          <button type="button" class="group cms-section__head w-full text-left">
            <span class="cms-section__tile"><UIcon :name="s.icon ?? 'i-lucide-sliders-horizontal'" class="size-4" /></span>
            <span class="min-w-0 flex-1">
              <span class="cms-section__title block">{{ titleOf(s) }}</span>
              <span class="block text-sm text-muted">
                {{ filledCount(s) ? t('sections.filled', { n: filledCount(s), total: s.fields.length }) : t('sections.automatic') }}
              </span>
            </span>
            <UIcon name="i-lucide-chevron-down" class="size-4 text-dimmed shrink-0 transition-transform group-data-[state=open]:rotate-180" />
          </button>
          <template #content>
            <div class="cms-section__fields pt-5">
              <div v-for="f in s.fields" :key="f.key"><slot name="field" :field="f" /></div>
            </div>
          </template>
        </UCollapsible>

        <section v-else :id="anchor(s.id)" class="cms-section" :aria-labelledby="(s.label != null || s.kind) ? `${anchor(s.id)}-title` : undefined">
          <header v-if="s.label != null || s.kind" class="cms-section__head">
            <span v-if="s.icon" class="cms-section__tile"><UIcon :name="s.icon" class="size-4" /></span>
            <div class="min-w-0">
              <h2 :id="`${anchor(s.id)}-title`" class="cms-section__title">{{ titleOf(s) }}</h2>
              <p v-if="s.description" class="text-sm text-muted text-pretty">{{ tl(s.description as any) }}</p>
            </div>
          </header>
          <div class="cms-section__fields" :class="s.columns === 2 ? 'cms-section__fields--2' : ''">
            <div v-for="f in shown(s)" :key="f.key" :class="s.columns === 2 && !cmsIsShortField(f) ? 'cms-section__wide' : ''">
              <slot name="field" :field="f" />
            </div>
          </div>
          <div v-if="waitingFields(s).length" class="cms-section__add">
            <UButton
              v-for="f in waitingFields(s)" :key="f.key" size="sm" color="neutral" variant="outline" icon="i-lucide-plus"
              class="border-dashed ring-0 border border-accented text-muted hover:text-highlighted" @click="add(f.key)"
            >{{ fieldLabel(f) }}</UButton>
          </div>
        </section>
      </template>
    </div>
  </div>
</template>
