<script setup lang="ts">
import type { OverviewResponse, SiteSummary } from '#keeper/types/keeper'

const { workspace, team, wsSlug, teamSlug, canWrite, link } = useScope()

useHead({ title: 'Versions · Keeper' })
const { data, status } = await useFetch<OverviewResponse>('/api/sites', {
  key: `overview-${wsSlug.value}-${teamSlug.value}`,
  query: { workspace: wsSlug, team: teamSlug },
  default: () => ({ sites: [], latest: null }),
})
const teamOf = (s: SiteSummary) => (!team.value && (workspace.value?.teams.length ?? 0) > 1 ? s.team.name : '')
</script>

<template>
  <AppPage title="Versions" :description="`Which tinyzoo each site of ${team?.name ?? workspace?.name ?? 'yours'} runs, the newest first.`">
    <VersionsList
      :sites="data.sites"
      :latest="data.latest"
      :pending="status === 'pending'"
      :can-write="canWrite"
      :add-to="link('/sites/new')"
      :site-link="(s) => link(`/sites/${s.id}`)"
      :site-line="teamOf"
    />
  </AppPage>
</template>
