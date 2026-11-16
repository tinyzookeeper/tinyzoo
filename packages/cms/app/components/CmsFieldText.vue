<script setup lang="ts">
// A line (or box) of text. Links, e-mails and the developer's `.icon()` show an
// icon inside the box; a filled-in link can be opened from the box.
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
</script>

<template>
  <div class="w-full">
    <UTextarea v-if="multiline" :id="id" v-model="model" :variant="variant" class="w-full" autoresize :rows="3" :maxrows="12" :maxlength="max" />
    <UInput v-else :id="id" v-model="model" :variant="variant" :placeholder="variant === 'ghost' ? t('fields.notSet') : undefined" class="w-full" :maxlength="max" :icon="icon" :ui="href || pickable ? { trailing: 'pe-1.5' } : undefined">
      <template v-if="href || pickable" #trailing>
        <UPopover v-if="pickable" v-model:open="pickerOpen" :content="{ align: 'end' }">
          <UButton size="xs" color="neutral" variant="ghost" icon="i-lucide-file-search" :aria-label="t('link.choose')">
            <span class="max-sm:hidden">{{ t('link.choose') }}</span>
          </UButton>
          <template #content>
            <CmsLinkPicker :initial="null" @pick="onPick" />
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
