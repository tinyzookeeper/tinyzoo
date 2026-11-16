<script setup lang="ts">
// The events plugin's admin page: /admin/p/events. A page of a plugin is an ordinary admin
// page: it uses the admin layout and the CMS's own components and texts.
definePageMeta({ layout: 'admin' })
const { t, formatDate } = useCmsI18n()
useHead({ title: () => t('plugins.events.title') })
const { data } = await useFetch<{ total: number; upcoming: number; next: { id: string; title: string; startsAt: string } | null }>('/api/cms/_p/events/summary')
</script>

<template>
  <CmsPage :title="t('plugins.events.title')" :description="t('plugins.events.description')" :breadcrumbs="[{ label: t('nav.home'), to: '/admin' }, { label: t('plugins.events.title') }]">
    <div class="grid gap-4 sm:grid-cols-3">
      <div class="cms-card p-4">
        <p class="cms-label">{{ t('plugins.events.total') }}</p>
        <p data-test="events-total" class="mt-1 text-2xl font-semibold tabular-nums text-highlighted">{{ data?.total ?? 0 }}</p>
      </div>
      <div class="cms-card p-4">
        <p class="cms-label">{{ t('plugins.events.upcoming') }}</p>
        <p data-test="events-upcoming" class="mt-1 text-2xl font-semibold tabular-nums text-highlighted">{{ data?.upcoming ?? 0 }}</p>
      </div>
      <div class="cms-card p-4">
        <p class="cms-label">{{ t('plugins.events.next') }}</p>
        <p v-if="data?.next" class="mt-1 text-sm text-highlighted">{{ data.next.title }} · {{ formatDate(data.next.startsAt) }}</p>
        <p v-else class="mt-1 text-sm text-muted">{{ t('plugins.events.none') }}</p>
      </div>
    </div>
    <UButton class="mt-4" variant="outline" color="neutral" icon="i-lucide-calendar-days" to="/admin/events">{{ t('plugins.events.open') }}</UButton>
  </CmsPage>
</template>
