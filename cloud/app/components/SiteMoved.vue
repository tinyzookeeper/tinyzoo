<script setup lang="ts">
import type { SiteView } from '#shared/api'

// A website that moved away: where it lives now, and the data it left here.
const props = defineProps<{ site: SiteView }>()
const emit = defineEmits<{ changed: [site: SiteView] }>()
const t = useT()
const errorText = useErrorText()

const open = ref(false)
const confirmText = ref('')
const removing = ref(false)
const error = ref('')
const hide = () => { open.value = false }
const ask = () => { confirmText.value = ''; error.value = ''; open.value = true }
async function removeData() {
  removing.value = true
  error.value = ''
  try {
    const res = await $fetch<{ site: SiteView }>(`/api/sites/${props.site.id}/moved-data`, { method: 'POST', body: { confirm: confirmText.value } })
    open.value = false
    emit('changed', res.site)
  }
  catch (err) { error.value = errorText(err) }
  finally { removing.value = false }
}
</script>

<template>
  <section class="z-card p-5 sm:p-6" data-moved :data-moved-data="site.dataRemoved ? 'removed' : 'here'">
    <h2 class="z-title text-xl leading-snug text-highlighted">{{ t('site.movedTitle') }}</h2>
    <p class="mt-1.5 text-[0.9375rem] leading-relaxed text-pretty text-muted">{{ t('site.movedText', { url: hostOf(site.movedTo) }) }}</p>
    <UButton v-if="site.movedTo" :to="site.movedTo" target="_blank" :label="t('site.movedOpen')" size="lg" block class="mt-5" trailing-icon="i-lucide-arrow-up-right" data-moved-open />
    <p v-if="site.dataRemoved" class="mt-4 text-sm text-pretty text-muted" data-moved-gone>{{ t('move.dataGone') }}</p>
    <div v-else class="mt-4 flex items-center justify-between gap-4">
      <p class="text-sm text-pretty text-muted">{{ t('move.dataText') }}</p>
      <UButton :label="t('move.dataTitle')" color="error" variant="ghost" icon="i-lucide-trash-2" class="shrink-0" data-moved-delete @click="ask" />
    </div>

    <UModal v-model:open="open" :title="t('move.dataTitle')" :description="t('move.dataText')" :ui="{ footer: 'justify-end' }">
      <template #body>
        <form id="remove-moved-data" class="flex flex-col gap-3" @submit.prevent="removeData">
          <UFormField :label="t('site.deleteConfirm', { slug: site.slug })" name="confirm">
            <UInput v-model="confirmText" size="lg" class="w-full" autocapitalize="none" autocomplete="off" spellcheck="false" :placeholder="site.slug" :ui="{ base: 'font-mono' }" />
          </UFormField>
          <UAlert v-if="error" color="error" variant="soft" icon="i-lucide-circle-alert" :description="error" />
        </form>
      </template>
      <template #footer>
        <UButton :label="t('common.cancel')" color="neutral" variant="ghost" @click="hide" />
        <UButton type="submit" form="remove-moved-data" :label="t('move.dataConfirm')" color="error" :loading="removing" :disabled="confirmText.trim().toLowerCase() !== site.slug" />
      </template>
    </UModal>
  </section>
</template>
