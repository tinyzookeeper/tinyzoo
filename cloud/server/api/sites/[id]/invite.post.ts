// A fresh link to choose my password for the admin (the old one stops working).
export default defineEventHandler(async (event) => {
  const { me, site } = await requireOwnSite(event)
  if (tooManyAttempts(`invite:${me.id}`, 10, 60 * 60_000)) throw fail(429, 'tooMany', 'Too many attempts, try again later')
  try {
    return { site: toSiteView(await refreshInvite(site)) }
  }
  catch (err: any) {
    if (err?.statusCode) throw err
    console.error('[cloud] a fresh invitation failed', site.slug, err?.message ?? err)
    throw fail(502, 'invite.failed', 'The website did not answer')
  }
})
