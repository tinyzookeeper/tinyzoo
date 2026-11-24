<script setup lang="ts">
import { MODEL_LABEL_MAX, modelPagePrefix, type ModelDoc } from '../../src/model-doc'
import {
  CMS_MODEL_ICONS, CMS_MODEL_DEFAULT_ICON, cmsModelNewType, cmsModelTakenPrefixes, cmsSheetUi,
  type CmsModelData, type CmsModelStarter,
} from '../utils/cmsModel'

// A new content type in three plain questions: what they are called, whether each has a page of its
// own, and whether they start as drafts. The names, the address and the first fields are made from the
// answers; one request does all of it, so a refusal leaves nothing half made.
const props = defineProps<{ doc: ModelDoc; design: CmsModelData['design']; limits: CmsModelData['limits']; used: CmsModelData['used'] }>()
const emit = defineEmits<{ created: [name: string] }>()
const open = defineModel<boolean>('open', { default: false })
const { t, locale } = useCmsI18n()
const toast = useToast()
const model = useCmsModel()

const STARTERS: CmsModelStarter[] = ['picture', 'summary', 'text', 'date']
const form = reactive({ plural: '', singular: '', icon: CMS_MODEL_DEFAULT_ICON as string, pages: true, prefix: '', drafts: true, starters: ['picture', 'summary'] as CmsModelStarter[] })
// The address follows the label until the person edits it; the drafts follow the pages switch until they are touched.
const editingPrefix = ref(false)
const draftsTouched = ref(false)
const errors = reactive<{ label?: string; prefix?: string; icon?: string }>({})
const failed = ref('')
const saving = ref(false)
const formEl = ref<HTMLElement | null>(null)

function reset() {
  Object.assign(form, { plural: '', singular: '', icon: CMS_MODEL_DEFAULT_ICON, pages: true, prefix: '', drafts: true, starters: ['picture', 'summary'] })
  editingPrefix.value = false
  draftsTouched.value = false
  failed.value = ''
  for (const k of Object.keys(errors)) delete (errors as Record<string, unknown>)[k]
}
watch(open, (on) => { if (on) reset() }, { immediate: true })
watch(() => form.pages, (on) => { if (!draftsTouched.value) form.drafts = on })

const autoPrefix = computed(() => modelPagePrefix(form.plural, cmsModelTakenPrefixes(props.doc)))
const shownPrefix = computed(() => (editingPrefix.value ? form.prefix : autoPrefix.value))
function editPrefix() {
  form.prefix = form.plural.trim() ? autoPrefix.value : ''
  editingPrefix.value = true
}

function toggleStarter(id: CmsModelStarter, on: boolean | 'indeterminate') {
  form.starters = on === true ? [...form.starters.filter((s) => s !== id), id] : form.starters.filter((s) => s !== id)
}

// The icons are one choice among many squares: arrows move through them, as in any group of radio buttons.
function iconKey(icon: string): string {
  return icon.replace(/^i-lucide-/, '').replace(/-([a-z])/g, (_, c: string) => c.toUpperCase())
}
function moveIcon(event: KeyboardEvent) {
  const delta = event.key === 'ArrowRight' || event.key === 'ArrowDown' ? 1 : event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -1 : 0
  if (!delta) return
  event.preventDefault()
  const buttons = [...(event.currentTarget as HTMLElement).querySelectorAll<HTMLElement>('[role="radio"]')]
  const at = buttons.findIndex((b) => b === document.activeElement)
  const next = buttons[(at + delta + buttons.length) % buttons.length]
  if (!next) return
  form.icon = CMS_MODEL_ICONS[buttons.indexOf(next)] ?? form.icon
  next.focus()
}

async function submit() {
  for (const k of Object.keys(errors)) delete (errors as Record<string, unknown>)[k]
  failed.value = ''
  if (!form.plural.trim()) {
    errors.label = t('model.validation.severalRequired')
    await cmsFocusInvalid(formEl.value)
    return
  }
  const { name, ops } = cmsModelNewType(
    { plural: form.plural, singular: form.singular, icon: form.icon, pages: form.pages, prefix: shownPrefix.value, drafts: form.drafts, starters: form.starters },
    { doc: props.doc, design: props.design, locale: locale.value },
  )
  saving.value = true
  try {
    // A change made meanwhile is said here, in the dialog, not in a toast behind it.
    const res = await model.change(ops, { quiet: true })
    if (res.ok) {
      toast.add({ title: t('model.dialog.created', { name: form.plural.trim() }), icon: 'i-lucide-check', color: 'success' })
      open.value = false
      emit('created', name)
      return
    }
    const { problem } = res
    if (problem.at === 'label') errors.label = problem.text
    else if (problem.at === 'prefix') {
      errors.prefix = problem.text
      form.prefix = shownPrefix.value
      editingPrefix.value = true
    }
    else if (problem.at === 'icon') errors.icon = problem.text
    else failed.value = problem.text
    await cmsFocusInvalid(formEl.value)
  }
  finally {
    saving.value = false
  }
}
</script>

<template>
  <UModal v-model:open="open" :title="t('model.newType')" :ui="cmsSheetUi('sm:max-w-xl')">
    <template #body>
      <form id="cms-model-type" ref="formEl" class="flex flex-col gap-7" novalidate @submit.prevent="submit">
        <section class="flex flex-col gap-4" aria-labelledby="cms-model-q-name">
          <h3 id="cms-model-q-name" class="text-sm font-semibold text-highlighted">{{ t('model.dialog.questionName') }}</h3>
          <div class="grid gap-4 sm:grid-cols-2">
            <UFormField :label="t('model.dialog.several')" name="plural" :error="errors.label || undefined">
              <UInput v-model="form.plural" autofocus :maxlength="MODEL_LABEL_MAX" :placeholder="t('model.dialog.severalPlaceholder')" class="w-full" />
              <template #error="{ error }"><span v-if="error" role="alert">{{ error }}</span></template>
            </UFormField>
            <UFormField :label="t('model.dialog.one')" name="singular">
              <UInput v-model="form.singular" :maxlength="MODEL_LABEL_MAX" :placeholder="t('model.dialog.onePlaceholder')" class="w-full" />
            </UFormField>
          </div>
          <UFormField :label="t('model.dialog.icon')" name="icon" :error="errors.icon || undefined">
            <div role="radiogroup" :aria-label="t('model.dialog.icon')" class="grid w-fit grid-cols-6 gap-1.5 sm:grid-cols-8" @keydown="moveIcon">
              <button
                v-for="icon in CMS_MODEL_ICONS" :key="icon" type="button" role="radio" :aria-checked="form.icon === icon"
                :aria-label="t(`model.icons.${iconKey(icon)}` as any)" :tabindex="form.icon === icon ? 0 : -1"
                class="grid size-11 place-items-center rounded-md border transition-colors sm:size-10"
                :class="form.icon === icon ? 'border-transparent bg-(--cms-moment-strong) text-highlighted ring-2 ring-inset ring-(--ui-text-highlighted)' : 'border-default text-muted hover:bg-elevated hover:text-highlighted'"
                @click="form.icon = icon"
              >
                <UIcon :name="icon" class="size-5" aria-hidden="true" />
              </button>
            </div>
            <template #error="{ error }"><span v-if="error" role="alert">{{ error }}</span></template>
          </UFormField>
        </section>

        <section class="flex flex-col gap-3" aria-labelledby="cms-model-q-pages">
          <h3 id="cms-model-q-pages" class="text-sm font-semibold text-highlighted">{{ t('model.dialog.questionPages') }}</h3>
          <div class="flex items-center justify-between gap-4">
            <label for="cms-model-pages" class="text-sm text-default">{{ t('model.dialog.pagesSwitch') }}</label>
            <USwitch id="cms-model-pages" v-model="form.pages" />
          </div>
          <div v-if="form.pages" class="flex flex-col gap-1.5">
            <UFormField v-if="editingPrefix" :label="t('model.dialog.address')" name="prefix" :error="errors.prefix || undefined">
              <UInput v-model="form.prefix" :aria-label="t('model.dialog.addressInput')" class="w-full font-mono" :ui="{ base: 'font-mono' }">
                <template #leading><span class="font-mono text-sm text-muted">/</span></template>
                <template #trailing><span class="font-mono text-sm text-muted">/…</span></template>
              </UInput>
              <template #error="{ error }"><span v-if="error" role="alert">{{ error }}</span></template>
            </UFormField>
            <div v-else class="flex items-center gap-2">
              <!-- before the name is written there is no address to show yet -->
              <span class="min-w-0 truncate rounded-md bg-elevated px-2.5 py-1 font-mono text-sm" :class="form.plural.trim() ? 'text-highlighted' : 'text-dimmed'">/{{ form.plural.trim() ? autoPrefix : '…' }}/…</span>
              <UButton color="neutral" variant="ghost" size="sm" @click="editPrefix">{{ t('model.dialog.addressChange') }}</UButton>
            </div>
            <p class="text-xs text-muted">{{ t('model.dialog.addressFixed') }}</p>
          </div>
        </section>

        <section class="flex flex-col gap-3" aria-labelledby="cms-model-q-drafts">
          <h3 id="cms-model-q-drafts" class="text-sm font-semibold text-highlighted">{{ t('model.dialog.questionDrafts') }}</h3>
          <div class="flex items-center justify-between gap-4">
            <label for="cms-model-drafts" class="text-sm text-default">{{ t('model.dialog.draftsSwitch') }}</label>
            <USwitch id="cms-model-drafts" v-model="form.drafts" @update:model-value="() => { draftsTouched = true }" />
          </div>
        </section>

        <section class="flex flex-col gap-3" aria-labelledby="cms-model-q-start">
          <h3 id="cms-model-q-start" class="text-sm font-semibold text-highlighted">{{ t('model.dialog.startWith') }}</h3>
          <div class="grid gap-x-4 gap-y-3 sm:grid-cols-2">
            <UCheckbox :model-value="true" disabled :label="t('model.starters.title')" :description="t('model.starterHints.title')" />
            <UCheckbox
              v-for="id in STARTERS" :key="id" :model-value="form.starters.includes(id)" :label="t(`model.starters.${id}`)"
              :description="t(`model.starterHints.${id}`)" @update:model-value="(on: boolean | 'indeterminate') => toggleStarter(id, on)"
            />
          </div>
        </section>

        <UAlert v-if="failed" color="error" variant="subtle" icon="i-lucide-circle-alert" :title="failed" role="alert" data-cms-error-summary />
      </form>
    </template>
    <template #footer>
      <div class="flex w-full justify-end gap-2">
        <UButton color="neutral" variant="ghost" @click="() => { open = false }">{{ t('common.cancel') }}</UButton>
        <UButton type="submit" form="cms-model-type" icon="i-lucide-check" :loading="saving">{{ t('common.create') }}</UButton>
      </div>
    </template>
  </UModal>
</template>
