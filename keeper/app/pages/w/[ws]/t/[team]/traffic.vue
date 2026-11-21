<script setup lang="ts">
import type { ScopeTrafficSite } from '#keeper/types/traffic'

// The visits of every site in this workspace and team, added up, live for today.
const { workspace, team, wsSlug, teamSlug, link } = useScope()
const name = computed(() => team.value?.name ?? workspace.value?.name ?? 'this workspace')
useHead({ title: () => `Traffic · ${name.value} · Keeper` })
const siteLine = (s: ScopeTrafficSite) => (!team.value && (workspace.value?.teams.length ?? 0) > 1 ? s.team.name : '')
</script>

<template>
  <AppPage title="Traffic" :description="`How many people visit the sites of ${name}, live today and over the last days.`">
    <TrafficOverview :workspace="wsSlug" :team="teamSlug" :scope-name="name" :site-link="(s) => link(`/sites/${s.id}#traffic`)" :site-line="siteLine" />
  </AppPage>
</template>
