/**
 * A website's address in the normal form the account service keeps for its client (sign-in
 * with the tinyzoo account, cmsAccount.ts; docs/multi-tenant-plan.md 2.15): scheme and host
 * in lower case, no default port (`:443` of https, `:80` of http), no trailing slash.
 *
 * The issuer compares `redirect_uri` letter by letter with the client's address + the
 * callback path, and keeps the client's address in this form. So a site whose public
 * address was set as `https://Example.com:443/` must still send
 * `https://example.com/api/cms/_auth/account/callback`.
 *
 * A path after the host is kept without its trailing slash (the issuer's clients are plain
 * origins; a site under a path is its own matter). Anything that is not an http(s) address
 * comes back as it was, without trailing slashes: the caller's own checks say what is wrong.
 *
 * Nothing here touches a request or a setting, so it is covered by a unit spec.
 */
const TRAILING_SLASHES = /\/+$/

export function accountSiteAddress(address: string): string {
  const plain = String(address ?? '').trim().replace(TRAILING_SLASHES, '')
  if (!plain) return ''
  try {
    const url = new URL(plain)
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return plain
    return url.origin + url.pathname.replace(TRAILING_SLASHES, '')
  }
  catch {
    return plain
  }
}
