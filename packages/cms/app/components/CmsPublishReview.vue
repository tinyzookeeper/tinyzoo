<script setup lang="ts">
// The step before something goes on the website: what is ready, what is missing
// (each with the way to fix it), and when — now or at a chosen time. Warnings say
// what visitors will see and never block publishing. A required field left empty
// does block it (the save would be refused): it is listed first, with a way to it.
export interface CmsReviewCheck {
  ok: boolean
  /** Not ok and stops publishing (a required field is empty). */
  blocking?: boolean
  title: string
  description?: string
  action?: { label: string; onClick: () => void }
}
const props = defineProps<{
  checks: CmsReviewCheck[]
  /** The publish-date field, when this content can be scheduled. */
  dateField?: any
  entity: string
  busy?: boolean
  /** The heading, when it is for one language ("Publish the English version"); else "Almost there." */
  title?: string
  /** The line under it; else "Check it, then publish." */
  subtitle?: string
  /** What "Right now" means, when not "Visitors see it within a minute" (a language waiting for the default one). */
  nowHint?: string
  /** The button, when not "Publish on the website". */
  publishLabel?: string
}>()
const open = defineModel<boolean>('open', { default: false })
/** The publish date (scheduling edits it in place). */
const date = defineModel<any>('date')
const emit = defineEmits<{ publish: [when: 'now' | 'schedule'] }>()
const { t } = useCmsI18n()

const when = ref<'now' | 'schedule'>('now')
watch(open, (v) => {
  if (v) when.value = date.value && new Date(date.value).getTime() > Date.now() ? 'schedule' : 'now'
})
// "When": a radio group, so one stop for Tab (the chosen card) and the arrow keys change the choice.
const WHEN = ['now', 'schedule'] as const
function onWhenKey(e: KeyboardEvent) {
  cmsRadioGroupKey(e, WHEN, when.value, (v) => { when.value = v }, (fn) => nextTick(fn))
}
const scheduleInvalid = computed(() => when.value === 'schedule' && !(date.value && new Date(date.value).getTime() > Date.now()))
const warnings = computed(() => props.checks.filter((c) => !c.ok).length)
const blocked = computed(() => props.checks.some((c) => !c.ok && c.blocking))
const animals = useCmsAnimals()
</script>

<template>
  <UModal
    v-model:open="open" fullscreen :title="title || t('review.title')" :description="subtitle || t('review.subtitle')"
    :ui="{ header: 'hidden', body: 'p-0 sm:p-0', content: 'bg-(--cms-page-bg)' }"
  >
    <template #body>
      <div class="flex h-14 items-center justify-between border-b border-default px-3 sm:px-6">
        <UButton color="neutral" variant="ghost" icon="i-lucide-chevron-left" class="-ml-1.5" @click="() => { open = false }">{{ t('review.back') }}</UButton>
      </div>
      <div class="mx-auto w-full max-w-2xl px-4 py-8 sm:py-12">
        <div class="flex items-start justify-between gap-6">
          <div>
            <h2 class="cms-display text-[1.75rem] sm:text-3xl leading-tight text-highlighted text-balance">{{ title || t('review.title') }}</h2>
            <p class="cms-display leading-tight text-muted" :class="subtitle ? 'mt-1 text-lg sm:text-xl' : 'text-[1.75rem] sm:text-3xl'">{{ subtitle || t('review.subtitle') }}</p>
          </div>
          <CmsAnimal v-if="animals" name="bird" class="h-14 sm:h-18 w-auto shrink-0" />
        </div>

        <ul class="cms-card mt-7 divide-y divide-(--ui-border-muted)">
          <li v-for="(c, i) in checks" :key="i" class="flex items-center gap-3.5 px-4 py-3.5">
            <span
              class="grid size-7 shrink-0 place-items-center rounded-full"
              :class="c.ok ? 'bg-success/10 text-success' : c.blocking ? 'bg-error/10 text-error' : 'bg-warning/10 text-warning'"
            >
              <UIcon :name="c.ok ? 'i-lucide-check' : c.blocking ? 'i-lucide-circle-x' : 'i-lucide-circle-alert'" class="size-4" />
            </span>
            <div class="min-w-0 flex-1">
              <p class="text-sm font-medium text-highlighted">{{ c.title }}</p>
              <p v-if="c.description" class="text-sm text-muted text-pretty break-words">{{ c.description }}</p>
            </div>
            <UButton v-if="c.action" color="neutral" variant="outline" size="sm" class="shrink-0" @click="c.action.onClick">{{ c.action.label }}</UButton>
          </li>
        </ul>

        <template v-if="dateField">
          <h3 class="cms-label mt-8 mb-2.5">{{ t('review.when') }}</h3>
          <div class="grid gap-2.5 sm:grid-cols-2" role="radiogroup" :aria-label="t('review.when')">
            <button
              v-for="opt in WHEN" :key="opt" type="button" role="radio" :aria-checked="when === opt"
              :tabindex="when === opt ? 0 : -1"
              class="flex items-start gap-3 rounded-xl border p-3.5 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2"
              :class="when === opt ? 'border-(--ui-primary) ring-1 ring-(--ui-primary)' : 'border-default hover:border-accented'"
              @click="when = opt" @keydown="onWhenKey"
            >
              <span class="mt-0.5 size-4 shrink-0 rounded-full border" :class="when === opt ? 'border-[5px] border-(--ui-primary)' : 'border-accented'" />
              <span>
                <span class="block text-sm font-medium text-highlighted">{{ opt === 'now' ? t('review.now') : t('review.schedule') }}</span>
                <span class="block text-sm text-muted">{{ opt === 'now' ? (nowHint || t('review.nowHint')) : t('review.scheduleHint') }}</span>
              </span>
            </button>
          </div>
          <div v-if="when === 'schedule'" class="mt-4 max-w-xs">
            <CmsField v-model="date" :field="dateField" :entity="entity" placement="main" id-prefix="review-" />
          </div>
        </template>

        <div class="mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p class="text-sm" :class="blocked ? 'text-error' : 'text-muted'" :role="blocked ? 'status' : undefined">{{ blocked ? t('review.requiredFirst') : warnings ? t('review.warningsDontBlock') : t('review.allGood') }}</p>
          <UButton
            size="lg" :loading="busy" :disabled="scheduleInvalid || blocked" class="justify-center"
            :icon="when === 'schedule' ? 'i-lucide-clock' : undefined" @click="emit('publish', when)"
          >{{ when === 'schedule' ? t('review.scheduleAction') : (publishLabel || t('review.publishAction')) }}</UButton>
        </div>
      </div>
    </template>
  </UModal>
</template>
