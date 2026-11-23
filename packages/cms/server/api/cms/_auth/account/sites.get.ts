// GET /api/cms/_auth/account/sites — the signed-in person's websites, for the switcher at
// the top of the admin (experimental; docs/multi-tenant-plan.md 2.15):
// `{ linked, sites: [{ id, name, url, role, current }], account }`. Asked from the account
// service with the site's client id and secret and kept per person for a minute. Empty when
// the person's user is not linked to an account, or when the account service does not
// answer. 404 unless the site has the account's three settings.
export default defineEventHandler(async (event) => {
  const account = requireCmsAccountSettings()
  const me = requireCmsAccount(event)
  setResponseHeader(event, 'Cache-Control', 'private, no-store')
  return await accountSitesOf(account, me.id)
})
