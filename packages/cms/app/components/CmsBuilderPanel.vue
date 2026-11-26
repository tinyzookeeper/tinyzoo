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
import type { CmsBuilderPath } from '../../shared/builder'
import { blockListFull, findBlock, isLockedBlock, issueCounts, keyOfPath } from '../../shared/block-tree'

const props = defineProps<{ entity: string; readOnly?: boolean }>()
// Text inside blocks is edited on its own (not shared), as in the form's list.
provide('cmsCollab', null)
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
const def = computed(() => (found.value ? found.value.list.defs[found.value.block.type] : undefined))
const locked = computed(() => !found.value || isLockedBlock(found.value.list.defs, found.value.block))
const key = computed(() => (owner.value && tree.value ? keyOfPath(owner.value.key, tree.value, path.value) : null))
const along = computed(() => selection.value?.along ?? [])
const name = (i: number) => tl(along.value[i]?.def?.label as any, along.value[i]?.type ?? '')
const icon = (i: number) => along.value[i]?.def?.icon ?? 'i-lucide-square'
const isSection = computed(() => path.value.length === 1)
const about = computed(() => {
  const own = tl(def.value?.description as any, '')
  if (own) return own
  return isSection.value ? t('builderPanel.ofPage') : t('builderPanel.inBlock', { name: name(path.value.length - 2) })
})

const fields = computed(() => {
  const all = (def.value?.fields ?? []).filter((f: any) => !(found.value?.index === 0 && f.meta?.needsPrevious))
  return { content: all.filter((f: any) => !f.meta?.setting), settings: all.filter((f: any) => f.meta?.setting) }
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

function set(fieldKey: string, value: unknown) {
  if (props.readOnly || !owner.value) return
  // The preview follows as it follows any typing (after a short pause).
  owner.value.set(path.value, fieldKey, value)
}
function back() {
  builder.value?.select(null)
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
  <div v-if="block" class="cms-focus" :aria-label="name(path.length - 1)" role="region">
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

    <div class="flex items-center gap-3">
      <span class="cms-focus__icon"><UIcon :name="def?.icon ?? 'i-lucide-square'" class="size-[1.125rem]" aria-hidden="true" /></span>
      <div class="min-w-0">
        <h2 class="cms-focus__title">{{ name(path.length - 1) }}</h2>
        <p class="text-xs text-muted truncate">{{ about }}</p>
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
      <div class="space-y-5">
        <CmsField
          v-for="f in fields.content" :key="f.key"
          :model-value="block[f.key]" :field="fieldOf(f)" :entity="entity" :id-prefix="`${owner?.key}-${block.id}-`"
          :error="errorOf(f)"
          @update:model-value="(v: unknown) => set(f.key, v)"
        />
      </div>
      <div v-if="fields.settings.length" role="group" :aria-labelledby="`cms-focus-${block.id}-settings`" class="cms-focus__settings">
        <h3 :id="`cms-focus-${block.id}-settings`" class="cms-focus__sub">{{ t('blocks.settings') }}</h3>
        <div class="space-y-5">
          <CmsField
            v-for="f in fields.settings" :key="f.key"
            :model-value="block[f.key]" :field="fieldOf(f)" :entity="entity" :id-prefix="`${owner?.key}-${block.id}-`"
            :error="errorOf(f)"
            @update:model-value="(v: unknown) => set(f.key, v)"
          />
        </div>
      </div>
    </template>

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
.cms-focus__title { margin: 0; font-family: var(--cms-font-display); font-size: 1.0625rem; font-weight: 700; line-height: 1.25; color: var(--ui-text-highlighted); }
.cms-focus__settings { padding-top: 1rem; border-top: 1px solid var(--ui-border); }
.cms-focus__sub { margin: 0 0 0.875rem; font-size: 0.6875rem; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; color: var(--ui-text-muted); }
.cms-focus__foot { display: flex; flex-wrap: wrap; gap: 0.5rem; padding-top: 1rem; border-top: 1px solid var(--ui-border); }
</style>
