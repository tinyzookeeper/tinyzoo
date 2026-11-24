import type { AccountView } from '#shared/api'
import { siteHostSuffix } from '#shared/address'
import { hostingDriverName, makesSites, NO_HOSTING } from '../../hosting'
import { localPublicUrlPattern } from '../../hosting/local'

/** What follows the slug in a site's address, as the wizard shows it. The shared driver's sites are always <slug>.localhost. */
function siteHost(): string {
  const driver = hostingDriverName()
  if (driver === 'pushbase') return '.pushbase.app'
  if (driver === 'shared') return '.localhost'
  if (driver === NO_HOSTING) return ''
  return siteHostSuffix(localPublicUrlPattern())
}

// Who is signed in (or nobody), and what the pages need to know about limits and settings.
export default defineEventHandler(async (event): Promise<AccountView> => {
  await migrationsReady()
  const me = await currentUser(event)
  return {
    user: me ? { id: me.id, name: me.name, email: me.email, locale: me.locale, emailVerified: !!me.emailVerifiedAt } : null,
    sites: { used: me ? await siteCount(me.id) : 0, max: maxSitesPerUser() },
    requireVerifiedEmail: requireVerifiedEmail(),
    devVerifyUrl: me && !me.emailVerifiedAt ? devLink(me.id, 'verify') : null,
    siteHost: siteHost(),
    canImport: hostingDriverName() === 'shared',
    canCreate: makesSites(),
  }
})
