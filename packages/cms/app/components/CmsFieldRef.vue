<script setup lang="ts">
// The control of a small block's reference to a field of the entry its card shows (`customTypeFieldRef`):
// a choice among the fields of the card's content type that the block can show (a heading takes texts,
// a picture takes pictures, a button takes links and the entry's page). The card's binding comes from the
// section around the block (the `cmsCardSource` the block lists provide); with none, or no type chosen
// yet, it says so. What is stored may name a field that is gone or does not fit: that is said under the
// choice, it stays until a person chooses again or clears it, and nothing here throws on an odd value.
import type { Ref } from 'vue'
import type { CustomFieldKind } from '../../src/custom-kinds'
import { isCustomFieldKind } from '../../src/custom-kinds'
import { cmsBindingRead, cmsBindingTypes } from '../utils/cmsBinding'
import { CMS_REF_KIND_ICONS, cmsRefFitting, cmsRefState } from '../utils/cmsFieldRef'

const props = defineProps<{ field: any; entity?: string; id?: string; readOnly?: boolean }>()
const model = defineModel<any>()
const { t, tl } = useCmsI18n()
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
  </div>
</template>
