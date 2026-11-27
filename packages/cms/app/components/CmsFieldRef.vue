<script setup lang="ts">
// The control of a small block's reference to a field of the entry its card shows (`customTypeFieldRef`):
// a choice among the fields of the card's content type that the block can show (a heading takes texts,
// a picture takes pictures, a button takes links and the entry's page). The card's binding comes from the
// section around the block (the `cmsCardSource` the block lists provide); with none, or no type chosen
// yet, it says so. What is stored may name a field that is gone or does not fit: that is said under the
// choice, it stays until a person chooses again or clears it, and nothing here throws on an odd value.
//
// With the editor in the preview on (NUXT_CMS_BUILDER=on) the choice is a group of rows instead of a
// select (part 3c): each row has the field's icon, its name and an example of its value from one entry of
// the card's type, a check on the chosen one and a small tag when another block of the card shows it
// already; a block with a text of its own gets a last row for it. Under the rows, what does not fit and
// what the block takes. A stored field that is gone or does not fit is the first row, chosen but dashed,
// and a notice above. Pointing at a row (hover or focus) says so to the page (`cardTry`).
import type { Ref } from 'vue'
import type { CustomFieldKind } from '../../src/custom-kinds'
import { isCustomFieldKind } from '../../src/custom-kinds'
import { cardExample, cardKindsList, cardRowFields, cardUsedElsewhere } from '../../shared/builder-card'
import { cmsBindingRead, cmsBindingTypes } from '../utils/cmsBinding'
import { CMS_REF_KIND_ICONS, cmsFieldIdPrefix, cmsRefFitting, cmsRefState, type CmsCardBlock, type CmsCardBlockOf } from '../utils/cmsFieldRef'

const props = defineProps<{ field: any; entity?: string; id?: string; readOnly?: boolean }>()
const model = defineModel<any>()
const { t, tl, locale } = useCmsI18n()
const { data: graph } = useNuxtData<any[]>('cms-graph')
const source = inject<Ref<unknown> | null>('cmsCardSource', null)

const NONE = '\u0000none'
const takes = computed<CustomFieldKind[]>(() => {
  const list = props.field?.meta?.ref?.takes
  return Array.isArray(list) ? list.filter(isCustomFieldKind) : []
})
const hasCard = computed(() => !!source && source.value !== undefined)
const binding = computed(() => cmsBindingRead(source?.value))
const type = computed(() => cmsBindingTypes(graph.value).find((x) => x.name === binding.value?.type))
const stored = computed(() => (typeof model.value === 'string' && model.value ? model.value : null))
const state = computed(() => cmsRefState(model.value, type.value, takes.value))
const fitting = computed(() => (type.value ? cmsRefFitting(type.value, takes.value) : []))
const typeName = computed(() => (type.value ? tl(type.value.label, type.value.name) : ''))
// The entry's own page is named as such, not by the label of its address.
const nameOf = (f: { key: string; label: string | object; kind?: string }) => (f.kind === 'page' ? t('fieldRef.page') : tl(f.label as any, f.key))

const items = computed(() => [
  ...(stored.value ? [{ value: NONE, label: t('model.binding.nothing') }] : []),
  ...fitting.value.map((f) => ({ value: f.key, label: nameOf(f), icon: CMS_REF_KIND_ICONS[f.kind] })),
])
const chosen = computed(() => (state.value.state === 'ok' ? state.value.field.key : undefined))
const leadingIcon = computed(() => (state.value.state === 'ok' ? CMS_REF_KIND_ICONS[state.value.field.kind] : undefined))
const placeholder = computed(() => {
  const s = state.value
  if (s.state === 'gone') return s.key
  if (s.state === 'unfit') return nameOf(s.field)
  return t('fieldRef.placeholder')
})
function choose(v: string | undefined) {
  model.value = !v || v === NONE ? null : v
}
const clear = () => { model.value = null }

// ── the rows (the editor in the preview on) ──
const builderOn = useCmsBuilderOn()
const builder = useCmsBuilder()
const cardBlock = inject<Ref<CmsCardBlock | undefined> | null>('cmsCardBlock', null)
const blockOf = inject<CmsCardBlockOf | null>('cmsCardBlockOf', null)
// Entries are only asked for while the rows are shown.
const { row: exampleRow, title: exampleTitle, card } = useCmsCardExample(
  () => (builderOn.value && type.value ? type.value.name : null),
  () => cardBlock?.value?.path0 ?? null,
)
const ownKey = computed<string | null>(() => (typeof props.field?.meta?.ref?.own === 'string' && props.field.meta.ref.own ? props.field.meta.ref.own : null))
const here = computed(() => {
  const prefix = cmsFieldIdPrefix(props.id, props.field?.key)
  return prefix === null ? undefined : blockOf?.(prefix)
})
const ownText = computed(() => {
  const v = ownKey.value ? here.value?.block?.[ownKey.value] : null
  return typeof v === 'string' ? v.trim() : ''
})
const used = computed(() => (cardBlock?.value ? cardUsedElsewhere(cardBlock.value.block, cardBlock.value.def, stored.value) : new Set<string>()))
const split = computed(() => cardRowFields(card.type.value, takes.value))
const kindWord = (k: CustomFieldKind) => t(`card.kinds.${k}` as 'card.kinds.text')
const exampleOf = (f: { key: string; kind: CustomFieldKind; label: string; choices?: Record<string, string> }) => {
  const prefix = card.meta.value?.pagePrefix ?? null
  if (!exampleRow.value) return f.kind === 'page' && prefix ? `/${prefix}/…` : t(`card.kindsOne.${f.kind}` as 'card.kindsOne.text')
  return cardExample(f, exampleRow.value, locale.value, prefix) || t('card.empty')
}
const rows = computed(() => split.value.fits.map((f) => ({
  key: f.key, kind: f.kind, icon: CMS_REF_KIND_ICONS[f.kind], label: nameOf(f), example: exampleOf(f),
  tag: used.value.has(f.key), checked: state.value.state === 'ok' && state.value.field.key === f.key,
})))
const misfits = computed(() => split.value.misfits.map((f) => ({ key: f.key, icon: CMS_REF_KIND_ICONS[f.kind], label: nameOf(f) })))
const takesText = computed(() => {
  const list = cardKindsList(takes.value, (k) => kindWord(k as CustomFieldKind), locale.value)
  const base = list ? t('card.takes', { list }) : ''
  return [base, exampleTitle.value ? t('card.examples', { title: exampleTitle.value }) : ''].filter(Boolean).join(' ')
})
/** A stored field that is gone or does not fit: said above the rows, and the first row. */
const broken = computed(() => {
  const s = state.value
  if (s.state === 'gone') return { key: s.key, label: s.key === 'slug' ? t('fieldRef.page') : s.key, note: t('card.goneRow'), warn: s.key === 'slug' ? t('card.warnPages', { type: typeName.value }) : t('card.warnGone', { name: s.key, type: typeName.value }) }
  if (s.state === 'unfit') return { key: s.field.key, label: nameOf(s.field), note: t('card.unfitRow'), warn: t('card.warnUnfit', { name: nameOf(s.field) }) }
  return null
})
const ownChecked = computed(() => state.value.state === 'empty' && ownText.value !== '')
const showOwn = computed(() => !!ownKey.value)

const group = ref<HTMLElement | null>(null)
const lastFocus = ref<string | null>(null)
const firstKey = computed(() => rows.value.find((r) => r.checked)?.key ?? (showOwn.value && ownChecked.value ? '@own' : rows.value[0]?.key ?? (showOwn.value ? '@own' : null)))
const tabKey = computed(() => (lastFocus.value && (rows.value.some((r) => r.key === lastFocus.value) || (showOwn.value && lastFocus.value === '@own')) ? lastFocus.value : firstKey.value))
function onKey(e: KeyboardEvent) {
  const step = ({ ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 } as Record<string, number>)[e.key]
  const radios = [...(group.value?.querySelectorAll<HTMLElement>('[role="radio"]:not([aria-disabled="true"])') ?? [])]
  if (!radios.length || (step === undefined && e.key !== 'Home' && e.key !== 'End')) return
  const at = radios.indexOf(document.activeElement as HTMLElement)
  const next = e.key === 'Home' ? 0 : e.key === 'End' ? radios.length - 1 : (at + step! + radios.length) % radios.length
  e.preventDefault()
  radios[next]?.focus()
}
/** Pointing at a row: the page may try the field on the card (hover or focus); leaving says it is no longer pointed at. */
function point(key: string | null) {
  const b = builder.value
  if (!b) return
  const path = here.value?.path
  b.cardTry.value = key && path ? { path: [...path], field: key } : null
}
onBeforeUnmount(() => point(null))
function pick(key: string) {
  if (props.readOnly) return
  model.value = key
}
/** The own text: no field named; the text's input (it shows now) takes the keyboard. */
function pickOwn() {
  if (props.readOnly) return
  model.value = ''
  const prefix = cmsFieldIdPrefix(props.id, props.field?.key)
  if (!prefix || !ownKey.value) return
  const id = `cms-field-${prefix}${ownKey.value}`
  let tries = 0
  const attempt = () => {
    const box = document.getElementById(id)
    const input = box?.matches('input, textarea') ? box : box?.querySelector<HTMLElement>('input, textarea')
    if (input) input.focus()
    else if (++tries < 20) requestAnimationFrame(attempt)
  }
  void nextTick(attempt)
}
const warnClass = 'flex items-start gap-2 rounded-md bg-warning/10 px-2.5 py-1.5 text-sm text-default'
</script>

<template>
  <div class="w-full min-w-0 space-y-1.5">
    <!-- no card around the block -->
    <p v-if="!hasCard" class="text-sm text-muted text-pretty">{{ t('fieldRef.noCard') }}</p>

    <!-- the section shows no type yet; a stored field is still named -->
    <template v-else-if="!binding">
      <p class="text-sm text-muted text-pretty">{{ t('fieldRef.noType') }}</p>
      <p v-if="stored" class="flex items-center gap-2 text-sm text-default">
        <span class="min-w-0 flex-1 truncate">{{ stored }}</span>
        <UButton
          color="neutral" variant="ghost" size="xs" icon="i-lucide-x" :disabled="readOnly" class="shrink-0 pointer-coarse:size-11"
          :aria-label="t('fieldRef.clear')" @click="clear"
        />
      </p>
    </template>

    <!-- the type is no longer among the site's own -->
    <p v-else-if="!type" role="status" :class="warnClass">
      <UIcon name="i-lucide-triangle-alert" class="mt-0.5 size-4 shrink-0 text-warning" aria-hidden="true" />
      <span class="min-w-0 flex-1 break-words">{{ t('model.binding.missingType', { name: binding.type }) }}<template v-if="stored"> · {{ stored }}</template></span>
      <UButton
        v-if="stored" color="neutral" variant="ghost" size="xs" icon="i-lucide-x" :disabled="readOnly" class="shrink-0 pointer-coarse:size-11"
        :aria-label="t('fieldRef.clear')" @click="clear"
      />
    </p>

    <template v-else>
      <template v-if="builderOn">
        <p v-if="broken" role="status" :class="warnClass">
          <UIcon name="i-lucide-unlink" class="mt-0.5 size-4 shrink-0 text-warning" aria-hidden="true" />
          <span class="min-w-0 flex-1 break-words">{{ broken.warn }}</span>
          <UButton
            color="neutral" variant="ghost" size="xs" icon="i-lucide-x" :disabled="readOnly" class="shrink-0 pointer-coarse:size-11"
            :aria-label="t('fieldRef.clear')" @click="clear"
          />
        </p>
        <p v-if="!rows.length && !showOwn && !broken" class="text-sm text-muted text-pretty">{{ t('fieldRef.noneFit', { type: typeName }) }}</p>
        <div
          v-else ref="group" role="radiogroup" :aria-labelledby="id ? `${id}-label` : undefined" class="cms-ref" @keydown="onKey"
        >
          <div v-if="broken" class="cms-ref__row cms-ref__row--gone" role="radio" aria-checked="true" aria-disabled="true">
            <span class="cms-ref__icon"><UIcon name="i-lucide-unlink" class="size-3.5" aria-hidden="true" /></span>
            <span class="cms-ref__text"><b>{{ broken.label }}</b><em>{{ broken.note }}</em></span>
            <UIcon name="i-lucide-check" class="cms-ref__check size-4" aria-hidden="true" />
          </div>
          <button
            v-for="r in rows" :key="r.key" type="button" role="radio" class="cms-ref__row" :aria-checked="r.checked" :disabled="readOnly"
            :tabindex="tabKey === r.key ? 0 : -1"
            @click="pick(r.key)" @pointerenter="point(r.key)" @pointerleave="point(null)" @focus="lastFocus = r.key; point(r.key)" @blur="point(null)"
          >
            <span class="cms-ref__icon"><UIcon :name="r.icon" class="size-3.5" aria-hidden="true" /></span>
            <span class="cms-ref__text"><b>{{ r.label }}</b><em>{{ r.example }}</em></span>
            <span v-if="r.tag" class="cms-ref__tag">{{ t('card.onCard') }}</span>
            <UIcon name="i-lucide-check" class="cms-ref__check size-4" aria-hidden="true" />
          </button>
          <button
            v-if="showOwn" type="button" role="radio" class="cms-ref__row cms-ref__row--own" :aria-checked="ownChecked" :disabled="readOnly"
            :tabindex="tabKey === '@own' ? 0 : -1" @click="pickOwn" @focus="lastFocus = '@own'"
          >
            <span class="cms-ref__icon"><UIcon name="i-lucide-pen-line" class="size-3.5" aria-hidden="true" /></span>
            <span class="cms-ref__text"><b>{{ t('card.own') }}</b><em>{{ t('card.ownHelp') }}</em></span>
            <UIcon name="i-lucide-check" class="cms-ref__check size-4" aria-hidden="true" />
          </button>
        </div>
        <p v-if="misfits.length" class="cms-ref__misfit">
          <span>{{ t('card.misfit') }}</span>
          <span v-for="m in misfits" :key="m.key" class="cms-ref__mf"><UIcon :name="m.icon" class="size-3" aria-hidden="true" />{{ m.label }}</span>
        </p>
        <p v-if="takesText" class="text-xs text-muted text-pretty">{{ takesText }}</p>
      </template>
      <template v-else>
      <p v-if="!fitting.length && !stored" class="text-sm text-muted text-pretty">{{ t('fieldRef.noneFit', { type: typeName }) }}</p>
      <USelect
        v-else
        :id="id" :model-value="chosen" :items="items" :icon="leadingIcon" :placeholder="placeholder" :disabled="readOnly"
        class="w-full" :ui="{ value: 'truncate' }" @update:model-value="choose"
      />
      <p v-if="state.state === 'gone' || state.state === 'unfit'" role="status" :class="warnClass">
        <UIcon name="i-lucide-triangle-alert" class="mt-0.5 size-4 shrink-0 text-warning" aria-hidden="true" />
        <span class="min-w-0 flex-1 break-words">
          {{ state.state === 'gone' ? t('fieldRef.gone', { type: typeName, key: state.key }) : t('fieldRef.unfit', { name: nameOf(state.field) }) }}
        </span>
        <UButton
          color="neutral" variant="ghost" size="xs" icon="i-lucide-x" :disabled="readOnly" class="shrink-0 pointer-coarse:size-11"
          :aria-label="t('fieldRef.clear')" @click="clear"
        />
      </p>
      <p v-if="!fitting.length && stored" class="text-sm text-muted text-pretty">{{ t('fieldRef.noneFit', { type: typeName }) }}</p>
      </template>
    </template>
  </div>
</template>

<style scoped>
.cms-ref { display: flex; flex-direction: column; gap: 0.25rem; }
.cms-ref__row {
  display: flex; align-items: center; gap: 0.625rem; width: 100%; min-width: 0; padding: 0.4375rem 0.625rem; text-align: left;
  border: 1px solid var(--ui-border); border-radius: 0.625rem; background: var(--ui-bg); color: var(--ui-text);
  transition: border-color 150ms ease-out, background-color 150ms ease-out;
}
button.cms-ref__row:not(:disabled):hover { border-color: var(--ui-border-accented); background: var(--ui-bg-elevated); }
button.cms-ref__row:focus-visible { outline: 2px solid var(--ui-primary); outline-offset: 2px; }
button.cms-ref__row:disabled { cursor: not-allowed; opacity: 0.6; }
.cms-ref__row[aria-checked="true"] { border-color: var(--ui-primary); background: color-mix(in srgb, var(--ui-primary) 7%, var(--ui-bg)); }
.cms-ref__row--gone {
  border-style: dashed; border-color: color-mix(in srgb, var(--ui-warning) 45%, transparent);
  background: color-mix(in srgb, var(--ui-warning) 10%, transparent); color: var(--ui-text); cursor: default;
}
.cms-ref__row--own { margin-top: 0.25rem; }
.cms-ref__icon {
  display: grid; place-items: center; flex: none; width: 1.625rem; height: 1.625rem; border-radius: 0.4375rem;
  background: var(--ui-bg-elevated); color: var(--ui-text-toned);
}
.cms-ref__row--gone .cms-ref__icon { background: color-mix(in srgb, var(--ui-warning) 18%, transparent); color: var(--ui-warning); }
.cms-ref__text { display: flex; flex-direction: column; flex: 1; min-width: 0; line-height: 1.3; font-size: 0.875rem; }
.cms-ref__text b { font-weight: 600; color: var(--ui-text-highlighted); overflow-wrap: anywhere; }
.cms-ref__text em { font-style: normal; font-size: 0.75rem; color: var(--ui-text-muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.cms-ref__tag {
  flex: none; padding: 0.0625rem 0.3125rem; border: 1px solid var(--ui-border-accented); border-radius: 0.3125rem;
  font-size: 0.65625rem; font-weight: 500; color: var(--ui-text-muted); white-space: nowrap;
}
.cms-ref__check { flex: none; color: var(--ui-primary); opacity: 0; transition: opacity 150ms ease-out; }
.cms-ref__row[aria-checked="true"] .cms-ref__check { opacity: 1; }
.cms-ref__misfit { display: flex; flex-wrap: wrap; align-items: center; gap: 0.3125rem; margin: 0.125rem 0 0; font-size: 0.75rem; color: var(--ui-text-muted); }
.cms-ref__mf {
  display: inline-flex; align-items: center; gap: 0.25rem; padding: 0.125rem 0.4375rem 0.125rem 0.3125rem; border-radius: 0.375rem;
  background: var(--ui-bg-elevated); text-decoration: line-through; text-decoration-color: var(--ui-border-accented);
}
@media (prefers-reduced-motion: reduce) {
  .cms-ref__row, .cms-ref__check { transition-duration: 1ms; }
}
</style>
