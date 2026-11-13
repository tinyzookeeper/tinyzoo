// POST /api/cms/_auth/logout — end this browser's session.
export default defineEventHandler(async (event) => {
  const user = getCmsSession(event)
  await clearUserSession(event)
  if (user) await audit(event, 'auth.logout', { userId: user.id })
  return { ok: true }
})
