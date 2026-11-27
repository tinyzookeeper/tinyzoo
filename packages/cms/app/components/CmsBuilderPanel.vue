<script setup lang="ts">
// The editor in the preview (experimental, NUXT_CMS_BUILDER=on), the form's side: the selected block
// alone, in place of the form, while the preview is beside it (CmsBuilderFocus). A way back to all
// sections, the path as a breadcrumb (each part selects that level, in the page too), the block's
// name and what it is, its content fields, its settings under one quiet heading, and Duplicate and
// Delete. A block's own list of blocks (a layout's small blocks, a group's) is one of its content
// fields: rows, each a step deeper. The selection is the bridge's (useCmsBuilder): selecting in the
// page, in the breadcrumb and in a list is the same selection.
//
// An error the panel does not show where it is (in another section, in a block along the path) is
// counted on the way back and on the part of the breadcrumb that leads to it.
//
// A click in the page on a field that is not typed there (a rich text, a picture) brings that field
// into view here with a short highlight; a rich text gets the cursor, a picture's chooser opens on a
// double click (since 2d). The panel takes the keyboard focus when it was opened from the list with the
// keyboard, and gives it back to the list's row with *All sections*.
//
// Since 2f, after the block's own fields and settings: where else its content comes from (*Content from
// elsewhere*), as the page found it: each collection or global it shows, the entries it shows now (a click
// edits one beside the page), *Add entry* and *All entries*. What the person may not do is not offered.
//
// Since 3e a section made for one of the site's own types is called by that type (*Kurzy*), in the title and
// the breadcrumb, with the block type's label as the quiet line. And on a phone-sized admin the panel is the
// body of the sheet at the bottom of the preview (`inSheet`): the sheet's handle has the title row's content,
// so the panel leaves that row out and keeps everything else.
import type { CmsBuilderPath } from '../../shared/builder'
import { cmsCardBindingOf, type CmsCardBlock, type CmsCardBlockOf } from '../utils/cmsFieldRef'
import { cmsCardTypeOf } from '../utils/cmsCardType'
import { cardBindingFieldOf, cardHiddenFields, cardRefOf, cardRepeatCount } from '../../shared/builder-card'
import type { CmsCardOwner } from '../composables/useCmsCardEdit'
import { cmsBindingRead } from '../utils/cmsBinding'
import { blockListFull, findBlock, isLockedBlock, issueCounts, keyOfPath } from '../../shared/block-tree'

const props = defineProps<{ entity: string; readOnly?: boolean; inSheet?: boolean }>()
const { data: graph } = useNuxtData<any[]>('cms-graph')
// Text inside blocks is edited on its own (not shared), as in the form's list.
provide('cmsCollab', null)
// The rich-text editor's own undo says it undoes the text only (the preview's bar has the builder's undo).
provide('cmsInBuilderPanel', true)
const { t, tl } = useCmsI18n()
const builder = useCmsBuilder()
const form = inject<{ issues?: Record<string, string> } | null>('cmsForm', null)

const selection = computed(() => builder.value?.selection.value ?? null)
const path = computed<CmsBuilderPath>(() => selection.value?.path ?? [])
const owner = computed(() => {
  const first = path.value[0]
  return first ? builder.value?.lists.value.find((l) => l.ids().includes(first)) ?? null : null
})
const tree = computed(() => owner.value?.root() ?? null)
const found = computed(() => (tree.value && path.value.length ? findBlock(tree.value, path.value) : null))
const block = computed(() => found.value?.block ?? null)
// A small block that names a field of the entries a card shows finds the card's binding in the section
// the selected block is in (the first part of the path), as it does in the form's list.
const rootList = computed(() => (tree.value && path.value[0] ? findBlock(tree.value, [path.value[0]]) : null))
provide('cmsCardRoot', {
  get key() { return owner.value?.key ?? '' },
  blocks: () => tree.value?.items ?? [],
  defs: () => tree.value?.defs ?? {},
})
provide('cmsCardSource', computed(() => (rootList.value ? cmsCardBindingOf(rootList.value.block, rootList.value.list.defs[rootList.value.block.type]) : undefined)))
// The section that holds the card, whole (a reference control reads the other blocks' fields from it) and
// the block the panel shows, for a control that needs a sibling's value (its own text).
provide('cmsCardBlock', computed<CmsCardBlock | undefined>(() => {
  const top = rootList.value
  const at = path.value[0]
  const def = top ? top.list.defs[top.block.type] : undefined
  return top && at && cmsCardBindingOf(top.block, def) !== undefined ? { block: top.block, def, path0: at } : undefined
}))
provide<CmsCardBlockOf>('cmsCardBlockOf', (idPrefix) => (block.value && idPrefix === `${owner.value?.key}-${block.value.id}-` ? { block: block.value, path: [...path.value] } : undefined))
const def = computed(() => (found.value ? found.value.list.defs[found.value.block.type] : undefined))
const locked = computed(() => !found.value || isLockedBlock(found.value.list.defs, found.value.block))
const key = computed(() => (owner.value && tree.value ? keyOfPath(owner.value.key, tree.value, path.value) : null))
const along = computed(() => selection.value?.along ?? [])
// A section made for one of the site's own types: its name is the type's (*Kurzy*), its label the quiet line.
const topCard = computed(() => {
  const top = rootList.value
  if (!builderOn.value || !top) return null
  const binding = cmsBindingRead(cmsCardBindingOf(top.block, top.list.defs[top.block.type]))
  return cmsCardTypeOf(graph.value, binding?.type, tl, t('fieldRef.page'))?.meta ?? null
})
const name = (i: number) => (i === 0 && topCard.value ? topCard.value.label : tl(along.value[i]?.def?.label as any, along.value[i]?.type ?? ''))
const icon = (i: number) => (i === 0 && topCard.value ? topCard.value.icon : along.value[i]?.def?.icon ?? 'i-lucide-square')
const isSection = computed(() => path.value.length === 1)
const builderOn = useCmsBuilderOn()
// A card section (bound to one of the site's own types): its quiet line says how often the card repeats.
const isCardSection = computed(() => builderOn.value && isSection.value && !locked.value && !!block.value && !!cardBindingFieldOf(def.value))
const cardBinding = computed(() => {
  const k = cardBindingFieldOf(def.value)?.key
  return isCardSection.value && k ? cmsBindingRead(block.value?.[k]) : null
})
const cardName = computed(() => cardBinding.value?.type ?? null)
const cardInfo = useCmsCardType(cardName)
const repeat = computed(() => {
  if (!cardName.value || !cardInfo.type.value) return null
  const shown = builder.value?.sources.value[path.value.join('/')]?.find((x) => x.entity === cardName.value)?.entries.length
  return cardRepeatCount(shown ?? null, cardInfo.total.value, cardBinding.value?.limit)
})
const lang = useCmsContentLang(() => props.entity)
const cardEdit = useCmsCardEdit(() => lang.value)
const about = computed(() => {
  if (topCard.value && isCardSection.value) {
    const label = tl(def.value?.label as any, block.value?.type ?? '')
    if (repeat.value !== null) return repeat.value > 0 ? t('card.quietLineOf', { label, count: repeat.value }) : t('card.quietNoneOf', { label })
    return label
  }
  if (repeat.value !== null) return repeat.value > 0 ? t('card.quietLine', { count: repeat.value }) : t('card.quietNone')
  const own = tl(def.value?.description as any, '')
  if (own) return own
  return isSection.value ? t('builderPanel.ofPage') : t('builderPanel.inBlock', { name: name(path.value.length - 2) })
})

// Inside a card (the section around the block names a card): what the reference says hides the fields that
// do not apply, and a block with no text of its own (a button) asks for its other content first.
const cardType = computed(() => {
  const source = rootList.value ? cmsCardBindingOf(rootList.value.block, rootList.value.list.defs[rootList.value.block.type]) : undefined
  return source === undefined ? undefined : cmsCardTypeOf(graph.value, cmsBindingRead(source)?.type, tl, t('fieldRef.page'))?.type ?? null
})
const fields = computed(() => {
  let all = (def.value?.fields ?? []).filter((f: any) => !(found.value?.index === 0 && f.meta?.needsPrevious))
  const ref = builderOn.value && cardType.value !== undefined ? cardRefOf(def.value) : null
  if (ref) {
    const hidden = cardHiddenFields(def.value, block.value, cardType.value ?? null)
    all = all.filter((f: any) => !hidden.has(f.key))
  }
  const content = all.filter((f: any) => !f.meta?.setting)
  if (ref && !ref.own) content.sort((a: any, b: any) => Number(a.key === ref.key) - Number(b.key === ref.key))
  return { content, settings: all.filter((f: any) => f.meta?.setting) }
})
/** A list or a group inside the block is keyed by its full path, so its ids and errors are found. */
const fieldOf = (f: any) => (f.type === 'blocks' || f.type === 'group' ? { ...f, key: `${key.value}.${f.key}` } : f)
const issues = computed(() => form?.issues ?? {})
const errorOf = (f: any) => issues.value[`${key.value}.${f.key}`]
/** The server's refusal of the block as a whole, or of a field it does not have. */
const blockIssue = computed(() => {
  const k = key.value
  if (!k) return ''
  const known = new Set<string>((def.value?.fields ?? []).map((f: any) => f.key))
  for (const [at, message] of Object.entries(issues.value)) {
    if (at === k) return message
    if (at.startsWith(`${k}.`) && !known.has(at.slice(k.length + 1).split('.')[0]!)) return message
  }
  return ''
})
const counts = computed(() => (owner.value && tree.value ? issueCounts(owner.value.key, tree.value, path.value, Object.keys(issues.value)) : { outside: 0, along: [] }))

/** The section is written by the list that holds it: several keys in one step, *Undo* from the history. */
const cardOwner: CmsCardOwner = {
  apply: (values) => owner.value?.patch(path.value, values) ?? null,
  undo: (step) => () => { if (step !== null) builder.value?.history.undoStep(step) },
  notify: (message) => owner.value?.notice(message),
}
function set(fieldKey: string, value: unknown) {
  if (props.readOnly || !owner.value) return
  // The type of a card section changes: its card follows in the same step.
  if (builderOn.value && isSection.value && block.value && cardEdit.change(block.value, def.value, fieldKey, value, cardOwner)) return
  // The preview follows as it follows any typing (after a short pause).
  owner.value.set(path.value, fieldKey, value)
}
const root = ref<HTMLElement | null>(null)
const heading = ref<HTMLElement | null>(null)
function back() {
  const section = path.value[0]
  builder.value?.select(null)
  // In the sheet there is no row to come back to.
  if (props.inSheet) return
  // The keyboard goes back to the row of the section that was open.
  void nextTick(() => {
    const row = section ? [...document.querySelectorAll<HTMLElement>('[data-cms-block-row]')].find((el) => el.dataset.cmsBlockRow === section && el.offsetParent !== null) : null
    row?.querySelector<HTMLElement>('button')?.focus({ preventScroll: true })
  })
}

// ── a field asked for from the page ──
const reduced = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches
/** The field's box in the panel: the field itself, or the list that holds the item. */
function fieldBox(request: { field: string; item: string | null }): HTMLElement | null {
  let key = request.field
  if (request.item) {
    const list = (def.value?.fields ?? []).find((f: any) => f.type === 'blocks' && f.meta?.list && Array.isArray(block.value?.[f.key]) && block.value![f.key].some((x: any) => x?.id === request.item))
    if (!list) return null
    key = list.key
  }
  return [...(root.value?.querySelectorAll<HTMLElement>('[data-cms-panel-field]') ?? [])].find((el) => el.dataset.cmsPanelField === key) ?? null
}
function bringField(request: { path: CmsBuilderPath; field: string; item: string | null; open: boolean; at: number } | null) {
  if (!request || Date.now() - request.at > 2000 || request.path.join('/') !== path.value.join('/')) return
  // The panel may still be sliding in: try for a moment.
  let tries = 0
  const attempt = () => {
    const box = fieldBox(request)
    if (!box) {
      if (++tries < 20) requestAnimationFrame(attempt)
      return
    }
    box.scrollIntoView({ block: 'center', behavior: reduced() ? 'auto' : 'smooth' })
    box.classList.remove('cms-focus__flash')
    void box.offsetWidth
    box.classList.add('cms-focus__flash')
    setTimeout(() => box.classList.remove('cms-focus__flash'), 1300)
    const editor = box.querySelector<HTMLElement>('.ProseMirror[contenteditable="true"]')
    if (editor) editor.focus({ preventScroll: true })
    else if (request.open) box.querySelector<HTMLElement>('[data-cms-media-field]')?.dispatchEvent(new CustomEvent('cms-builder-choose'))
  }
  void nextTick(attempt)
}
watch(() => builder.value?.fieldRequest.value ?? null, (request) => bringField(request))
onMounted(() => {
  bringField(builder.value?.fieldRequest.value ?? null)
  // Opened from the list with the keyboard: the keyboard comes along (a click in the page leaves it there).
  if (builder.value?.focusPanel.value) {
    builder.value.focusPanel.value = false
    heading.value?.focus({ preventScroll: true })
  }
})
// ── content from elsewhere (since 2f) ──
const sources = computed(() => {
  const all = builder.value?.sources.value[path.value.join('/')] ?? []
  const known = builder.value?.entities.value ?? {}
  return all.filter((src) => Object.hasOwn(known, src.entity)).map((src) => {
    const info = known[src.entity]!
    const meta = (graph.value ?? []).find((e: any) => e.name === src.entity)
    return { ...src, info, icon: meta?.icon ?? (info.global ? 'i-lucide-settings-2' : 'i-lucide-folder') }
  })
})
function editEntry(entity: string, id: string | null) {
  builder.value?.editEntry(entity, id)
}

function go(depth: number) {
  builder.value?.select(path.value.slice(0, depth + 1))
}
const full = computed(() => !!found.value && blockListFull(found.value.list))
function duplicate() {
  if (props.readOnly || !owner.value || full.value) return
  owner.value.duplicate(path.value)
  builder.value?.changed()
}
function remove() {
  if (props.readOnly || !owner.value) return
  const at = path.value
  owner.value.remove(at)
  builder.value?.changed()
  // A small block's panel goes back to the block around it; a section's to all sections.
  builder.value?.select(at.length > 1 ? at.slice(0, -1) : null)
}
</script>

<template>
  <div v-if="block" ref="root" class="cms-focus" :aria-label="name(path.length - 1)" role="region">
    <div class="flex flex-wrap items-center gap-x-3 gap-y-1">
      <button type="button" class="cms-focus__back" @click="back">
        <UIcon name="i-lucide-chevron-left" class="size-4" aria-hidden="true" />
        <span>{{ t('builderPanel.allSections') }}</span>
        <span v-if="counts.outside" class="cms-focus__count" :title="t('builderPanel.toFix', { count: counts.outside })">{{ counts.outside }}</span>
      </button>
    </div>

    <nav v-if="path.length > 1" class="cms-focus__crumbs" :aria-label="t('builderPanel.where')">
      <template v-for="(part, i) in along" :key="part.id">
        <UIcon v-if="i > 0" name="i-lucide-chevron-right" class="size-3.5 text-dimmed shrink-0" aria-hidden="true" />
        <span v-if="i === along.length - 1" class="cms-focus__crumb cms-focus__crumb--current" aria-current="location">
          <UIcon :name="icon(i)" class="size-3.5 shrink-0" aria-hidden="true" />{{ name(i) }}
        </span>
        <button v-else type="button" class="cms-focus__crumb" @click="go(i)">
          <UIcon :name="icon(i)" class="size-3.5 shrink-0" aria-hidden="true" />{{ name(i) }}
          <span v-if="counts.along[i]" class="cms-focus__count" :title="t('builderPanel.toFix', { count: counts.along[i] })">{{ counts.along[i] }}</span>
        </button>
      </template>
    </nav>

    <div v-if="!inSheet" class="flex items-center gap-3">
      <span class="cms-focus__icon"><UIcon :name="icon(path.length - 1)" class="size-[1.125rem]" aria-hidden="true" /></span>
      <div class="min-w-0">
        <h2 ref="heading" class="cms-focus__title" tabindex="-1">{{ name(path.length - 1) }}</h2>
        <p class="text-xs text-muted text-pretty">{{ about }}</p>
      </div>
    </div>

    <p v-if="blockIssue" role="alert" class="flex items-start gap-1.5 text-sm text-error">
      <UIcon name="i-lucide-circle-alert" class="mt-0.5 size-4 shrink-0" aria-hidden="true" />{{ blockIssue }}
    </p>

    <template v-if="locked">
      <p class="flex items-start gap-2 text-sm text-muted">
        <UIcon name="i-lucide-triangle-alert" class="mt-0.5 size-4 shrink-0 text-warning" aria-hidden="true" />
        {{ t(def ? 'blocks.staleHelp' : 'blocks.goneHelp') }}
      </p>
    </template>
    <template v-else>
      <CmsCardNotices
        v-if="isCardSection" :section="block" :def="def" :read-only="readOnly"
        @drop="cardEdit.dropUnbound(block, def, cardOwner)" @redesign="cardEdit.redesign(block, def, cardOwner)"
      />
      <div class="space-y-5">
        <div v-for="f in fields.content" :key="f.key" :data-cms-panel-field="f.key" class="cms-focus__field">
          <CmsField
            :model-value="block[f.key]" :field="fieldOf(f)" :entity="entity" :id-prefix="`${owner?.key}-${block.id}-`"
            :error="errorOf(f)"
            @update:model-value="(v: unknown) => set(f.key, v)"
          />
        </div>
      </div>
      <div v-if="fields.settings.length" role="group" :aria-labelledby="`cms-focus-${block.id}-settings`" class="cms-focus__settings">
        <h3 :id="`cms-focus-${block.id}-settings`" class="cms-focus__sub">{{ t('blocks.settings') }}</h3>
        <div class="space-y-5">
          <div v-for="f in fields.settings" :key="f.key" :data-cms-panel-field="f.key" class="cms-focus__field">
            <CmsField
              :model-value="block[f.key]" :field="fieldOf(f)" :entity="entity" :id-prefix="`${owner?.key}-${block.id}-`"
              :error="errorOf(f)"
              @update:model-value="(v: unknown) => set(f.key, v)"
            />
          </div>
        </div>
      </div>
    </template>

    <section v-if="sources.length" :aria-labelledby="`cms-focus-${block.id}-sources`" class="cms-focus__settings">
      <h3 :id="`cms-focus-${block.id}-sources`" class="cms-focus__sub">{{ t('builderSources.title') }}</h3>
      <div class="space-y-5">
        <div v-for="src in sources" :key="src.entity" class="cms-src" data-cms-source :data-entity="src.entity">
          <div class="flex items-start gap-2.5">
            <span class="cms-src__icon"><UIcon :name="src.icon" class="size-4" aria-hidden="true" /></span>
            <div class="min-w-0">
              <p class="cms-src__name">{{ src.info.label }}</p>
              <p class="text-xs text-muted text-pretty">{{ src.info.global ? t('builderSources.fromGlobal', { name: src.info.label }) : t('builderSources.fromCollection', { name: src.info.label }) }}</p>
            </div>
          </div>
          <template v-if="!src.info.global">
            <ul v-if="src.entries.length" class="cms-src__rows">
              <li v-for="e in src.entries" :key="e.id">
                <button v-if="src.info.edit !== false" type="button" class="cms-src__row" @click="editEntry(src.entity, e.id)">
                  <span class="min-w-0 flex-1 truncate">{{ e.title }}</span>
                  <UBadge v-if="e.state" size="sm" variant="subtle" :color="e.state === 'scheduled' ? 'info' : 'neutral'">{{ e.state === 'scheduled' ? t('editor.scheduled') : t('editor.draft') }}</UBadge>
                  <UIcon name="i-lucide-pencil" class="cms-src__pen size-3.5 shrink-0" aria-hidden="true" />
                </button>
                <span v-else class="cms-src__row cms-src__row--plain">
                  <span class="min-w-0 flex-1 truncate">{{ e.title }}</span>
                  <UBadge v-if="e.state" size="sm" variant="subtle" :color="e.state === 'scheduled' ? 'info' : 'neutral'">{{ e.state === 'scheduled' ? t('editor.scheduled') : t('editor.draft') }}</UBadge>
                </span>
              </li>
            </ul>
            <p v-else class="text-sm text-muted">{{ src.unmatched ? t('builderSources.notOneByOne') : t('builderSources.nothingNow') }}</p>
          </template>
          <div class="flex flex-wrap gap-2">
            <UButton v-if="src.info.global && src.info.edit !== false" size="xs" color="neutral" variant="outline" icon="i-lucide-pencil" @click="editEntry(src.entity, src.entries[0]?.id ?? null)">{{ t('builderSources.edit') }}</UButton>
            <UButton v-if="!src.info.global && src.info.create" size="xs" color="neutral" variant="outline" icon="i-lucide-plus" @click="editEntry(src.entity, null)">{{ t('builderSources.add') }}</UButton>
            <UButton :to="`/admin/${src.entity}`" target="_blank" size="xs" color="neutral" variant="ghost" trailing-icon="i-lucide-arrow-up-right">
              {{ src.info.global ? t('builderSources.openGlobal') : t('builderSources.all') }}
            </UButton>
          </div>
        </div>
      </div>
    </section>

    <div class="cms-focus__foot">
      <UButton v-if="!locked && !full" color="neutral" variant="outline" size="sm" icon="i-lucide-copy" @click="duplicate">{{ t('blocks.duplicate') }}</UButton>
      <UButton color="error" variant="outline" size="sm" icon="i-lucide-trash-2" @click="remove">
        {{ isSection ? t('builderPanel.removeSection') : t('builderPanel.removeBlock') }}
      </UButton>
    </div>
  </div>
</template>

<style scoped>
.cms-focus { display: flex; flex-direction: column; gap: 1.25rem; }
.cms-focus__back {
  align-self: flex-start; display: inline-flex; align-items: center; gap: 0.25rem;
  margin: -0.25rem 0 -0.25rem -0.375rem; padding: 0.25rem 0.5rem 0.25rem 0.25rem; border-radius: 0.5rem;
  font-size: 0.875rem; font-weight: 500; color: var(--ui-text-toned);
  transition: background-color 150ms ease-out, color 150ms ease-out;
}
.cms-focus__back:hover { background: var(--ui-bg-elevated); color: var(--ui-text-highlighted); }
.cms-focus__crumbs { display: flex; flex-wrap: wrap; align-items: center; gap: 0.125rem; margin-top: -0.5rem; font-size: 0.8125rem; }
.cms-focus__crumb {
  display: inline-flex; align-items: center; gap: 0.3125rem; min-height: 1.75rem; padding: 0.1875rem 0.4375rem; border-radius: 0.4375rem;
  color: var(--ui-text-toned); white-space: nowrap;
  transition: background-color 150ms ease-out, color 150ms ease-out;
}
button.cms-focus__crumb:hover { background: var(--ui-bg-elevated); color: var(--ui-text-highlighted); }
.cms-focus__crumb--current { font-weight: 600; color: var(--ui-text-highlighted); background: var(--cms-nav-active); }
.cms-focus__count {
  display: inline-grid; place-items: center; min-width: 1.125rem; height: 1.125rem; padding: 0 0.3125rem; border-radius: 999px;
  font-size: 0.6875rem; font-weight: 600; font-variant-numeric: tabular-nums; color: var(--ui-bg); background: var(--ui-error);
}
.cms-focus__icon { display: grid; place-items: center; flex: none; width: 2.25rem; height: 2.25rem; border-radius: 0.625rem; background: var(--cms-nav-active); color: var(--ui-text-highlighted); }
.cms-focus__title:focus { outline: none; }
.cms-focus__title:focus-visible { outline: 2px solid var(--ui-primary); outline-offset: 2px; border-radius: 4px; }
/* A field asked for from the page: a short glow around it, so the eye finds it. */
.cms-focus__field { border-radius: 0.625rem; }
.cms-focus__flash { animation: cms-focus-flash 1.2s cubic-bezier(.2,.7,.2,1); }
@keyframes cms-focus-flash {
  0%, 35% { box-shadow: 0 0 0 4px color-mix(in srgb, var(--ui-primary) 28%, transparent); background: color-mix(in srgb, var(--ui-primary) 6%, transparent); }
  100% { box-shadow: 0 0 0 4px transparent; background: transparent; }
}
@media (prefers-reduced-motion: reduce) { .cms-focus__flash { animation-duration: 1ms; box-shadow: 0 0 0 3px color-mix(in srgb, var(--ui-primary) 28%, transparent); } }
.cms-focus__title { margin: 0; font-family: var(--cms-font-display); font-size: 1.0625rem; font-weight: 700; line-height: 1.25; color: var(--ui-text-highlighted); }
.cms-focus__settings { padding-top: 1rem; border-top: 1px solid var(--ui-border); }
.cms-focus__sub { margin: 0 0 0.875rem; font-size: 0.6875rem; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; color: var(--ui-text-muted); }
.cms-src { display: flex; flex-direction: column; gap: 0.75rem; }
.cms-src__icon { display: grid; place-items: center; flex: none; width: 1.75rem; height: 1.75rem; border-radius: 0.5rem; background: var(--cms-moment-bg); color: var(--cms-moment-text); }
.cms-src__name { margin: 0; font-size: 0.875rem; font-weight: 600; line-height: 1.35; color: var(--ui-text-highlighted); }
.cms-src__rows { display: flex; flex-direction: column; border: 1px solid var(--ui-border); border-radius: 0.625rem; overflow: hidden; }
.cms-src__rows > li + li { border-top: 1px solid var(--ui-border); }
.cms-src__row {
  display: flex; align-items: center; gap: 0.5rem; width: 100%; min-height: 2.5rem; padding: 0.5rem 0.75rem; text-align: left;
  font-size: 0.875rem; color: var(--ui-text); transition: background-color 150ms ease-out;
}
button.cms-src__row:hover { background: var(--ui-bg-elevated); }
button.cms-src__row:focus-visible { outline: 2px solid var(--ui-primary); outline-offset: -2px; }
.cms-src__pen { color: var(--ui-text-dimmed); opacity: 0; transition: opacity 150ms ease-out; }
button.cms-src__row:hover .cms-src__pen, button.cms-src__row:focus-visible .cms-src__pen { opacity: 1; }
@media (pointer: coarse) { .cms-src__pen { opacity: 1; } }
.cms-focus__foot { display: flex; flex-wrap: wrap; gap: 0.5rem; padding-top: 1rem; border-top: 1px solid var(--ui-border); }
</style>
