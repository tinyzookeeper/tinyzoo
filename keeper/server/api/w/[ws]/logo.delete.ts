// Remove the workspace's own logo (owner or admin): it shows its default team's again.
export default defineEventHandler(async (event) => {
  const { m } = await requireWorkspace(event, { manager: true })
  await setOwnLogo('workspace', m.workspaceId, null)
  return { ok: true }
})
