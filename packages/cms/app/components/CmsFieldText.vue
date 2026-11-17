<script setup lang="ts">
import { isLinkRef } from '../../src/linkref'
// A line (or box) of text. Links, e-mails and the developer's `.icon()` show an
// icon inside the box; a filled-in link can be opened from the box. A link picked
// from the site's pages is stored as a reference to the page (it follows the page when
// its address changes): the box then names the page and its address, and warns when
// visitors will not get there.
const props = defineProps<{ field: any; entity?: string; id?: string }>()
const model = defineModel<any>()
const { t } = useCmsI18n()
const multiline = computed(() => !!props.field?.meta?.multiline)
const max = computed<number | undefined>(() => props.field?.meta?.max)
const icon = computed(() => cmsFieldIcon(props.field))
const injected = inject<Ref<'outline' | 'ghost'> | null>('cmsFieldVariant', null)
const variant = computed(() => injected?.value ?? 'outline')
const href = computed(() => {
  const v = typeof model.value === 'string' ? model.value.trim() : ''
  const format = props.field?.meta?.format
  if (!v || (format !== 'url' && format !== 'link')) return null
  return /^(https?:\/\/|\/)/.test(v) ? v : null
})
// Link and path fields pick a page of the site instead of typing its address.
const pickable = computed(() => props.field?.meta?.format === 'link' || props.field?.meta?.format === 'path')
const pickerOpen = ref(false)
function onPick(h: string) {
  model.value = h
  pickerOpen.value = false
}
// Pages are picked as references in link fields; an address field (`format: 'path'`) keeps the address.
const asRefs = computed(() => props.field?.meta?.format === 'link')
const pickedRef = computed(() => (asRefs.value && typeof model.value === 'string' && isLinkRef(model.value) ? model.value : null))
</script>

<template>
  <div class="w-full">
    <UTextarea v-if="multiline" :id="id" v-model="model" :variant="variant" class="w-full" autoresize :rows="3" :maxrows="12" :maxlength="max" />
    <!-- a link to one of the site's pages: named by the page, not by its reference -->
    <div
      v-else-if="pickedRef" :id="id"
      class="flex min-h-9 w-full items-center gap-1.5 rounded-(--ui-radius) py-1 pl-2.5 pr-1.5"
      :class="variant === 'ghost' ? '' : 'border border-accented bg-default'"
      :title="t('link.follows')"
    >
      <CmsLinkTarget :value="pickedRef" class="flex-1" />
      <UPopover v-model:open="pickerOpen" :content="{ align: 'end' }">
        <UButton size="xs" color="neutral" variant="ghost" icon="i-lucide-file-search" :aria-label="t('link.edit')">
          <span class="max-sm:hidden">{{ t('link.edit') }}</span>
        </UButton>
        <template #content>
          <CmsLinkPicker :initial="null" refs @pick="onPick" />
        </template>
      </UPopover>
      <UButton size="xs" color="neutral" variant="ghost" icon="i-lucide-x" :aria-label="t('link.remove')" @click="() => { model = '' }" />
    </div>
    <UInput v-else :id="id" v-model="model" :variant="variant" :placeholder="variant === 'ghost' ? t('fields.notSet') : undefined" class="w-full" :maxlength="max" :icon="icon" :ui="href || pickable ? { trailing: 'pe-1.5' } : undefined">
      <template v-if="href || pickable" #trailing>
        <UPopover v-if="pickable" v-model:open="pickerOpen" :content="{ align: 'end' }">
          <UButton size="xs" color="neutral" variant="ghost" icon="i-lucide-file-search" :aria-label="t('link.choose')">
            <span class="max-sm:hidden">{{ t('link.choose') }}</span>
          </UButton>
          <template #content>
            <CmsLinkPicker :initial="null" :refs="asRefs" @pick="onPick" />
          </template>
        </UPopover>
        <UButton
          v-if="href" :to="href" target="_blank" rel="noopener" size="xs" color="neutral" variant="ghost"
          trailing-icon="i-lucide-arrow-up-right" :aria-label="t('fields.openLink')"
        ><span class="max-sm:hidden">{{ pickable ? '' : t('fields.open') }}</span></UButton>
      </template>
    </UInput>
    <p v-if="max && (model?.length ?? 0) > max * 0.8" class="mt-1 text-xs text-muted tabular-nums text-right">
      {{ model?.length ?? 0 }} / {{ max }}
    </p>
  </div>
</template>
