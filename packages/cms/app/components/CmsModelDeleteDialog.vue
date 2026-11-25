<script setup lang="ts">
import type { ModelField, ModelType } from '../../src/model-doc'
import { cmsModelDeleteNeedsName, cmsModelFieldRefs, cmsModelNameMatches, cmsModelPurgeBlockers, cmsModelPurgeOp, cmsSheetUi, type CmsModelData } from '../utils/cmsModel'

// Deleting a removed type, or one of its removed fields, for good. It says what is taken, with the real
// number; when it holds something (or that cannot be read), the person types its name first. Nothing
// here can be undone, so the red button is the only red thing, and it waits for the name.
const props = defineProps<{ type: ModelType; field: ModelField | null; data: CmsModelData }>()
const emit = defineEmits<{ done: [] }>()
const open = defineModel<boolean>('open', { default: false })
const { t, tl } = useCmsI18n()
const toast = useToast()
const model = useCmsModel()

const loading = ref(false)
const saving = ref(false)
const failed = ref('')
const typed = ref('')
/** How many entries (a type) or values (a field) it holds; null when that could not be read. */
const count = ref<number | null>(null)
// The fields that still link to the type: from the document, then from the server's answer when it names others.
const refs = ref<{ type: string; key: string }[]>([])

const name = computed(() => tl((props.field ?? props.type).label as any, props.field?.key ?? props.type.name))
const read = (label: any) => tl(label, '')
const pointing = computed(() => cmsModelFieldRefs(props.data.doc, refs.value, read))
const needsName = computed(() => cmsModelDeleteNeedsName(count.value))
const matches = computed(() => cmsModelNameMatches(typed.value, name.value))
const canDelete = computed(() => !loading.value && !saving.value && !refs.value.length && (!needsName.value || matches.value))

async function load() {
  failed.value = ''
  typed.value = ''
  count.value = null
  refs.value = props.field ? [] : cmsModelPurgeBlockers(props.data.doc, props.type.name)
  loading.value = true
  try {
    const query = props.field ? `type=${encodeURIComponent(props.type.name)}&field=${encodeURIComponent(props.field.key)}` : `type=${encodeURIComponent(props.type.name)}`
    const res = await cmsFetch<{ entries?: number; values?: number | null }>(`/api/cms/_model/usage?${query}`)
    const n = props.field ? res.values : res.entries
    count.value = typeof n === 'number' ? n : null
  }
  // An unreadable answer is not a reason to stop: the name has to be typed then.
  catch {
    count.value = props.field ? null : (props.data.entries[props.type.name] ?? null)
  }
  finally {
    loading.value = false
  }
}
watch(open, (on) => { if (on) load() }, { immediate: true })

async function remove() {
  if (!canDelete.value) return
  failed.value = ''
  saving.value = true
  try {
    const res = await model.change([cmsModelPurgeOp(props.type.name, props.field?.key)], { quiet: true })
    if (res.ok) {
      toast.add({ title: t('model.delete.done', { name: name.value }), icon: 'i-lucide-check', color: 'success' })
      open.value = false
      emit('done')
      return
    }
    const { problem } = res
    if (problem.code === 'points-at-type' && problem.fields) refs.value = problem.fields
    else failed.value = problem.text
  }
  finally {
    saving.value = false
  }
}
</script>

<template>
  <UModal v-model:open="open" :title="t('model.delete.title', { name })" :ui="cmsSheetUi('sm:max-w-lg')">
    <template #body>
      <p v-if="loading" class="flex items-center gap-2 text-sm text-muted" role="status">
        <UIcon name="i-lucide-loader-circle" class="size-4 animate-spin" aria-hidden="true" />{{ t('model.delete.loading') }}
      </p>
      <div v-else class="flex flex-col gap-5">
        <!-- fields that still link to the type: they go first -->
        <div v-if="pointing.length" class="flex flex-col gap-3">
          <p class="flex items-start gap-3 text-sm text-default text-pretty">
            <UIcon name="i-lucide-link-2" class="mt-0.5 size-4 shrink-0 text-muted" aria-hidden="true" />
            <span>{{ t('model.delete.pointedBy') }}</span>
          </p>
          <ul class="cms-card overflow-hidden text-sm">
            <li v-for="p in pointing" :key="`${p.type}-${p.key}`" class="border-b border-default last:border-0">
              <NuxtLink :to="`/admin/_model/${p.type}`" class="flex min-h-11 items-center gap-2 px-3 py-2 transition-colors hover:bg-elevated/60" @click="() => { open = false }">
                <span class="min-w-0 flex-1 truncate text-highlighted">{{ t('model.remove.fieldIn', { field: p.fieldLabel, type: p.typeLabel }) }}</span>
                <UIcon name="i-lucide-arrow-up-right" class="size-3.5 shrink-0 text-dimmed" aria-hidden="true" />
              </NuxtLink>
            </li>
          </ul>
        </div>

        <template v-else>
          <div class="flex flex-col gap-3">
            <p class="flex items-start gap-3 text-sm text-default text-pretty">
              <UIcon name="i-lucide-trash-2" class="mt-0.5 size-4 shrink-0 text-muted" aria-hidden="true" />
              <span v-if="field">
                <template v-if="count === null">{{ t('model.delete.fieldUnknown') }}</template>
                <template v-else-if="count === 0">{{ t('model.delete.fieldEmpty') }}</template>
                <template v-else>{{ t('model.delete.fieldValues', { count }) }}</template>
              </span>
              <span v-else>
                <template v-if="count === null">{{ t('model.delete.typeUnknown') }}</template>
                <template v-else-if="count === 0">{{ t('model.delete.typeEmpty') }}</template>
                <template v-else>{{ t('model.delete.typeEntries', { count }) }}</template>
              </span>
            </p>
            <p class="flex items-start gap-3 text-sm text-default text-pretty">
              <UIcon name="i-lucide-image" class="mt-0.5 size-4 shrink-0 text-muted" aria-hidden="true" />
              <span>{{ t('model.delete.media') }}</span>
            </p>
            <p class="flex items-start gap-3 text-sm font-medium text-highlighted text-pretty">
              <UIcon name="i-lucide-circle-alert" class="mt-0.5 size-4 shrink-0 text-muted" aria-hidden="true" />
              <span>{{ t('model.delete.noUndo') }}</span>
            </p>
          </div>

          <div v-if="needsName" class="flex flex-col gap-2">
            <label for="cms-model-delete-name" class="text-sm text-default text-pretty">{{ t('model.delete.typeName', { name }) }}</label>
            <UInput
              id="cms-model-delete-name" v-model="typed" class="w-full" autocomplete="off" autocapitalize="off" spellcheck="false"
              :placeholder="name" @keydown.enter.prevent="remove"
            />
          </div>
        </template>

        <UAlert v-if="failed" color="error" variant="subtle" icon="i-lucide-circle-alert" :title="failed" role="alert" data-cms-error-summary />
      </div>
    </template>
    <template #footer>
      <div class="flex w-full justify-end gap-2">
        <UButton v-if="refs.length" color="neutral" variant="outline" @click="() => { open = false }">{{ t('common.close') }}</UButton>
        <template v-else>
          <UButton color="neutral" variant="ghost" @click="() => { open = false }">{{ t('common.cancel') }}</UButton>
          <UButton color="error" icon="i-lucide-trash-2" class="disabled:opacity-40" :loading="saving" :disabled="!canDelete" @click="remove">{{ t('model.delete.confirm') }}</UButton>
        </template>
      </div>
    </template>
  </UModal>
</template>
