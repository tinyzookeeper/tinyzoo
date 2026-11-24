<script setup lang="ts">
import type { SiteView } from '#shared/api'

// "Move this website", in a quiet place: prepare its archive (the steps, live), download it,
// and say where the website lives now. The page keeps the website current (`refresh`).
const props = defineProps<{ site: SiteView }>()
const emit = defineEmits<{ refresh: []; changed: [site: SiteView] }>()
const t = useT()
const errorText = useErrorText()
const { locale } = useLocale()
const toast = useToast()

const open = ref(false)
const show = () => { open.value = true }
const hide = () => { open.value = false }
const out = computed(() => props.site.export)
const working = computed(() => out.value?.state === 'running' || out.value?.state === 'pending')
const failedCode = computed(() => out.value?.steps.find((s) => s.state === 'failed')?.message ?? null)
const failText = computed(() => (failedCode.value === 'tools_missing' ? t('move.fail.tools_missing') : t('move.failed')))
const downloadUrl = computed(() => `/api/sites/${props.site.id}/export/download`)

// While the archive is being prepared the page is asked for the website every second.
let timer: ReturnType<typeof setInterval> | null = null
watch(working, (now) => {
  if (now && !timer) timer = setInterval(() => emit('refresh'), 1000)
  if (!now && timer) { clearInterval(timer); timer = null }
}, { immediate: import.meta.client })
onBeforeUnmount(() => { if (timer) clearInterval(timer) })

const starting = ref(false)
async function start() {
  starting.value = true
  try {
    const res = await $fetch<{ site: SiteView }>(`/api/sites/${props.site.id}/export`, { method: 'POST' })
    emit('changed', res.site)
  }
  catch (err) { toast.add({ title: errorText(err), color: 'error' }) }
  finally { starting.value = false }
}

const newUrl = ref('')
const moving = ref(false)
const moveError = ref('')
async function moved() {
  moving.value = true
  moveError.value = ''
  try {
    const res = await $fetch<{ site: SiteView }>(`/api/sites/${props.site.id}/moved`, { method: 'POST', body: { url: newUrl.value } })
    open.value = false
    emit('changed', res.site)
    toast.add({ title: t('move.movedDone'), icon: 'i-lucide-check' })
  }
  catch (err) { moveError.value = errorText(err) }
  finally { moving.value = false }
}
</script>

<template>
  <section class="flex items-center justify-between gap-4 px-1" data-move>
    <p class="text-sm text-pretty text-muted">{{ t('move.hint') }}</p>
    <UButton :label="t('move.title')" color="neutral" variant="ghost" icon="i-lucide-package" class="shrink-0" data-move-open @click="show" />

    <UModal v-model:open="open" :title="t('move.title')" :description="t('move.lead')" :ui="{ footer: 'justify-end' }">
      <template #body>
        <div class="flex flex-col gap-5" :data-export="out?.state ?? 'none'">
          <!-- The archive: being prepared, there to download, or not asked for yet. -->
          <div>
            <ol v-if="out && (working || out.state === 'failed')" class="mb-3 flex flex-col gap-1.5 text-sm">
              <li v-for="s in out.steps" :key="s.id" class="flex items-center gap-2" :class="s.state === 'pending' ? 'text-dimmed' : 'text-highlighted'" :data-export-step="s.id" :data-state="s.state">
                <UIcon :name="s.state === 'done' ? 'i-lucide-check' : s.state === 'failed' ? 'i-lucide-circle-alert' : s.state === 'running' ? 'i-lucide-loader-circle' : 'i-lucide-circle'" class="size-4 shrink-0" :class="[s.state === 'running' && 'animate-spin', s.state === 'failed' && 'text-error', s.state === 'done' && 'text-(--z-ok)']" />
                {{ t(`move.step.${s.id}`) }}
              </li>
            </ol>
            <UAlert v-if="out?.state === 'failed'" class="mb-3" color="error" variant="soft" icon="i-lucide-circle-alert" :description="failText" data-export-failed />
            <template v-if="out?.ready && !working">
              <p class="text-sm text-highlighted" data-export-ready>{{ t('move.ready', { size: formatSize(out.bytes, locale) }) }}</p>
              <p class="mt-1.5 text-sm leading-relaxed text-pretty text-muted">{{ t('move.secret') }}</p>
              <div class="mt-3 flex flex-wrap gap-2">
                <UButton :to="downloadUrl" external target="_blank" :label="t('move.download')" icon="i-lucide-download" data-export-download />
                <UButton :label="t('move.again')" color="neutral" variant="ghost" :loading="starting" @click="start" />
              </div>
            </template>
            <template v-else-if="!working">
              <p class="text-sm leading-relaxed text-pretty text-muted">{{ t('move.note') }}</p>
              <UButton class="mt-3" :label="out ? t('move.again') : t('move.start')" icon="i-lucide-package" :loading="starting" data-export-start @click="start" />
            </template>
            <p v-else class="text-sm text-muted">{{ t('move.note') }}</p>
          </div>

          <!-- With the archive made: the website lives elsewhere now. -->
          <form v-if="out?.state === 'done'" id="site-moved" class="flex flex-col gap-3 border-t border-default pt-5" @submit.prevent="moved">
            <div>
              <h3 class="text-sm font-medium text-highlighted">{{ t('move.movedTitle') }}</h3>
              <p class="mt-1 text-sm leading-relaxed text-pretty text-muted">{{ t('move.movedText') }}</p>
            </div>
            <UFormField :label="t('move.movedLabel')" name="url" :error="moveError || undefined">
              <UInput v-model="newUrl" class="w-full" placeholder="https://" autocapitalize="none" autocomplete="off" spellcheck="false" :ui="{ base: 'font-mono' }" data-moved-url />
            </UFormField>
          </form>
        </div>
      </template>
      <template #footer>
        <UButton :label="t('move.close')" color="neutral" variant="ghost" @click="hide" />
        <UButton v-if="out?.state === 'done'" type="submit" form="site-moved" :label="t('move.movedConfirm')" color="neutral" variant="outline" :loading="moving" :disabled="!newUrl.trim()" data-moved-confirm />
      </template>
    </UModal>
  </section>
</template>
