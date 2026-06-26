// Bridge the host's auth (nuxt-auth-utils) into the CMS: the package reads
// `event.context.cmsUser`, staying decoupled from any specific auth provider.
export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  event.context.cmsUser = session?.user ?? null
})
