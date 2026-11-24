// Disconnect a website I connected: nobody signs in to it through the account any more, and it
// leaves everybody's list. The website itself is not touched.
export default defineEventHandler(async (event) => {
  const { client } = await requireOwnClient(event)
  await revokeClient(client.id)
  return { ok: true }
})
