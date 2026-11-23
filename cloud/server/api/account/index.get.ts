import type { AccountView } from '#shared/api'
import { siteHostSuffix } from '#shared/address'
import { hostingDriverName } from '../../hosting'
import { localPublicUrlPattern } from '../../hosting/local'

// Who is signed in (or nobody), and what the pages need to know about limits and settings.
export default defineEventHandler(async (event): Promise<AccountView> => {
  await migrationsReady()
  const me = await currentUser(event)
  return {
    user: me ? { id: me.id, name: me.name, email: me.email, locale: me.locale, emailVerified: !!me.emailVerifiedAt } : null,
    sites: { used: me ? await siteCount(me.id) : 0, max: maxSitesPerUser() },
    requireVerifiedEmail: requireVerifiedEmail(),
    devVerifyUrl: me && !me.emailVerifiedAt ? devLink(me.id, 'verify') : null,
    siteHost: hostingDriverName() === 'pushbase' ? '.pushbase.app' : siteHostSuffix(localPublicUrlPattern()),
  }
})
