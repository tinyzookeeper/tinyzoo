<script setup lang="ts">
// The editor in the preview (experimental, NUXT_CMS_BUILDER=on), since 2g: beside the save button, what
// one save stores when it is more than the page: "Stránka a 2 záznamy". A click lists them: the page when
// it has changes, then each entry or global changed in the page with the fields that changed, why its last
// save was refused, a way to open it beside the page and a way to drop its changes. Nothing is drawn while
// only the page itself has changes (or with the switch off).
const props = defineProps<{
  /** The page being edited: whether it has changes of its own, what it is ("Stránka") and its title. */
  page: { dirty: boolean; label: string; title: string; icon?: string }
}>()
const { t, fieldLabel } = useCmsI18n()
const builder = useCmsBuilder()
const { data: graph } = useNuxtData<any[]>('cms-graph')

const pending = computed(() => builder.value?.pending ?? null)
const entries = computed(() => pending.value?.entries.value ?? [])
const count = computed(() => entries.value.length)
const others = computed(() => t('builderPending.others', { count: count.value }))
const label = computed(() => (props.page.dirty ? t('builderPending.pageAnd', { page: props.page.label, others: others.value }) : others.value))
const failed = computed(() => entries.value.some((e) => e.error))
const metaOf = (entity: string) => (graph.value ?? []).find((e: any) => e.name === entity)
const rows = computed(() => entries.value.map((e) => {
  const meta = metaOf(e.entity)
  const fields = Object.keys(e.values).map((key) => {
    const field = (meta?.fields ?? []).find((f: any) => f.key === key)
    return field ? fieldLabel(field) : key
  })
  return { entry: e, name: pending.value!.title(e), icon: meta?.icon ?? (e.global ? 'i-lucide-settings-2' : 'i-lucide-folder'), fields: fields.join(', ') }
}))
const open = ref(false)
function edit(entity: string, id: string) {
  open.value = false
  builder.value?.editEntry(entity, id)
}
</script>

<template>
  <UPopover v-if="pending && count" v-model:open="open" :content="{ align: 'end', sideOffset: 8 }">
    <UButton
      size="sm" color="neutral" variant="ghost" :icon="failed ? 'i-lucide-triangle-alert' : 'i-lucide-layers'"
      class="cms-pend__chip" :class="failed ? 'cms-pend__chip--failed' : ''" :aria-label="`${t('builderPending.title')}: ${label}`" data-cms-pending
    >
      <span class="max-md:hidden">{{ label }}</span>
      <span class="md:hidden tabular-nums">{{ count + (page.dirty ? 1 : 0) }}</span>
    </UButton>
    <template #content>
      <div class="cms-pend" data-cms-pending-list>
        <p class="cms-pend__title">{{ t('builderPending.title') }}</p>
        <ul class="cms-pend__rows">
          <li v-if="page.dirty" class="cms-pend__row">
            <span class="cms-pend__icon"><UIcon :name="page.icon ?? 'i-lucide-file-text'" class="size-4" aria-hidden="true" /></span>
            <div class="min-w-0 flex-1">
              <p class="cms-pend__name">{{ page.label }}</p>
              <p class="cms-pend__sub truncate">{{ page.title }}</p>
            </div>
          </li>
          <li v-for="r in rows" :key="`${r.entry.entity}:${r.entry.id}`" class="cms-pend__row">
            <span class="cms-pend__icon"><UIcon :name="r.icon" class="size-4" aria-hidden="true" /></span>
            <div class="min-w-0 flex-1">
              <p class="cms-pend__name">{{ r.name }}</p>
              <p class="cms-pend__sub">{{ t('builderPending.changed', { fields: r.fields }) }}</p>
              <p v-if="r.entry.error" role="alert" class="cms-pend__error">{{ r.entry.error }}</p>
              <div class="cms-pend__acts">
                <UButton size="xs" color="neutral" variant="outline" icon="i-lucide-pencil" @click="edit(r.entry.entity, r.entry.id)">{{ t('builderSources.edit') }}</UButton>
                <UButton size="xs" color="neutral" variant="ghost" icon="i-lucide-undo-2" @click="pending.discard(r.entry.entity, r.entry.id)">{{ t('builderPending.discard') }}</UButton>
              </div>
            </div>
          </li>
        </ul>
      </div>
    </template>
  </UPopover>
</template>

<style scoped>
.cms-pend__chip { color: var(--ui-text-toned); }
.cms-pend__chip--failed { color: var(--ui-error); }
.cms-pend { width: min(22rem, calc(100vw - 2rem)); padding: 0.875rem; }
.cms-pend__title { margin: 0 0 0.625rem; font-size: 0.6875rem; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; color: var(--ui-text-muted); }
.cms-pend__rows { display: flex; flex-direction: column; gap: 0.75rem; max-height: min(24rem, 60vh); overflow-y: auto; }
.cms-pend__row { display: flex; align-items: flex-start; gap: 0.625rem; }
.cms-pend__row + .cms-pend__row { padding-top: 0.75rem; border-top: 1px solid var(--ui-border); }
.cms-pend__icon { display: grid; place-items: center; flex: none; width: 1.75rem; height: 1.75rem; border-radius: 0.5rem; background: var(--cms-moment-bg); color: var(--cms-moment-text); }
.cms-pend__name { margin: 0; font-size: 0.875rem; font-weight: 600; line-height: 1.35; color: var(--ui-text-highlighted); overflow-wrap: anywhere; }
.cms-pend__sub { margin: 0.0625rem 0 0; font-size: 0.8125rem; color: var(--ui-text-muted); }
.cms-pend__error { margin: 0.25rem 0 0; font-size: 0.8125rem; color: var(--ui-error); }
.cms-pend__acts { display: flex; flex-wrap: wrap; gap: 0.375rem; margin-top: 0.5rem; }
</style>
