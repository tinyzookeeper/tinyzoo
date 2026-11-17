// GET /api/cms/_auth/me — the signed-in person (fresh from the database).
export default defineEventHandler((event) => {
  const user = requireCmsAccount(event)
  const role = roleOf(user)
  // What the person's role lets them do beyond the entities (which `_graph` tells): the admin
  // reads it for the role's name, the media library and the "your role no longer exists" screen.
  return {
    user,
    access: role
      ? { removed: false, role: role.name, label: role.label ?? null, custom: role.custom, base: role.base, publish: role.publish, media: role.media, manage: role.manage }
      : { removed: true, role: String(user.role) },
  }
})
