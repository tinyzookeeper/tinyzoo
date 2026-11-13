// GET /api/cms/_auth/me — the signed-in person (fresh from the database).
export default defineEventHandler((event) => {
  const user = requireCmsUser(event)
  return { user }
})
