<script setup lang="ts">
import type { ScopeTrafficSite } from '#keeper/types/traffic'

// The visits of every site in every workspace I work in, added up, live for today.
useHead({ title: 'Visitors · Every workspace · Keeper' })
const me = useMe()
// Owners and admins of a workspace open on Detailed until they pick.
const detailed = computed(() => workingWorkspaces(me.value).some((w) => w.role === 'owner' || w.role === 'admin'))
const siteLine = (s: ScopeTrafficSite) => {
  const ws = me.value?.workspaces.find((w) => w.slug === s.workspace.slug)
  return (ws?.teams.length ?? 0) > 1 ? `${s.workspace.name} · ${s.team.name}` : s.workspace.name
}
</script>

<template>
  <AppPage title="Visitors" :trail="[{ label: 'Every workspace', to: '/home' }]" description="How many people visit your sites across every workspace, live today and over the last weeks.">
    <TrafficOverview scope-name="your workspaces" :detailed-by-default="detailed" :site-link="(s) => `/w/${s.workspace.slug}/t/${s.team.slug}/sites/${s.id}#traffic`" :site-line="siteLine" />
  </AppPage>
</template>
