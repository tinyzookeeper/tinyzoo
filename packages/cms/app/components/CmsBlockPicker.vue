<script setup lang="ts">
import { cmsBindingTypes } from '../utils/cmsBinding'
import { cmsCardTypeOf } from '../utils/cmsCardType'
import { CMS_REF_KIND_ICONS } from '../utils/cmsFieldRef'
import { blankBlock, type Block } from '../../shared/block-tree'
import {
  cardApplyNext, cardBlockForField, cardEmptyChoices, cardExample, cardGroupBlock, cardPickerFields, cardSectionBlock, cardUsedFields,
  type CardOptions,
} from '../../shared/builder-card'

// The picker of a block: a searchable list of what a list of blocks takes. Three shapes, one modal:
// - plain (as it always was): the list's block types;
// - adding a section to a page that has a section for the site's own types (the editor in the preview,
//   `sections`): first "Your content", one choice per type of the site, then the usual choices under
//   "Sections". Choosing a type gives a section already bound to it, with a card designed from its fields;
// - adding into a card or a group of it (`card`): the fields of the card's type that a block of the list
//   takes, each with the block it brings and an example, then the empty blocks.
// The picker builds the block it hands back (`insert`); a plain choice is only a type (`choose`).
// With the editor in the preview on, the choices are tiles (an icon and a name), and what a choice is for
// shows under them for the one pointed at; without it the list is as it always was.
const props = defineProps<{
  defs: Record<string, any>
  title: string
  /** The language of the values a design fixes (a button's "Read more"). */
  lang: string
  sections?: { defType: string } | null
  card?: {
    /** The name of the bound type. */
    type: string
    options: CardOptions
    /** The whole card's blocks and the definitions of its top level (which fields are used already). */
    items: unknown
    topDefs: Record<string, any>
    /** The group the block goes into (when the list is a group's); null at the card's top level. */
    group: Block | null
    /** The id of the section that holds the card (the example entry is the one it shows). */
    sectionId: string | null
  } | null
}>()
const open = defineModel<boolean>('open', { default: false })
const emit = defineEmits<{
  choose: [type: string]
  /** A block built here; `designed` is the name of the type a section was designed from (the card is a starter). */
  insert: [block: Block, designed: string | null]
}>()
const { t, tl } = useCmsI18n()
const { data: graph } = useNuxtData<any[]>('cms-graph')
const query = ref('')
const tiles = useCmsBuilderOn()
/** What the choice pointed at (or focused) is for; shown under the tiles where a pointer can hover. */
const about = ref('')
const canHover = ref(false)
watch(open, (value) => {
  if (!value) return
  query.value = ''
  about.value = ''
  canHover.value = typeof matchMedia === 'function' && matchMedia('(hover: hover)').matches
})
const q = computed(() => query.value.trim().toLowerCase())
const has = (q2: string, ...texts: (string | undefined)[]) => !q2 || texts.some((x) => x?.toLowerCase().includes(q2))

// ── the usual choices ──
const choices = computed(() => Object.entries(props.defs)
  .map(([type, d]) => ({ type, label: tl(d.label, type), description: tl(d.description), icon: d.icon as string }))
  .filter((c) => has(q.value, c.label, c.description)))

// ── your content: one choice per type ──
const typeNames = computed(() => (props.sections && open.value ? cmsBindingTypes(graph.value).map((x) => x.name) : []))
const { totals } = useCmsCardTotals(typeNames)
const typeRows = computed(() => {
  if (!props.sections) return []
  return typeNames.value.flatMap((name) => {
    const found = cmsCardTypeOf(graph.value, name, tl, t('fieldRef.page'))
    if (!found) return []
    const icon = (graph.value ?? []).find((e) => e?.name === name)?.icon
    const n = totals.value[name]
    return has(q.value, found.meta.label, found.meta.labelSingular)
      ? [{ name, label: found.meta.label, icon: typeof icon === 'string' && icon ? icon : 'i-lucide-database', count: typeof n === 'number' ? t('card.entries', { count: n }) : '' }]
      : []
  })
})
function chooseType(name: string) {
  const found = cmsCardTypeOf(graph.value, name, tl, t('fieldRef.page'))
  const block = found && props.sections ? cardSectionBlock(props.defs, props.sections.defType, name, found.type, props.lang, found.meta.label) : null
  if (block && found) emit('insert', block, found.meta.label)
}

// ── into a card ──
const example = useCmsCardExample(() => (open.value ? props.card?.type : null), () => props.card?.sectionId)
const cardType = computed(() => example.card.type.value)
const cardLabel = computed(() => example.card.meta.value?.label ?? props.card?.type ?? '')
const used = computed(() => (props.card ? cardUsedFields(props.card.items, props.card.topDefs) : new Map<string, number>()))
const defLabel = (type: string) => tl(props.defs[type]?.label, type)
const fieldRows = computed(() => {
  const card = props.card
  const type = cardType.value
  if (!card || !type) return []
  return cardPickerFields(props.defs, card.options, type)
    .map((r) => {
      const field = type.fields.find((f) => f.key === r.key)!
      return {
        ...r, icon: CMS_REF_KIND_ICONS[r.kind] ?? 'i-lucide-square', blockLabel: defLabel(r.block),
        example: cardExample(field, example.row.value, props.lang, example.card.meta.value?.pagePrefix) || t(`card.kindsOne.${r.kind}` as any),
        onCard: used.value.has(r.key),
      }
    })
    .filter((r) => has(q.value, r.label, r.blockLabel))
})
const emptyRows = computed(() => {
  const card = props.card
  if (!card) return []
  return cardEmptyChoices(props.defs, card.options, !card.group)
    .map((c, i) => ({
      i, ...c, icon: (c.group?.icon ?? props.defs[c.type]?.icon ?? 'i-lucide-square') as string,
      label: c.group ? tl(c.group.label as any, defLabel(c.type)) : defLabel(c.type),
    }))
    .filter((c) => has(q.value, c.label))
})
function chooseField(key: string) {
  const card = props.card
  const type = cardType.value
  const block = card && type ? cardBlockForField(props.defs, card.options, type, key, props.lang) : null
  if (block && card) emit('insert', cardApplyNext(block, props.defs, card.options, card.group, props.lang), null)
}
function chooseEmpty(row: { type: string; group: NonNullable<typeof emptyRows.value[number]['group']> | null }) {
  const card = props.card
  if (!card) return
  const block = row.group ? cardGroupBlock(props.defs, row.group, props.lang) : blankBlock(props.defs, row.type)
  if (block) emit('insert', cardApplyNext(block, props.defs, card.options, card.group, props.lang), null)
}

const hasAbout = computed(() => !props.card && choices.value.some((c) => c.description))
const nothing = computed(() => props.card
  ? !fieldRows.value.length && !emptyRows.value.length
  : !choices.value.length && !typeRows.value.length)
</script>

<template>
  <UModal v-model:open="open" :title="title">
    <template #body>
      <UInput v-model="query" icon="i-lucide-search" :placeholder="t('blocks.search')" autofocus class="w-full mb-3" />

      <!-- into a card: the fields of its type, then the empty blocks -->
      <template v-if="card">
        <section v-if="fieldRows.length" class="cms-pk-group">
          <h3 class="cms-pk-label">{{ t('card.fieldsOf', { type: cardLabel }) }}</h3>
          <ul class="-mx-2 space-y-0.5">
            <li v-for="r in fieldRows" :key="r.key">
              <button type="button" class="cms-pk-row w-full" @click="chooseField(r.key)">
                <span class="size-8 shrink-0 rounded-md border border-default grid place-items-center text-muted"><UIcon :name="r.icon" class="size-4" /></span>
                <span class="min-w-0 flex-1">
                  <span class="flex items-baseline gap-1.5">
                    <span class="truncate text-sm font-medium text-highlighted">{{ r.label }}</span>
                    <span class="shrink-0 text-xs text-muted">{{ r.blockLabel }}</span>
                  </span>
                  <span class="block truncate text-xs text-dimmed">{{ r.example }}</span>
                </span>
                <span v-if="r.onCard" class="shrink-0 rounded-full border border-default px-2 py-0.5 text-xs text-muted">{{ t('card.onCard') }}</span>
              </button>
            </li>
          </ul>
        </section>
        <section v-if="emptyRows.length" class="cms-pk-group">
          <h3 class="cms-pk-label">{{ t('card.emptyBlocks') }}</h3>
          <ul class="cms-pk-grid">
            <li v-for="r in emptyRows" :key="r.i" class="min-w-0">
              <button type="button" class="cms-pk-tile" @click="chooseEmpty(r)">
                <span class="cms-pk-th"><UIcon :name="r.icon" class="size-5" /></span>
                <span class="cms-pk-name">{{ r.label }}</span>
              </button>
            </li>
          </ul>
        </section>
      </template>

      <!-- a page's list as tiles (the editor in the preview is on): the site's own types first -->
      <template v-else-if="tiles">
        <section v-if="typeRows.length" class="cms-pk-group">
          <h3 class="cms-pk-label">{{ t('card.yourContent') }}</h3>
          <ul class="cms-pk-grid">
            <li v-for="r in typeRows" :key="r.name" class="min-w-0">
              <button type="button" class="cms-pk-tile" @click="chooseType(r.name)">
                <span class="cms-pk-th"><UIcon :name="r.icon" class="size-5" /></span>
                <span class="cms-pk-name">{{ r.label }}</span>
                <span v-if="r.count" class="cms-pk-sub">{{ r.count }}</span>
              </button>
            </li>
          </ul>
        </section>
        <section v-if="choices.length" class="cms-pk-group">
          <h3 v-if="typeRows.length" class="cms-pk-label">{{ t('card.sectionsHeading') }}</h3>
          <ul class="cms-pk-grid" @pointerleave="about = ''">
            <li v-for="c in choices" :key="c.type" class="min-w-0">
              <button
                type="button" class="cms-pk-tile" :aria-description="c.description || undefined"
                @click="emit('choose', c.type)"
                @pointerenter="about = c.description"
                @focus="about = c.description" @blur="about = ''"
              >
                <span class="cms-pk-th"><UIcon :name="c.icon" class="size-5" /></span>
                <span class="cms-pk-name">{{ c.label }}</span>
              </button>
            </li>
          </ul>
        </section>
      </template>

      <!-- a page's list as it always was -->
      <template v-else>
        <ul v-if="choices.length" class="-mx-2 space-y-0.5">
          <li v-for="c in choices" :key="c.type">
            <button type="button" class="cms-pk-row w-full items-start" @click="emit('choose', c.type)">
              <span class="size-8 shrink-0 rounded-md border border-default grid place-items-center text-muted"><UIcon :name="c.icon" class="size-4" /></span>
              <span class="min-w-0">
                <span class="block text-sm font-medium text-highlighted">{{ c.label }}</span>
                <span v-if="c.description" class="block text-xs text-muted">{{ c.description }}</span>
              </span>
            </button>
          </li>
        </ul>
      </template>
      <p v-if="nothing" class="text-sm text-muted px-1 py-2">{{ t('blocks.noMatch') }}</p>
    </template>
    <template v-if="tiles && canHover && hasAbout" #footer>
      <p class="cms-pk-about" :class="{ 'cms-pk-about--hint': !about }" aria-hidden="true">{{ about || t('blocks.pickerHint') }}</p>
    </template>
  </UModal>
</template>

<style scoped>
.cms-pk-group + .cms-pk-group { margin-top: 0.5rem; padding-top: 0.5rem; border-top: 1px solid var(--ui-border); }
.cms-pk-label { padding: 0.25rem 0.5rem 0.375rem; font-size: 0.6875rem; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase; color: var(--ui-text-muted); }
.cms-pk-row { display: flex; align-items: center; gap: 0.75rem; border-radius: var(--ui-radius); padding: 0.375rem 0.5rem; text-align: left; transition: background-color 150ms ease; }
.cms-pk-row:hover, .cms-pk-row:focus-visible { background: color-mix(in oklab, var(--ui-bg-elevated) 70%, transparent); }
.cms-pk-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 0.125rem; margin-inline: -0.25rem; }
@media (min-width: 640px) { .cms-pk-grid { grid-template-columns: repeat(4, minmax(0, 1fr)); } }
.cms-pk-tile {
  display: flex; flex-direction: column; align-items: center; gap: 0.375rem; width: 100%; height: 100%;
  border: 1px solid transparent; border-radius: calc(var(--ui-radius) * 1.5); padding: 0.5rem 0.25rem;
  text-align: center; transition: background-color 150ms ease, border-color 150ms ease;
}
.cms-pk-tile:hover, .cms-pk-tile:focus-visible { background: color-mix(in oklab, var(--ui-bg-elevated) 45%, transparent); border-color: var(--ui-border); }
.cms-pk-th { display: grid; place-items: center; width: 4rem; height: 2.5rem; flex-shrink: 0; border-radius: var(--ui-radius); background: var(--ui-bg-elevated); color: var(--ui-text-toned); }
.cms-pk-name { max-width: 100%; font-size: 0.75rem; font-weight: 600; line-height: 1.25; color: var(--ui-text-highlighted); overflow-wrap: anywhere; }
.cms-pk-sub { margin-top: -0.25rem; font-size: 0.6875rem; line-height: 1.2; color: var(--ui-text-muted); }
.cms-pk-about { min-height: 2rem; font-size: 0.75rem; line-height: 1rem; color: var(--ui-text-toned); }
.cms-pk-about--hint { color: var(--ui-text-dimmed); }
@media (pointer: coarse) { .cms-pk-row { min-height: 2.75rem; } }
@media (prefers-reduced-motion: reduce) { .cms-pk-row, .cms-pk-tile { transition: none; } }
</style>
