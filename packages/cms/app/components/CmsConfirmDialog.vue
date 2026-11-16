<script setup lang="ts">
import type { CmsConfirmOptions } from '../composables/useCmsConfirm'

// The admin's one confirm dialog — see useCmsConfirm. The safe answer has the focus,
// so Enter or Esc never loses anything by accident.
const { t } = useCmsI18n()
const question = useCmsConfirmQuestion()
// Keeps the last question's text while the dialog fades out.
const shown = ref<CmsConfirmOptions | null>(null)
watch(question, (q) => { if (q) shown.value = q })

function answer(ok: boolean) {
  const q = question.value
  question.value = null
  q?.resolve(ok)
}
const tone = computed(() => shown.value?.color ?? 'primary')
const icon = computed(() => shown.value?.icon ?? (tone.value === 'error' ? 'i-lucide-trash-2' : tone.value === 'warning' ? 'i-lucide-triangle-alert' : 'i-lucide-circle-help'))
// Calm by default (a cream tile, the usual dark button); red only when something is
// deleted for good. When going ahead loses something (unsaved work, a live page),
// the safe answer is the strong button too, not only the focused one.
const danger = computed(() => tone.value === 'error')
const safeFirst = computed(() => tone.value === 'error' || tone.value === 'warning')
</script>

<template>
  <UModal
    :open="!!question" :close="false" :title="shown?.title" :description="shown?.description"
    :ui="{ content: 'sm:max-w-md divide-y-0', header: 'hidden', body: 'p-5 sm:p-6', footer: 'justify-end gap-2 px-5 pb-5 pt-0 sm:px-6 sm:pb-6 border-0' }"
    @update:open="(v: boolean) => { if (!v) answer(false) }"
  >
    <template #body>
      <div class="flex items-start gap-4">
        <span class="size-10 shrink-0 rounded-full grid place-items-center" :class="danger ? 'bg-error/10 text-error' : 'bg-(--cms-moment-strong) text-highlighted'">
          <UIcon :name="icon" class="size-5" />
        </span>
        <div class="min-w-0 pt-1.5 space-y-1.5">
          <p class="font-semibold text-highlighted text-pretty leading-snug">{{ shown?.title }}</p>
          <!-- a description may be several short statements, one per line -->
          <div v-if="shown?.description" class="space-y-1.5 text-sm text-muted">
            <p v-for="(line, i) in shown.description.split('\n')" :key="i" class="text-pretty">{{ line }}</p>
          </div>
        </div>
      </div>
    </template>
    <template #footer>
      <UButton color="neutral" :variant="safeFirst ? 'solid' : 'outline'" autofocus @click="answer(false)">
        {{ shown?.cancelLabel ?? t('common.cancel') }}
      </UButton>
      <UButton :color="danger ? 'error' : 'neutral'" :variant="safeFirst ? (danger ? 'soft' : 'outline') : 'solid'" @click="answer(true)">
        {{ shown?.confirmLabel ?? t('common.confirm') }}
      </UButton>
    </template>
  </UModal>
</template>
