import { oldHostRedirect, redirectHostList } from '#shared/hosts'

// The cloud app moved to another address (NUXT_REDIRECT_HOSTS, host names separated by commas): a
// page asked for on one of its old host names is sent to NUXT_PUBLIC_URL, for good (301), with
// the same path and query, and so is a browser on its way through a sign-in (GET
// /oauth/authorize, 302). The API and the account service's server-to-server routes still
// answer on the old name. The rule and its reasons: shared/hosts.ts.
export default defineEventHandler((event) => {
  const config = useRuntimeConfig()
  const redirectHosts = redirectHostList(config.redirectHosts)
  if (!redirectHosts.length) return
  const req = event.node.req
  // The name the visitor asked for: a proxy that rewrites Host says it in X-Forwarded-Host.
  const redirect = oldHostRedirect({
    method: event.method,
    url: String(req.url || '/'),
    host: String(req.headers['x-forwarded-host'] || '').split(',')[0] || req.headers.host,
    publicUrl: String(config.publicUrl || ''),
    redirectHosts,
  })
  if (redirect) return sendRedirect(event, redirect.to, redirect.status)
})
