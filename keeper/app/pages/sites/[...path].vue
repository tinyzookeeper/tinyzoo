<script setup lang="ts">
import type { SiteDetail } from '#keeper/types/keeper'

// Older addresses: /sites/<id>, /sites/<id>/edit (links in e-mails sent before workspaces) and
// /sites/new. A site goes to its workspace and team; a new one to the last workspace.
const route = useRoute()
const parts = ([] as string[]).concat(route.params.path ?? [])
const [id, rest] = parts
if (id === 'new' || !id) {
  const to = homePath(useMe().value, useLastScope().value)
  await navigateTo(to ? `${to}/sites/new` : '/', { replace: true })
}
else {
  const site = await useRequestFetch()<SiteDetail>(`/api/sites/${encodeURIComponent(id)}`).catch(() => null)
  if (!site) throw createError({ statusCode: 404, statusMessage: 'Site not found', fatal: true })
  await navigateTo({ path: `/w/${site.workspace.slug}/t/${site.team.slug}/sites/${site.id}${rest === 'edit' ? '/edit' : ''}`, hash: route.hash }, { replace: true })
}
</script>

<template>
  <div />
</template>
