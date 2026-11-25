import { describe, expect, it } from 'vitest'
import { hostName, oldHostRedirect, redirectHostList } from '../../cloud/shared/hosts'

// The cloud app at a new address: what a request on one of its old host names gets. Pages and
// a sign-in on its way go to the new address; what a website's server calls stays.

const moved = (over: Partial<Parameters<typeof oldHostRedirect>[0]> = {}) => oldHostRedirect({
  method: 'GET', url: '/', host: 'account.old.example', publicUrl: 'https://account.new.example', redirectHosts: ['account.old.example'], ...over,
})

describe('redirectHostList', () => {
  it('reads names separated by commas, in lower case, without ports or repeats', () => {
    expect(redirectHostList('Account.Old.example, first.example:443 ,, account.old.example')).toEqual(['account.old.example', 'first.example'])
    expect(redirectHostList('')).toEqual([])
    expect(redirectHostList(undefined)).toEqual([])
    expect(hostName('[::1]:3200')).toBe('[::1]')
  })
})

describe('oldHostRedirect', () => {
  it('sends a page to the new address for good, with its path and query', () => {
    expect(moved()).toEqual({ to: 'https://account.new.example/', status: 301 })
    expect(moved({ url: '/login?next=%2Fsites' })).toEqual({ to: 'https://account.new.example/login?next=%2Fsites', status: 301 })
    expect(moved({ method: 'HEAD', url: '/sites', host: 'ACCOUNT.old.example:443' })).toEqual({ to: 'https://account.new.example/sites', status: 301 })
    expect(moved({ publicUrl: 'https://account.new.example/', url: '/a' })).toEqual({ to: 'https://account.new.example/a', status: 301 })
  })

  it('sends a sign-in on its way to the new address, with everything the website asked for', () => {
    const url = '/oauth/authorize?response_type=code&client_id=c1&redirect_uri=https%3A%2F%2Fsite.example%2Fapi%2Fcms%2F_auth%2Faccount%2Fcallback&state=s&code_challenge=x&code_challenge_method=S256&prompt=none'
    expect(moved({ url })).toEqual({ to: `https://account.new.example${url}`, status: 302 })
    // Without a query the new address answers with its own error page.
    expect(moved({ url: '/oauth/authorize' })).toEqual({ to: 'https://account.new.example/oauth/authorize', status: 302 })
  })

  it('answers what a website\'s server calls on the old name', () => {
    for (const url of ['/oauth/token', '/oauth/sites', '/oauth/membership', '/oauth/authorize/x', '/.well-known/tinyzoo-account', '/api/slug?slug=a', '/api/domains/ask?domain=a.example', '/_nuxt/entry.js', '/__nuxt_error']) {
      expect(moved({ url }), url).toBeNull()
    }
  })

  it('redirects only GET and HEAD', () => {
    for (const method of ['POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']) {
      expect(moved({ method })).toBeNull()
      expect(moved({ method, url: '/oauth/authorize?client_id=c1' })).toBeNull()
    }
  })

  it('leaves every other host alone, and never redirects a host to itself', () => {
    for (const host of ['account.new.example', 'localhost:3200', '', undefined, 'notaccount.old.example', 'account.old.example.evil.test']) expect(moved({ host })).toBeNull()
    expect(moved({ publicUrl: 'https://account.old.example' })).toBeNull()
  })

  it('does nothing without a usable public address, and never leaves it', () => {
    for (const publicUrl of ['', 'not an address', 'ftp://account.new.example']) expect(moved({ publicUrl })).toBeNull()
    expect(moved({ url: '//evil.test/x' })).toEqual({ to: 'https://account.new.example//evil.test/x', status: 301 })
    expect(moved({ url: 'https://evil.test/' })).toBeNull()
  })
})
