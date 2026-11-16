<script setup lang="ts">
// A group: a named object of fields (an address, a contact) kept together. Shown as a
// fieldset — the group's own label sits above it (CmsField), its fields inside, each
// with its own label, help and error. An optional group left untouched stays empty
// (null), so a form with an unused address does not store one.
// `id` is the control id CmsField makes for the field (its label is `${id}-label`).
const props = defineProps<{ field: any; entity: string; id?: string }>()
// Text inside a group is edited on its own (not shared), even on a shared entry.
provide('cmsCollab', null)
const model = defineModel<Record<string, any> | null>()
const form = inject<{ issues?: Record<string, string> } | null>('cmsForm', null)

const inner = computed<any[]>(() => props.field.meta?.fields ?? [])
const value = computed<Record<string, any>>(() => (model.value && typeof model.value === 'object' ? model.value : {}))

/** A group inside this one (or a list) is addressed by its full path, so errors and ids find it. */
const nested = (f: any) => (f.type === 'blocks' || f.type === 'group' ? { ...f, key: `${props.field.key}.${f.key}` } : f)

/** Nothing typed in a value: empty text, an empty list, a rich-text document with no content, a switch that is off. */
function blank(v: unknown): boolean {
  if (v === null || v === undefined || v === '' || v === false) return true
  if (Array.isArray(v)) return v.length === 0
  if (typeof v === 'object') {
    const o = v as Record<string, any>
    if (o.type === 'doc') return !JSON.stringify(o.content ?? []).includes('"text"') && !JSON.stringify(o.content ?? []).includes('"image"')
    return Object.values(o).every(blank)
  }
  return false
}

/** Inner controls get ids under the group's own, so two groups never share one. */
const innerPrefix = computed(() => `${(props.id ?? `cms-field-${props.field.key}`).replace(/^cms-field-/, '')}-`)

function set(key: string, v: unknown) {
  const next = { ...value.value, [key]: v }
  model.value = props.field.optional && Object.values(next).every(blank) ? null : next
}
</script>

<template>
  <fieldset
    class="min-w-0 space-y-5 rounded-(--ui-radius) border border-default px-4 py-4"
    :aria-labelledby="id ? `${id}-label` : undefined"
    data-cms-group
  >
    <CmsField
      v-for="f in inner" :key="f.key"
      :model-value="value[f.key]" :field="nested(f)" :entity="entity" :id-prefix="innerPrefix"
      :error="form?.issues?.[`${field.key}.${f.key}`]"
      @update:model-value="(v: unknown) => set(f.key, v)"
    />
  </fieldset>
</template>
