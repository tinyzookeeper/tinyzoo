// GET /.well-known/tinyzoo-account: where the account service's endpoints are
// (docs/multi-tenant-plan.md, 2.15). For anybody; it holds nothing secret.
export default defineEventHandler((event) => {
  const issuer = issuerUrl(event)
  setResponseHeader(event, 'cache-control', 'public, max-age=300')
  return {
    issuer,
    authorization_endpoint: `${issuer}/oauth/authorize`,
    token_endpoint: `${issuer}/oauth/token`,
    sites_endpoint: `${issuer}/oauth/sites`,
    membership_endpoint: `${issuer}/oauth/membership`,
  }
})
