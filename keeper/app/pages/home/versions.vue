<script setup lang="ts">
import type { OverviewResponse, SiteSummary } from '#keeper/types/keeper'

// Versions across every workspace I work in: which sites are behind, wherever they are.
useHead({ title: 'Versions · Every workspace · Keeper' })
const me = useMe()
const { data, status } = await useFetch<OverviewResponse>('/api/sites', {
  key: 'overview-everywhere',
  default: () => ({ sites: [], latest: null }),
})
const ids = computed(() => new Set(workingWorkspaces(me.value).map((w) => w.id)))
const sites = computed(() => data.value.sites.filter((s) => ids.value.has(s.workspace.id)))
const siteLink = (s: SiteSummary) => `/w/${s.workspace.slug}/t/${s.team.slug}/sites/${s.id}`
const where = (s: SiteSummary) => {
  const ws = me.value?.workspaces.find((w) => w.id === s.workspace.id)
  return (ws?.teams.length ?? 0) > 1 ? `${s.workspace.name} · ${s.team.name}` : s.workspace.name
}
</script>

<template>
  <AppPage title="Versions" :trail="[{ label: 'Every workspace', to: '/home' }]" description="Which tinyzoo each site runs, across every workspace, the newest first.">
    <VersionsList :sites="sites" :latest="data.latest" :pending="status === 'pending'" :site-link="siteLink" :site-line="where" />
  </AppPage>
</template>
