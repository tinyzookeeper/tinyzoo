<script setup lang="ts">
// A list or page that could not be loaded, in words an editor can act on. A refusal
// (403) says so and offers no "Try again" — asking again gets the same answer; anything
// else says what went wrong and lets them retry. (A 401 never gets here for long: the
// admin sends someone whose session ended back to sign-in — see plugins/cmsSignedOut.)
const props = defineProps<{ error: any }>()
defineEmits<{ retry: [] }>()
const { t } = useCmsI18n()
const status = computed<number | undefined>(() => props.error?.statusCode ?? props.error?.status)
const refused = computed(() => status.value === 403)
</script>

<template>
  <CmsEmptyState
    variant="error"
    :title="refused ? t('errors.noAccessTitle') : t('list.loadFailed')"
    :description="refused ? t('errors.noAccessBody') : cmsRequestError(error, t as any)"
  >
    <template #actions>
      <UButton v-if="refused" to="/admin" color="neutral" variant="outline" icon="i-lucide-house">{{ t('nav.home') }}</UButton>
      <UButton v-else color="neutral" variant="outline" icon="i-lucide-rotate-ccw" @click="$emit('retry')">{{ t('list.retry') }}</UButton>
    </template>
  </CmsEmptyState>
</template>
