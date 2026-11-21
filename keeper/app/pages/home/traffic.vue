<script setup lang="ts">
import type { ScopeTrafficSite } from '#keeper/types/traffic'

// The visits of every site in every workspace I work in, added up, live for today.
useHead({ title: 'Traffic · Every workspace · Keeper' })
const me = useMe()
const siteLine = (s: ScopeTrafficSite) => {
  const ws = me.value?.workspaces.find((w) => w.slug === s.workspace.slug)
  return (ws?.teams.length ?? 0) > 1 ? `${s.workspace.name} · ${s.team.name}` : s.workspace.name
}
</script>

<template>
  <AppPage title="Traffic" :trail="[{ label: 'Every workspace', to: '/home' }]" description="How many people visit your sites across every workspace, live today and over the last days.">
    <TrafficOverview scope-name="your workspaces" :site-link="(s) => `/w/${s.workspace.slug}/t/${s.team.slug}/sites/${s.id}#traffic`" :site-line="siteLine" />
  </AppPage>
</template>
