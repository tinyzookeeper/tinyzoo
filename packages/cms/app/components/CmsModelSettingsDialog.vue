<script setup lang="ts">
import { MODEL_LABEL_MAX, type ModelType } from '../../src/model-doc'
import {
  cmsModelColumnChoices, cmsModelFields, cmsModelOrderFields, cmsModelSettingsCheck, cmsModelSettingsFormOf, cmsModelSettingsOp, cmsSheetUi,
  type CmsModelData, type CmsModelSettingsForm,
} from '../utils/cmsModel'

// The settings of one type, in plain questions: what it is called and its icon, the columns of the list,
// the order the website shows the entries in, and what a shared page uses as its picture and text.
const props = defineProps<{ type: ModelType; data: CmsModelData }>()
const open = defineModel<boolean>('open', { default: false })
const { t, tl, locale } = useCmsI18n()
const toast = useToast()
const model = useCmsModel()

const read = (label: any) => tl(label, '')
const form = reactive<CmsModelSettingsForm>(cmsModelSettingsFormOf(props.type, read))
const errors = reactive<{ plural?: string; columns?: string; orderBy?: string; icon?: string }>({})
const failed = ref('')
// The website's code reads what the change takes away (409 `breaks-code`): the refusal, with a link to that code.
const codeRefusal = ref('')
const saving = ref(false)
const formEl = ref<HTMLElement | null>(null)

function reset() {
  Object.assign(form, cmsModelSettingsFormOf(props.type, read))
  failed.value = ''
  codeRefusal.value = ''
  for (const k of Object.keys(errors)) delete (errors as Record<string, unknown>)[k]
}
watch(open, (on) => { if (on) reset() }, { immediate: true })

const manualAlready = computed(() => props.type.order === 'manual')
const columnChoices = computed(() => cmsModelColumnChoices(props.type).map((c) => ({
  key: c.key,
  label: c.field ? tl(c.field.label as any, c.field.key) : t(c.kind === 'slug' ? 'model.settings.columnAddress' : 'model.settings.columnStatus'),
})))
const orderItems = computed(() => (['newest', 'field', 'manual'] as const).map((value) => ({
  value, label: t(`model.settings.order.${value}`), description: t(`model.settings.order.${value}Hint`),
})))
const sortable = computed(() => cmsModelOrderFields(props.type).map((f) => ({ label: tl(f.label as any, f.key), value: f.key })))

// A select cannot hold an empty value, so "none" has a value of its own.
const NONE = '__none'
const pictureItems = computed(() => [
  { label: t('model.settings.noneChosen'), value: NONE },
  ...cmsModelFields(props.type).filter((f) => f.type === 'media').map((f) => ({ label: tl(f.label as any, f.key), value: f.key })),
])
const summaryItems = computed(() => [
  { label: t('model.settings.noneChosen'), value: NONE },
  ...cmsModelFields(props.type).filter((f) => f.type === 'text').map((f) => ({ label: tl(f.label as any, f.key), value: f.key })),
])
const image = computed({ get: () => form.image || NONE, set: (v: string) => { form.image = v === NONE ? '' : v } })
const summary = computed({ get: () => form.summary || NONE, set: (v: string) => { form.summary = v === NONE ? '' : v } })

function toggleColumn(key: string, on: boolean | 'indeterminate') {
  form.columns = on === true ? [...form.columns.filter((k) => k !== key), key] : form.columns.filter((k) => k !== key)
}

async function submit() {
  for (const k of Object.keys(errors)) delete (errors as Record<string, unknown>)[k]
  failed.value = ''
  codeRefusal.value = ''
  const found = cmsModelSettingsCheck(form, t as any)
  if (Object.keys(found).length) {
    Object.assign(errors, found)
    await cmsFocusInvalid(formEl.value)
    return
  }
  const op = cmsModelSettingsOp(props.type, form, locale.value, read)
  if (!op) {
    open.value = false
    return
  }
  saving.value = true
  try {
    // A change made meanwhile is said here, in the dialog, not in a toast behind it.
    const res = await model.change([op], { quiet: true })
    if (res.ok) {
      toast.add({ title: t('model.settings.saved'), icon: 'i-lucide-check', color: 'success' })
      open.value = false
      return
    }
    const { problem } = res
    if (problem.at === 'label') errors.plural = problem.text
    else if (problem.at === 'icon') errors.icon = problem.text
    else if (problem.kind === 'breaks-code') codeRefusal.value = problem.text
    else failed.value = problem.text
    await cmsFocusInvalid(formEl.value)
  }
  finally {
    saving.value = false
  }
}
</script>

<template>
  <UModal v-model:open="open" :title="t('model.settings.title', { name: tl(type.label as any, type.name) })" :ui="cmsSheetUi('sm:max-w-xl')">
    <template #body>
      <form id="cms-model-settings" ref="formEl" class="flex flex-col gap-7" novalidate @submit.prevent="submit">
        <section class="flex flex-col gap-4" aria-labelledby="cms-model-s-name">
          <h3 id="cms-model-s-name" class="text-sm font-semibold text-highlighted">{{ t('model.dialog.questionName') }}</h3>
          <div class="grid gap-4 sm:grid-cols-2">
            <UFormField :label="t('model.dialog.several')" name="plural" :error="errors.plural || undefined">
              <UInput v-model="form.plural" :maxlength="MODEL_LABEL_MAX" class="w-full" />
              <template #error="{ error }"><span v-if="error" role="alert">{{ error }}</span></template>
            </UFormField>
            <UFormField :label="t('model.dialog.one')" name="singular">
              <UInput v-model="form.singular" :maxlength="MODEL_LABEL_MAX" class="w-full" />
            </UFormField>
          </div>
          <UFormField :label="t('model.dialog.icon')" name="icon" :error="errors.icon || undefined">
            <CmsModelIconPicker v-model="form.icon" :label="t('model.dialog.icon')" />
            <template #error="{ error }"><span v-if="error" role="alert">{{ error }}</span></template>
          </UFormField>
        </section>

        <section class="flex flex-col gap-3" aria-labelledby="cms-model-s-columns">
          <h3 id="cms-model-s-columns" class="text-sm font-semibold text-highlighted">{{ t('model.settings.questionColumns') }}</h3>
          <div class="flex items-center justify-between gap-4">
            <label for="cms-model-own-columns" class="text-sm text-default">{{ t('model.settings.ownColumns') }}</label>
            <USwitch id="cms-model-own-columns" v-model="form.ownColumns" />
          </div>
          <template v-if="form.ownColumns">
            <div class="grid gap-x-4 gap-y-2.5 sm:grid-cols-2">
              <UCheckbox
                v-for="c in columnChoices" :key="c.key" :model-value="form.columns.includes(c.key)" :label="c.label"
                @update:model-value="(on: boolean | 'indeterminate') => toggleColumn(c.key, on)"
              />
            </div>
            <p v-if="errors.columns" class="text-sm text-error" role="alert">{{ errors.columns }}</p>
            <p v-else class="text-xs text-muted">{{ t('model.settings.columnsHint') }}</p>
          </template>
          <p v-else class="text-xs text-muted">{{ t('model.settings.columnsAuto') }}</p>
        </section>

        <section class="flex flex-col gap-3" aria-labelledby="cms-model-s-order">
          <h3 id="cms-model-s-order" class="text-sm font-semibold text-highlighted">{{ t('model.settings.questionOrder') }}</h3>
          <p v-if="manualAlready" class="flex items-start gap-2.5 text-sm text-default text-pretty">
            <UIcon name="i-lucide-hand" class="mt-0.5 size-4 shrink-0 text-muted" aria-hidden="true" />
            <span>{{ t('model.settings.orderStaysManual') }}</span>
          </p>
          <template v-else>
            <URadioGroup v-model="form.order" :items="orderItems" variant="card" aria-labelledby="cms-model-s-order" :ui="{ item: 'has-data-[state=checked]:bg-(--cms-moment-bg) has-data-[state=checked]:border-(--cms-moment-line)' }" />
            <div v-if="form.order === 'field'" class="flex flex-col gap-3">
              <UFormField :label="t('model.settings.orderBy')" name="orderBy" :error="errors.orderBy || undefined">
                <USelect v-model="form.orderBy" :items="sortable" class="w-full" />
                <template #error="{ error }"><span v-if="error" role="alert">{{ error }}</span></template>
              </UFormField>
              <div class="flex gap-2" role="group" :aria-label="t('model.settings.direction')">
                <UButton
                  v-for="dir in (['asc', 'desc'] as const)" :key="dir" :color="form.orderDir === dir ? 'primary' : 'neutral'" :variant="form.orderDir === dir ? 'subtle' : 'outline'"
                  :aria-pressed="form.orderDir === dir" :icon="dir === 'asc' ? 'i-lucide-arrow-down-a-z' : 'i-lucide-arrow-up-z-a'" @click="() => { form.orderDir = dir }"
                >{{ t(dir === 'asc' ? 'model.settings.ascending' : 'model.settings.descending') }}</UButton>
              </div>
            </div>
            <p v-if="form.order === 'manual'" class="text-sm text-muted text-pretty">{{ t('model.settings.manualFinal') }}</p>
          </template>
        </section>

        <section v-if="type.page" class="flex flex-col gap-3" aria-labelledby="cms-model-s-share">
          <h3 id="cms-model-s-share" class="text-sm font-semibold text-highlighted">{{ t('model.settings.questionShare') }}</h3>
          <div class="grid gap-4 sm:grid-cols-2">
            <UFormField :label="t('model.settings.sharePicture')" name="image">
              <USelect v-model="image" :items="pictureItems" class="w-full" />
            </UFormField>
            <UFormField :label="t('model.settings.shareText')" name="summary">
              <USelect v-model="summary" :items="summaryItems" class="w-full" />
            </UFormField>
          </div>
        </section>

        <details>
          <summary class="cursor-pointer text-xs text-muted hover:text-highlighted">{{ t('model.forDevelopers') }}</summary>
          <dl class="mt-2 grid gap-1 break-all font-mono text-xs text-dimmed">
            <div><dt class="sr-only">{{ t('model.settings.devName') }}</dt><dd>{{ type.name }}</dd></div>
            <div><dt class="sr-only">{{ t('model.settings.devContent') }}</dt><dd>/api/content/{{ type.name }}</dd></div>
            <div><dt class="sr-only">{{ t('model.settings.devAdmin') }}</dt><dd>/api/cms/{{ type.name }}</dd></div>
          </dl>
        </details>

        <UAlert v-if="failed" color="error" variant="subtle" icon="i-lucide-circle-alert" :title="failed" role="alert" data-cms-error-summary />
        <CmsModelCodeRefusal v-if="codeRefusal" alert :text="codeRefusal" @leave="() => { open = false }" />
      </form>
    </template>
    <template #footer>
      <div class="flex w-full justify-end gap-2">
        <UButton color="neutral" variant="ghost" @click="() => { open = false }">{{ t('common.cancel') }}</UButton>
        <UButton type="submit" form="cms-model-settings" icon="i-lucide-check" :loading="saving">{{ t('common.save') }}</UButton>
      </div>
    </template>
  </UModal>
</template>
