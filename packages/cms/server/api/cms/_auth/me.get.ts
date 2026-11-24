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
    // Sign-in with the tinyzoo account is on here: the admin then asks for the person's websites (the switcher).
    ...(cmsAccount() ? { account: { enabled: true } } : {}),
    // The person has no password on this site (they came in through the tinyzoo account): the forms that
    // ask for the current password say so instead. The key is absent for everybody who has one.
    ...(event.context.cmsNoPassword ? { noPassword: true } : {}),
  }
})
