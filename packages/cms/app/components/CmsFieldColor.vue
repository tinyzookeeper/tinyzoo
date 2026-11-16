<script setup lang="ts">
// A colour (#rrggbb): the system colour picker next to the hex code, both editable.
const props = defineProps<{ field: any; entity?: string; id?: string }>()
const model = defineModel<string | null | undefined>()
const { t } = useCmsI18n()
const injected = inject<Ref<'outline' | 'ghost'> | null>('cmsFieldVariant', null)
const variant = computed(() => injected?.value ?? 'outline')
const valid = computed(() => typeof model.value === 'string' && /^#[0-9a-fA-F]{6}$/.test(model.value))
function onPick(e: Event) {
  model.value = (e.target as HTMLInputElement).value
}
// Leaving the box tidies what was typed: "1f6feb" → "#1f6feb", "#1f6" → "#11ff66".
const touched = ref(false)
function normalize() {
  touched.value = true
  const typed = String(model.value ?? '').trim().toLowerCase()
  if (!typed || typed === '#') { model.value = props.field.optional ? null : ''; return }
  // Only hex digits get their "#" (never "red" → "#red").
  if (!/^#?[0-9a-f]+$/.test(typed)) { model.value = typed; return }
  const raw = typed.startsWith('#') ? typed : `#${typed}`
  const short = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/.exec(raw)
  model.value = short ? `#${short[1]}${short[1]}${short[2]}${short[2]}${short[3]}${short[3]}` : raw
}
const showHint = computed(() => touched.value && !!model.value && !valid.value)
</script>

<template>
  <div>
  <div class="flex items-center gap-2">
    <label class="relative size-8 shrink-0 cursor-pointer overflow-hidden rounded-md border border-default" :style="{ background: valid ? model! : 'transparent' }">
      <span v-if="!valid" class="absolute inset-0 grid place-items-center text-dimmed"><UIcon name="i-lucide-palette" class="size-4" /></span>
      <input type="color" class="absolute inset-0 size-full cursor-pointer opacity-0" :value="valid ? model! : '#000000'" :aria-label="t('fields.pickColor')" @input="onPick">
    </label>
    <UInput
      :id="id" v-model="model" :variant="variant" placeholder="#1f6feb" class="w-32" maxlength="7"
      :ui="{ base: 'font-mono text-[0.8125rem] uppercase' }" :aria-invalid="showHint" @blur="normalize"
    />
    <UButton v-if="model && field.optional" color="neutral" variant="ghost" size="sm" icon="i-lucide-x" :aria-label="t('fields.clear')" @click="model = null" />
  </div>
  <p v-if="showHint" class="mt-1 text-sm text-error">{{ t('fields.colorHint') }}</p>
  </div>
</template>
