<script setup lang="ts">
import type { ModelField, ModelType } from '../../src/model-doc'
import {
  cmsModelDistinctPlaces, cmsModelFieldRefs, cmsModelNotesText, cmsModelPlaceBlock, cmsModelPointingAt, cmsModelPurgeFromNow, cmsModelRemoveOp,
  type CmsModelData, type CmsModelPlace,
} from '../utils/cmsModel'

// Removing a type or a field hides it, for good: its content is kept and it can be restored at any time.
// Only what holds nothing is deleted by the server, an hour later. The dialog says first where it is
// still used (and then offers no button), then what happens to the content.
const props = defineProps<{ type: ModelType; field: ModelField | null; data: CmsModelData }>()
const emit = defineEmits<{ done: [] }>()
const open = defineModel<boolean>('open', { default: false })
const { t, tl, formatDateWith, entityLabel } = useCmsI18n()
const toast = useToast()
const model = useCmsModel()
const { data: graph } = useNuxtData<any[]>('cms-graph')

type Place = CmsModelPlace
const loading = ref(false)
const saving = ref(false)
const places = ref<Place[]>([])
// How many entries hold a value of the field (null when that cannot be read).
const values = ref<number | null>(null)
// The fields that link to this type: from the document, then from the server's answer when it names others.
const refs = ref<{ type: string; key: string }[]>([])
const failed = ref('')
// The website's code reads what the removal takes away (409 `breaks-code`): the refusal in words.
const codeRefusal = ref('')

const name = computed(() => tl((props.field ?? props.type).label as any, props.field?.key ?? props.type.name))
const read = (label: any) => tl(label, '')
const blocked = computed(() => places.value.length > 0 || refs.value.length > 0 || !!codeRefusal.value)
const pointing = computed(() => cmsModelFieldRefs(props.data.doc, refs.value, read))
const entries = computed(() => props.data.entries[props.type.name] ?? 0)
// What holds nothing is deleted by the server an hour after it is removed; everything else stays until a person deletes it.
const holdsNothing = computed(() => (props.field ? values.value === 0 : entries.value === 0))
const purgeAt = computed(() => cmsModelPurgeFromNow())

const placeTitle = (p: Place) => p.title || entityLabel((graph.value ?? []).find((g: any) => g.name === p.entity)) || p.entity
const placeKind = (p: Place) => (p.title ? entityLabel((graph.value ?? []).find((g: any) => g.name === p.entity)) : '')
const distinct = (all: Place[]) => cmsModelDistinctPlaces(all)
const blockName = (p: Place) => cmsModelPlaceBlock(p, tl)

async function load() {
  places.value = []
  values.value = null
  failed.value = ''
  codeRefusal.value = ''
  refs.value = props.field ? [] : cmsModelPointingAt(props.data.doc, props.type.name)
  loading.value = true
  try {
    const query = props.field ? `type=${encodeURIComponent(props.type.name)}&field=${encodeURIComponent(props.field.key)}` : `type=${encodeURIComponent(props.type.name)}`
    const res = await cmsFetch<{ places: Place[]; values?: number | null }>(`/api/cms/_model/usage?${query}`)
    places.value = distinct(res.places ?? [])
    values.value = typeof res.values === 'number' ? res.values : null
  }
  // The server checks again when the button is pressed, so an unreadable answer is not a reason to stop here.
  catch { /* nothing to list */ }
  finally {
    loading.value = false
  }
}
watch(open, (on) => { if (on) load() }, { immediate: true })

async function remove() {
  failed.value = ''
  saving.value = true
  try {
    const res = await model.change([cmsModelRemoveOp(props.type.name, props.field?.key)], { quiet: true })
    if (res.ok) {
      const description = cmsModelNotesText(res.result.notes, t as any)
      toast.add({ title: t('model.remove.done', { name: name.value }), ...(description ? { description } : {}), icon: 'i-lucide-check', color: 'success' })
      open.value = false
      emit('done')
      if (!props.field) await navigateTo('/admin/_model')
      return
    }
    const { problem } = res
    if (problem.kind === 'in-use') places.value = distinct(problem.places ?? [])
    else if (problem.code === 'points-at-type' && problem.fields) refs.value = problem.fields
    else if (problem.kind === 'breaks-code') codeRefusal.value = problem.text
    else failed.value = problem.text
  }
  finally {
    saving.value = false
  }
}
</script>

<template>
  <UModal v-model:open="open" :title="t(field ? 'model.remove.titleField' : 'model.remove.titleType', { name })" :ui="{ content: 'sm:max-w-lg' }">
    <template #body>
      <p v-if="loading" class="flex items-center gap-2 text-sm text-muted" role="status">
        <UIcon name="i-lucide-loader-circle" class="size-4 animate-spin" aria-hidden="true" />{{ t('model.remove.loading') }}
      </p>
      <div v-else class="flex flex-col gap-5">
        <!-- 1. still used somewhere: nothing else can be done here -->
        <CmsModelCodeRefusal v-if="codeRefusal" :text="codeRefusal" @leave="() => { open = false }" />
        <div v-else-if="blocked" class="flex flex-col gap-3">
          <p class="flex items-start gap-3 text-sm text-default text-pretty">
            <UIcon name="i-lucide-link-2" class="mt-0.5 size-4 shrink-0 text-muted" aria-hidden="true" />
            <span>{{ t('model.remove.stillUsed') }}</span>
          </p>
          <ul v-if="places.length" class="cms-card overflow-hidden text-sm">
            <li v-for="p in places" :key="`${p.entity}-${p.id}-${p.block?.id ?? ''}`" class="border-b border-default last:border-0">
              <NuxtLink :to="p.admin" class="flex min-h-11 items-center gap-2 px-3 py-2 transition-colors hover:bg-elevated/60" @click="() => { open = false }">
                <span class="min-w-0 flex-1 truncate font-medium text-highlighted">{{ placeTitle(p) }}<template v-if="blockName(p)"><span class="mx-1 font-normal text-muted">›</span>{{ blockName(p) }}</template></span>
                <span v-if="placeKind(p)" class="shrink-0 text-xs text-muted">{{ placeKind(p) }}</span>
                <UIcon name="i-lucide-arrow-up-right" class="size-3.5 shrink-0 text-dimmed" aria-hidden="true" />
              </NuxtLink>
            </li>
          </ul>
          <ul v-if="pointing.length" class="cms-card overflow-hidden text-sm">
            <li v-for="p in pointing" :key="`${p.type}-${p.key}`" class="border-b border-default last:border-0">
              <NuxtLink :to="`/admin/_model/${p.type}`" class="flex min-h-11 items-center gap-2 px-3 py-2 transition-colors hover:bg-elevated/60" @click="() => { open = false }">
                <span class="min-w-0 flex-1 truncate text-highlighted">{{ t('model.remove.fieldIn', { field: p.fieldLabel, type: p.typeLabel }) }}</span>
                <UIcon name="i-lucide-arrow-up-right" class="size-3.5 shrink-0 text-dimmed" aria-hidden="true" />
              </NuxtLink>
            </li>
          </ul>
          <p class="text-sm text-muted text-pretty">{{ t('model.remove.takeOff') }}</p>
        </div>

        <template v-else>
          <!-- 2. what happens to the content -->
          <p class="flex items-start gap-3 text-sm text-default text-pretty">
            <UIcon name="i-lucide-files" class="mt-0.5 size-4 shrink-0 text-muted" aria-hidden="true" />
            <span v-if="field">{{ t('model.remove.fieldKeeps') }}</span>
            <span v-else-if="entries">{{ t('model.remove.entriesHold', { count: entries }) }}</span>
            <span v-else>{{ t('model.remove.noEntries') }}</span>
          </p>
          <p class="flex items-start gap-3 text-sm text-default text-pretty">
            <UIcon name="i-lucide-eye-off" class="mt-0.5 size-4 shrink-0 text-muted" aria-hidden="true" />
            <span>{{ t('model.remove.goneNow') }}</span>
          </p>
          <!-- 3. what holds nothing is deleted after an hour -->
          <p v-if="holdsNothing" class="flex items-start gap-3 text-sm text-default text-pretty">
            <UIcon name="i-lucide-clock" class="mt-0.5 size-4 shrink-0 text-muted" aria-hidden="true" />
            <span>{{ t('model.remove.hiddenSoon', { time: formatDateWith(purgeAt, { timeStyle: 'short' }) }) }}</span>
          </p>
          <p v-else-if="field" class="flex items-start gap-3 text-sm text-muted text-pretty">
            <UIcon name="i-lucide-clock" class="mt-0.5 size-4 shrink-0 text-muted" aria-hidden="true" />
            <span>{{ t('model.remove.fieldEmptyHour') }}</span>
          </p>
        </template>

        <UAlert v-if="failed" color="error" variant="subtle" icon="i-lucide-circle-alert" :title="failed" role="alert" data-cms-error-summary />
      </div>
    </template>
    <template #footer>
      <div class="flex w-full justify-end gap-2">
        <UButton v-if="blocked" color="neutral" variant="outline" @click="() => { open = false }">{{ t('common.close') }}</UButton>
        <template v-else>
          <UButton color="neutral" variant="ghost" @click="() => { open = false }">{{ t('common.cancel') }}</UButton>
          <UButton color="error" icon="i-lucide-eye-off" :loading="saving" :disabled="loading" @click="remove">{{ t('model.remove.confirm') }}</UButton>
        </template>
      </div>
    </template>
  </UModal>
</template>
