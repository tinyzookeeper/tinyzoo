// The address people open a website of the local hosting driver at.
//
// The processes always run on this machine, each on a port of its own. What a person sees (in
// the wizard, on the site's page, in e-mails) and what the site itself believes its address is
// (its links, its invitation) comes from one pattern, NUXT_HOSTING_LOCAL_PUBLIC_URL:
//
//   http://{slug}.localhost:{port}     the default: works in a browser with nothing in front
//   https://{slug}.pushbase.app        a real-looking address: something in front of the sites
//                                      must then lead that name to the site's port (the recorded
//                                      walkthrough starts such a proxy for its own browser)
//
// `{slug}` is required, `{port}` optional.

export const DEFAULT_SITE_URL_PATTERN = 'http://{slug}.localhost:{port}'

const fill = (pattern: string, slug: string, port: number | string) => pattern.replaceAll('{slug}', slug).replaceAll('{port}', String(port))

/** The pattern from settings without a trailing slash; anything that would not give an http(s) address with the slug in its host falls back to the default. */
export function siteUrlPattern(value: unknown): string {
  const pattern = String(value ?? '').trim().replace(/\/+$/, '')
  if (!pattern) return DEFAULT_SITE_URL_PATTERN
  try {
    const url = new URL(fill(pattern, 'slug-probe', 4300))
    if (!/^https?:$/.test(url.protocol) || !url.hostname.includes('slug-probe') || url.pathname !== '/' || url.search || url.hash) return DEFAULT_SITE_URL_PATTERN
  }
  catch {
    return DEFAULT_SITE_URL_PATTERN
  }
  return pattern
}

/** A site's public address: "https://pekarna.pushbase.app", "http://pekarna.localhost:4300". */
export function siteUrlFor(pattern: string, slug: string, port: number): string {
  return fill(siteUrlPattern(pattern), slug, port)
}

/**
 * What follows the slug in an address as people read it, before the site has a port:
 * ".pushbase.app", ".localhost". (The port, when the pattern has one, is only known once the
 * site is made, so it is left out.)
 */
export function siteHostSuffix(pattern: string): string {
  const host = new URL(fill(siteUrlPattern(pattern), 'slug-probe', 4300)).hostname
  return host.slice(host.indexOf('slug-probe') + 'slug-probe'.length)
}
