import { describe, expect, it } from 'vitest'
import { DEFAULT_SITE_URL_PATTERN, siteHostSuffix, siteUrlFor, siteUrlPattern } from '../../cloud/shared/address'

// The public address of a website of the local hosting driver comes from one pattern.
describe('the pattern of the sites’ addresses', () => {
  it('is http://<slug>.localhost:<port> unless told otherwise', () => {
    expect(DEFAULT_SITE_URL_PATTERN).toBe('http://{slug}.localhost:{port}')
    for (const empty of ['', '   ', undefined, null]) expect(siteUrlPattern(empty)).toBe(DEFAULT_SITE_URL_PATTERN)
    expect(siteUrlFor('', 'pekarna', 4300)).toBe('http://pekarna.localhost:4300')
    expect(siteHostSuffix('')).toBe('.localhost')
  })

  it('gives a real-looking address without a port', () => {
    expect(siteUrlFor('https://{slug}.pushbase.app', 'johana-loudova', 4371)).toBe('https://johana-loudova.pushbase.app')
    expect(siteUrlFor('https://{slug}.pushbase.app/', 'foto', 4371)).toBe('https://foto.pushbase.app')
    expect(siteHostSuffix('https://{slug}.pushbase.app')).toBe('.pushbase.app')
    expect(siteHostSuffix('https://{slug}.weby.example.cz')).toBe('.weby.example.cz')
  })

  it('may keep the port, on another name', () => {
    expect(siteUrlFor('http://{slug}.lvh.me:{port}', 'foto', 4302)).toBe('http://foto.lvh.me:4302')
    expect(siteHostSuffix('http://{slug}.lvh.me:{port}')).toBe('.lvh.me')
  })

  it('falls back to the default when the pattern would not give a site its own address', () => {
    for (const bad of ['https://pushbase.app', 'ftp://{slug}.example.com', '{slug}.pushbase.app', 'https://example.com/{slug}', 'https://{slug}.example.com/sites', 'https://{slug}.example.com?x=1', 'not a url {slug}']) {
      expect(siteUrlPattern(bad), bad).toBe(DEFAULT_SITE_URL_PATTERN)
    }
  })
})
