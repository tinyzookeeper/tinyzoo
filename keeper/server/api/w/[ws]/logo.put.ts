// Upload the workspace's logo (owner or admin): a multipart form with `file`, at most 512 KB.
// Without one, the workspace shows its default team's logo (logos.ts).
export default defineEventHandler(async (event) => {
  const { m } = await requireWorkspace(event, { manager: true })
  await setOwnLogo('workspace', m.workspaceId, await readLogoUpload(event))
  return { ok: true }
})
