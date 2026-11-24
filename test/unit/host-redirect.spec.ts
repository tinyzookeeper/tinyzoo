import { describe, expect, it } from 'vitest'
import { hostName, hostRedirectTarget, redirectHostList } from '../../packages/cms/shared/host-redirect'

// A site that moved to another address: pages asked for on an old host name go to the public
// address; the API, build assets and other hosts stay.

const moved = (over: Partial<Parameters<typeof hostRedirectTarget>[0]> = {}) => hostRedirectTarget({
  method: 'GET', url: '/', host: 'old.example.com', publicUrl: 'https://www.example.com', redirectHosts: ['old.example.com'], ...over,
})

describe('redirectHostList', () => {
  it('reads a list or a text with commas, in lower case, without ports or repeats', () => {
    expect(redirectHostList('Old.Example.com, second.example.com:443 ,, old.example.com')).toEqual(['old.example.com', 'second.example.com'])
    expect(redirectHostList(['A.example.com', ''])).toEqual(['a.example.com'])
    expect(redirectHostList('')).toEqual([])
    expect(redirectHostList(undefined)).toEqual([])
  })
  it('keeps an IPv6 address whole', () => {
    expect(hostName('[::1]:3000')).toBe('[::1]')
  })
})

describe('hostRedirectTarget', () => {
  it('sends a page to the public address with its path and query', () => {
    expect(moved()).toBe('https://www.example.com/')
    expect(moved({ url: '/en/docs?tab=2&q=a%20b' })).toBe('https://www.example.com/en/docs?tab=2&q=a%20b')
    expect(moved({ url: '/admin/login', host: 'OLD.example.com:443' })).toBe('https://www.example.com/admin/login')
    expect(moved({ method: 'HEAD', url: '/sitemap.xml' })).toBe('https://www.example.com/sitemap.xml')
  })
  it('drops a trailing slash of the public address', () => {
    expect(moved({ publicUrl: 'https://www.example.com/', url: '/a' })).toBe('https://www.example.com/a')
  })
  it('answers the API, build assets and /.well-known on the old name', () => {
    for (const url of ['/api/health/ready', '/api/cms/_theme?x=1', '/_nuxt/entry.js', '/__nuxt_error', '/_ipx/w_300/a.jpg', '/.well-known/oauth-authorization-server']) {
      expect(moved({ url })).toBeNull()
    }
  })
  it('redirects only GET and HEAD', () => {
    for (const method of ['POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']) expect(moved({ method })).toBeNull()
  })
  it('leaves every other host alone', () => {
    for (const host of ['www.example.com', 'localhost:3000', '10.0.0.7', '', undefined, 'notold.example.com', 'old.example.com.evil.test']) {
      expect(moved({ host })).toBeNull()
    }
  })
  it('never redirects a host to itself', () => {
    expect(moved({ publicUrl: 'https://old.example.com' })).toBeNull()
  })
  it('does nothing without a usable public address', () => {
    for (const publicUrl of ['', 'not an address', 'ftp://www.example.com']) expect(moved({ publicUrl })).toBeNull()
  })
  it('stays on the public address whatever the path looks like', () => {
    expect(moved({ url: '//evil.test/x' })).toBe('https://www.example.com//evil.test/x')
    expect(moved({ url: 'https://evil.test/' })).toBe('https://www.example.com/')
  })
})
