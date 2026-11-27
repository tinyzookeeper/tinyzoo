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
watch(open, (value) => { if (value) query.value = '' })
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
          <ul class="-mx-1 grid grid-cols-2 gap-0.5 sm:grid-cols-3">
            <li v-for="r in emptyRows" :key="r.i" class="min-w-0">
              <button type="button" class="cms-pk-row cms-pk-tile w-full" @click="chooseEmpty(r)">
                <UIcon :name="r.icon" class="size-4 shrink-0 text-muted" />
                <span class="truncate text-sm text-highlighted">{{ r.label }}</span>
              </button>
            </li>
          </ul>
        </section>
      </template>

      <!-- a page's list: the site's own types first, then the usual choices -->
      <template v-else>
        <section v-if="typeRows.length" class="cms-pk-group cms-pk-group--first">
          <h3 class="cms-pk-label">{{ t('card.yourContent') }}</h3>
          <ul class="-mx-2 space-y-0.5">
            <li v-for="r in typeRows" :key="r.name">
              <button type="button" class="cms-pk-row w-full" @click="chooseType(r.name)">
                <span class="size-8 shrink-0 rounded-md border border-default grid place-items-center text-muted"><UIcon :name="r.icon" class="size-4" /></span>
                <span class="min-w-0 flex-1">
                  <span class="block truncate text-sm font-medium text-highlighted">{{ r.label }}</span>
                  <span v-if="r.count" class="block text-xs text-muted">{{ r.count }}</span>
                </span>
              </button>
            </li>
          </ul>
        </section>
        <section v-if="choices.length" :class="typeRows.length ? 'cms-pk-group' : ''">
          <h3 v-if="typeRows.length" class="cms-pk-label">{{ t('card.sectionsHeading') }}</h3>
          <ul class="-mx-2 space-y-0.5">
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
        </section>
      </template>
      <p v-if="nothing" class="text-sm text-muted px-1 py-2">{{ t('blocks.noMatch') }}</p>
    </template>
  </UModal>
</template>

<style scoped>
.cms-pk-group + .cms-pk-group { margin-top: 0.5rem; padding-top: 0.5rem; border-top: 1px solid var(--ui-border); }
.cms-pk-label { padding: 0.25rem 0.5rem 0.375rem; font-size: 0.6875rem; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase; color: var(--ui-text-muted); }
.cms-pk-row { display: flex; align-items: center; gap: 0.75rem; border-radius: var(--ui-radius); padding: 0.375rem 0.5rem; text-align: left; transition: background-color 150ms ease; }
.cms-pk-row:hover, .cms-pk-row:focus-visible { background: color-mix(in oklab, var(--ui-bg-elevated) 70%, transparent); }
.cms-pk-tile { gap: 0.5rem; padding: 0.5rem; }
@media (pointer: coarse) { .cms-pk-row { min-height: 2.75rem; } }
@media (prefers-reduced-motion: reduce) { .cms-pk-row { transition: none; } }
</style>
