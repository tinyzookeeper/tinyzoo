<script setup lang="ts">
import { MODEL_HELP_MAX, MODEL_LABEL_MAX, type ModelField, type ModelType } from '../../src/model-doc'
import {
  CMS_MODEL_KINDS, cmsModelAddOptionRow, cmsModelBlankForm, cmsModelCanRequire, cmsModelFieldAddOp, cmsModelFieldCheck, cmsModelFieldUpdateOp, cmsModelFormOf,
  cmsModelKindIcon, cmsModelNewFieldKey, cmsModelNotesText, cmsModelOfferedRows, cmsModelPreset, cmsModelRemoveOptionRow, cmsModelRestoreOptionRow,
  cmsModelVisibleTypes, cmsSheetUi, type CmsModelData, type CmsModelFieldForm, type CmsModelFieldFormErrors, type CmsModelKindId,
} from '../utils/cmsModel'

// A field of a type, added or edited. Adding starts with what the field holds (the kind, which cannot
// change later); the form then asks only what that kind needs. Editing sends only what changed and
// only what the kind lets change.
const props = defineProps<{ type: ModelType; data: CmsModelData; field: ModelField | null }>()
const emit = defineEmits<{ remove: [field: ModelField] }>()
const open = defineModel<boolean>('open', { default: false })
const { t, tl, locale } = useCmsI18n()
const toast = useToast()
const model = useCmsModel()

const read = (label: any) => tl(label, '')
const editing = computed(() => !!props.field)
const isTitle = computed(() => !!props.field && props.field.key === props.type.titleField)
const step = ref<'kind' | 'form'>('kind')
const form = reactive<CmsModelFieldForm>(cmsModelBlankForm('text'))
const errors = reactive<CmsModelFieldFormErrors & { help?: string; key?: string; required?: string }>({})
const failed = ref('')
const saving = ref(false)
const formEl = ref<HTMLElement | null>(null)
const keyEdited = ref(false)
const devOpen = ref(false)
const newOption = ref('')

function clearErrors() {
  for (const k of Object.keys(errors)) delete (errors as Record<string, unknown>)[k]
  failed.value = ''
}
function reset() {
  clearErrors()
  keyEdited.value = false
  devOpen.value = false
  newOption.value = ''
  if (props.field) {
    Object.assign(form, cmsModelFormOf(props.field, read))
    step.value = 'form'
  }
  else {
    Object.assign(form, cmsModelBlankForm('text'))
    step.value = 'kind'
  }
}
watch(open, (on) => { if (on) reset() }, { immediate: true })

// The key follows the label until the person edits it (it never changes after the field is made).
watch(() => form.label, (label) => {
  if (!editing.value && !keyEdited.value) form.key = cmsModelNewFieldKey(label, props.type)
})
function pick(id: CmsModelKindId) {
  const { label, help, key } = form
  Object.assign(form, cmsModelBlankForm(id), { label, help, key })
  step.value = 'form'
}

const entriesCount = computed(() => props.data.entries[props.type.name] ?? 0)
// A new field cannot be required while entries exist: they have no value for it yet.
const requiredBlocked = computed(() => !editing.value && entriesCount.value > 0)
const showRequired = computed(() => cmsModelCanRequire(form.kind))
const offered = computed(() => cmsModelOfferedRows(form))
const optionsFull = computed(() => form.options.length >= props.data.limits.options)

function addOption() {
  const next = cmsModelAddOptionRow(form.options, newOption.value)
  if (next.length === form.options.length) return
  form.options = next
  newOption.value = ''
  delete errors.options
}
function removeOption(value: string) {
  form.options = cmsModelRemoveOptionRow(form.options, value)
}
function restoreOption(value: string) {
  form.options = cmsModelRestoreOptionRow(form.options, value)
}

// A select cannot hold an empty value, so "nothing" has a value of its own.
const NONE = '__none'
const presetItems = computed(() => [{ label: t('model.field.presetNone'), value: NONE }, ...offered.value.map((o) => ({ label: o.label || '…', value: o.value }))])
const preset = computed({ get: () => cmsModelPreset(form) || NONE, set: (v: string) => { form.preset = v === NONE ? '' : v } })

// The types a link can point at: the site's own, then the design's collections.
const targets = computed(() => [
  ...cmsModelVisibleTypes(props.data.doc).map((x) => ({ label: tl(x.label as any, x.name), value: x.name })),
  ...props.data.design.filter((d) => !d.singleton).map((d) => ({ label: tl(d.label as any, d.name), value: d.name })),
])
const targetName = (to: string) => targets.value.find((x) => x.value === to)?.label ?? to
const target = computed({ get: () => form.to || undefined, set: (v: string | undefined) => { form.to = v ?? '' } })

const formats: { id: 'plain' | 'email' | 'url'; icon: string }[] = [
  { id: 'plain', icon: 'i-lucide-type' }, { id: 'email', icon: 'i-lucide-at-sign' }, { id: 'url', icon: 'i-lucide-globe' },
]

async function submit() {
  clearErrors()
  const found = cmsModelFieldCheck(form, t as any)
  if (Object.keys(found).length) {
    Object.assign(errors, found)
    await cmsFocusInvalid(formEl.value)
    return
  }
  const op = props.field ? cmsModelFieldUpdateOp(props.type.name, props.field, form, locale.value, read) : cmsModelFieldAddOp(props.type.name, form, locale.value)
  if (!op) {
    open.value = false
    return
  }
  saving.value = true
  try {
    // A change made meanwhile is said here, in the dialog, not in a toast behind it.
    const res = await model.change([op], { quiet: true })
    if (res.ok) {
      const description = cmsModelNotesText(res.result.notes, t as any)
      toast.add({
        title: editing.value ? t('model.field.saved') : t('model.field.added', { name: form.label.trim() }),
        ...(description ? { description } : {}), icon: 'i-lucide-check', color: 'success',
      })
      open.value = false
      return
    }
    const { problem } = res
    if (problem.at === 'key') { errors.key = problem.text; devOpen.value = true }
    else if (problem.at && problem.at in { label: 1, help: 1, options: 1, required: 1, to: 1 }) (errors as Record<string, string>)[problem.at] = problem.text
    else failed.value = problem.text
    await cmsFocusInvalid(formEl.value)
  }
  finally {
    saving.value = false
  }
}

const title = computed(() => {
  if (editing.value) return t('model.field.editTitle', { name: read(props.field!.label) || props.field!.key })
  return step.value === 'kind' ? t('model.field.chooseKind') : t('model.field.addTitle')
})
</script>

<template>
  <UModal v-model:open="open" :title="title" :ui="cmsSheetUi('sm:max-w-2xl')">
    <template #body>
      <!-- what should the field hold? -->
      <div v-if="step === 'kind'" class="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
        <button
          v-for="k in CMS_MODEL_KINDS" :key="k.id" type="button"
          class="flex min-h-24 flex-col items-start gap-1.5 rounded-lg border border-default p-3 text-left transition-colors hover:bg-elevated"
          @click="pick(k.id)"
        >
          <UIcon :name="k.icon" class="size-5 text-muted" aria-hidden="true" />
          <span class="font-medium text-highlighted">{{ t(`model.kinds.${k.id}.name`) }}</span>
          <span class="text-xs text-muted text-pretty">{{ t(`model.kinds.${k.id}.hint`) }}</span>
        </button>
      </div>

      <form v-else id="cms-model-field" ref="formEl" class="flex flex-col gap-6" novalidate @submit.prevent="submit">
        <div class="flex items-center justify-between gap-3">
          <p class="flex items-center gap-2 text-sm text-muted">
            <span class="grid size-8 shrink-0 place-items-center rounded-md border border-default"><UIcon :name="cmsModelKindIcon(form.kind)" class="size-4" aria-hidden="true" /></span>
            <span class="font-medium text-highlighted">{{ t(`model.kinds.${form.kind}.name`) }}</span>
          </p>
          <UButton v-if="!editing" color="neutral" variant="ghost" size="sm" icon="i-lucide-arrow-left" @click="() => { step = 'kind' }">{{ t('model.field.changeKind') }}</UButton>
        </div>

        <div class="flex flex-col gap-4">
          <UFormField :label="t('model.field.label')" name="label" :error="errors.label || undefined" required>
            <UInput v-model="form.label" autofocus :maxlength="MODEL_LABEL_MAX" class="w-full" />
            <template #error="{ error }"><span v-if="error" role="alert">{{ error }}</span></template>
          </UFormField>
          <UFormField :label="t('model.field.help')" name="help" :hint="t('common.optional')" :description="t('model.field.helpHint')" :error="errors.help || undefined">
            <UTextarea v-model="form.help" :rows="2" :maxlength="MODEL_HELP_MAX" class="w-full" />
            <template #error="{ error }"><span v-if="error" role="alert">{{ error }}</span></template>
          </UFormField>
        </div>

        <section v-if="showRequired" class="flex flex-col gap-1.5">
          <div class="flex items-center justify-between gap-4">
            <label for="cms-model-required" class="text-sm text-default">{{ t('model.field.requiredSwitch') }}</label>
            <USwitch id="cms-model-required" v-model="form.required" :disabled="requiredBlocked || isTitle" :aria-invalid="errors.required ? 'true' : undefined" />
          </div>
          <p v-if="errors.required" class="text-sm text-error" role="alert">{{ errors.required }}</p>
          <p v-else-if="isTitle" class="text-xs text-muted">{{ t('model.field.requiredTitle') }}</p>
          <p v-else-if="requiredBlocked" class="text-xs text-muted text-pretty">{{ t('model.field.requiredBlocked') }}</p>
        </section>

        <!-- choice -->
        <template v-if="form.kind === 'select'">
          <section class="flex flex-col gap-3" aria-labelledby="cms-model-f-options">
            <h3 id="cms-model-f-options" class="text-sm font-semibold text-highlighted">{{ t('model.field.questionOptions') }}</h3>
            <ul v-if="form.options.length" class="flex flex-col gap-2">
              <li v-for="(row, i) in form.options" :key="row.value" class="flex items-center gap-2">
                <UInput v-model="row.label" :disabled="row.removed" :maxlength="MODEL_LABEL_MAX" :aria-label="t('model.field.optionNumber', { number: i + 1 })" class="min-w-0 flex-1" :class="row.removed ? 'opacity-60' : ''" />
                <template v-if="row.removed">
                  <span class="shrink-0 text-xs text-muted">{{ t('model.field.notOffered') }}</span>
                  <UButton color="neutral" variant="outline" size="sm" icon="i-lucide-rotate-ccw" :aria-label="t('model.restoreNamed', { name: row.label })" @click="restoreOption(row.value)">
                    <span class="max-sm:sr-only">{{ t('model.restore') }}</span>
                  </UButton>
                </template>
                <UButton v-else color="neutral" variant="ghost" icon="i-lucide-x" class="cms-hit shrink-0" :aria-label="t('model.field.removeOption', { name: row.label })" @click="removeOption(row.value)" />
              </li>
            </ul>
            <div class="flex items-center gap-2">
              <UInput
                v-model="newOption" :maxlength="MODEL_LABEL_MAX" :placeholder="t('model.field.optionPlaceholder')" :aria-label="t('model.field.newOption')" :disabled="optionsFull"
                class="min-w-0 flex-1" @keydown.enter.prevent="addOption"
              />
              <UButton color="neutral" variant="outline" icon="i-lucide-plus" :disabled="optionsFull || !newOption.trim()" @click="addOption">{{ t('model.field.addOption') }}</UButton>
            </div>
            <p v-if="errors.options" class="text-sm text-error" role="alert">{{ errors.options }}</p>
            <p v-else-if="optionsFull" class="text-xs text-muted">{{ t('model.field.optionsFull') }}</p>
          </section>
          <section class="flex flex-col gap-3" aria-labelledby="cms-model-f-preset">
            <h3 id="cms-model-f-preset" class="text-sm font-semibold text-highlighted">{{ t('model.field.questionPreset') }}</h3>
            <USelect v-model="preset" :items="presetItems" :aria-label="t('model.field.questionPreset')" class="w-full sm:max-w-xs" />
          </section>
        </template>

        <!-- number -->
        <template v-if="form.kind === 'number'">
          <section class="flex flex-col gap-3" aria-labelledby="cms-model-f-decimal">
            <h3 id="cms-model-f-decimal" class="text-sm font-semibold text-highlighted">{{ t('model.field.questionDecimal') }}</h3>
            <p v-if="editing" class="text-sm text-default">{{ t(form.decimal ? 'model.field.decimals' : 'model.field.whole') }}</p>
            <div v-else class="flex flex-wrap gap-2" role="group" :aria-labelledby="'cms-model-f-decimal'">
              <UButton
                v-for="d in [false, true]" :key="String(d)" :color="form.decimal === d ? 'primary' : 'neutral'" :variant="form.decimal === d ? 'subtle' : 'outline'"
                :aria-pressed="form.decimal === d" @click="() => { form.decimal = d }"
              >{{ t(d ? 'model.field.decimals' : 'model.field.whole') }}</UButton>
            </div>
          </section>
          <section class="flex flex-col gap-1.5">
            <div class="grid gap-4 sm:grid-cols-2">
              <UFormField :label="t('model.field.smallest')" name="min" :hint="t('common.optional')">
                <UInput v-model="form.min" type="number" inputmode="decimal" :step="form.decimal ? 'any' : 1" class="w-full" :aria-invalid="errors.range ? 'true' : undefined" />
              </UFormField>
              <UFormField :label="t('model.field.largest')" name="max" :hint="t('common.optional')">
                <UInput v-model="form.max" type="number" inputmode="decimal" :step="form.decimal ? 'any' : 1" class="w-full" :aria-invalid="errors.range ? 'true' : undefined" />
              </UFormField>
            </div>
            <p v-if="errors.range" class="text-sm text-error" role="alert">{{ errors.range }}</p>
          </section>
        </template>

        <!-- short text -->
        <section v-if="form.kind === 'text'" class="flex flex-col gap-3" aria-labelledby="cms-model-f-format">
          <h3 id="cms-model-f-format" class="text-sm font-semibold text-highlighted">{{ t('model.field.questionFormat') }}</h3>
          <div class="flex flex-wrap gap-2" role="group" aria-labelledby="cms-model-f-format">
            <UButton
              v-for="f in formats" :key="f.id" :icon="f.icon" :color="form.format === f.id ? 'primary' : 'neutral'" :variant="form.format === f.id ? 'subtle' : 'outline'"
              :aria-pressed="form.format === f.id" @click="() => { form.format = f.id }"
            >{{ t(`model.field.format.${f.id}`) }}</UButton>
          </div>
        </section>

        <!-- date -->
        <section v-if="form.kind === 'datetime'" class="flex flex-col gap-3" aria-labelledby="cms-model-f-allday">
          <h3 id="cms-model-f-allday" class="text-sm font-semibold text-highlighted">{{ t('model.field.questionAllDay') }}</h3>
          <div class="flex flex-wrap gap-2" role="group" aria-labelledby="cms-model-f-allday">
            <UButton
              v-for="d in [false, true]" :key="String(d)" :icon="d ? 'i-lucide-calendar' : 'i-lucide-clock'" :color="form.allDay === d ? 'primary' : 'neutral'"
              :variant="form.allDay === d ? 'subtle' : 'outline'" :aria-pressed="form.allDay === d" @click="() => { form.allDay = d }"
            >{{ t(d ? 'model.field.wholeDay' : 'model.field.withTime') }}</UButton>
          </div>
        </section>

        <!-- link to another type -->
        <section v-if="form.kind === 'relation'" class="flex flex-col gap-3" aria-labelledby="cms-model-f-to">
          <h3 id="cms-model-f-to" class="text-sm font-semibold text-highlighted">{{ t('model.field.questionTo') }}</h3>
          <p v-if="editing" class="text-sm text-default">{{ targetName(form.to) }}</p>
          <UFormField v-else name="to" :error="errors.to || undefined">
            <USelect v-model="target" :items="targets" :placeholder="t('model.field.pickType')" :aria-label="t('model.field.questionTo')" class="w-full sm:max-w-xs" />
            <template #error="{ error }"><span v-if="error" role="alert">{{ error }}</span></template>
          </UFormField>
        </section>

        <!-- switch -->
        <section v-if="form.kind === 'boolean'" class="flex items-center justify-between gap-4">
          <label for="cms-model-on" class="text-sm text-default">{{ t('model.field.startsOn') }}</label>
          <USwitch id="cms-model-on" v-model="form.on" />
        </section>

        <details :open="devOpen" @toggle="(e: Event) => { devOpen = (e.target as HTMLDetailsElement).open }">
          <summary class="cursor-pointer text-xs text-muted hover:text-highlighted">{{ t('model.forDevelopers') }}</summary>
          <div class="mt-2 flex flex-col gap-1.5">
            <p v-if="editing" class="break-all font-mono text-xs text-dimmed">{{ form.key }}</p>
            <UFormField v-else :label="t('model.field.keyLabel')" name="key" :error="errors.key || undefined">
              <UInput :model-value="form.key" class="w-full" :ui="{ base: 'font-mono text-xs' }" @update:model-value="(v: string | number) => { form.key = String(v); keyEdited = true }" />
              <template #error="{ error }"><span v-if="error" role="alert">{{ error }}</span></template>
            </UFormField>
            <p v-if="!editing" class="text-xs text-muted">{{ t('model.field.keyHint') }}</p>
          </div>
        </details>

        <UAlert v-if="failed" color="error" variant="subtle" icon="i-lucide-circle-alert" :title="failed" role="alert" data-cms-error-summary />
      </form>
    </template>
    <template #footer>
      <div class="flex w-full items-center justify-between gap-2">
        <UButton v-if="field && !isTitle" color="error" variant="ghost" icon="i-lucide-trash-2" @click="() => { open = false; emit('remove', field!) }">{{ t('model.field.remove') }}</UButton>
        <span v-else />
        <div class="flex justify-end gap-2">
          <UButton color="neutral" variant="ghost" @click="() => { open = false }">{{ t('common.cancel') }}</UButton>
          <UButton v-if="step === 'form'" type="submit" form="cms-model-field" icon="i-lucide-check" :loading="saving">{{ t(editing ? 'common.save' : 'model.field.addSubmit') }}</UButton>
        </div>
      </div>
    </template>
  </UModal>
</template>
