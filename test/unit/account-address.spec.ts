import { describe, expect, it } from 'vitest'
import { accountSiteAddress } from '../../packages/cms/server/utils/cmsAccountAddress'
import { callbackOf, clientAddress, redirectAllowed } from '../../cloud/shared/account'

// The site builds its `redirect_uri` from its public address; the issuer compares it letter by
// letter with the client's address + the callback path (docs/multi-tenant-plan.md 2.15). Both
// sides must come to the same text from the same address, however it was typed.
const CALLBACK = '/api/cms/_auth/account/callback'

describe('a site\'s address in the issuer\'s normal form', () => {
  it.each([
    ['https://Example.com:443/', 'https://example.com'],
    ['https://example.com', 'https://example.com'],
    ['HTTPS://WWW.Example.COM', 'https://www.example.com'],
    ['https://example.com///', 'https://example.com'],
    ['https://example.com:8443/', 'https://example.com:8443'],
    ['http://Foto.LOCALHOST:80/', 'http://foto.localhost'],
    ['http://localhost:4650/', 'http://localhost:4650'],
    ['  https://example.com/  ', 'https://example.com'],
    ['https://PŘÍKLAD.cz/', 'https://xn--pklad-zsa96e.cz'],
  ])('%s → %s', (typed, normal) => {
    expect(accountSiteAddress(typed)).toBe(normal)
  })

  it('keeps a path after the host, without its trailing slash', () => {
    expect(accountSiteAddress('https://Example.com/web/')).toBe('https://example.com/web')
  })

  it('leaves what is not an http(s) address as it was, and nothing as nothing', () => {
    expect(accountSiteAddress('')).toBe('')
    expect(accountSiteAddress('not an address/')).toBe('not an address')
    expect(accountSiteAddress('ftp://Example.com/')).toBe('ftp://Example.com')
  })

  it('what the site sends is what the issuer accepts, for the same address typed in any of these ways', () => {
    for (const typed of ['https://Example.com:443/', 'https://example.com', 'HTTPS://EXAMPLE.COM/', 'example.com', 'http://Foto.Localhost:4650/', 'http://localhost:80']) {
      // The issuer keeps the address as its "Connect a website" form normalises it …
      const kept = clientAddress(typed)
      expect(kept, typed).toBeTruthy()
      // … and the site is given the same address as its public one (a bare host is not a public address: https is assumed by the form only).
      const site = accountSiteAddress(typed.includes('://') ? typed : kept!)
      expect(site, typed).toBe(kept)
      expect(redirectAllowed(kept, site + CALLBACK), typed).toBe(true)
      expect(site + CALLBACK).toBe(callbackOf(kept!))
    }
  })

  it('the issuer still refuses the address as it was typed: the normal form is the site\'s to send', () => {
    const kept = clientAddress('https://Example.com:443/')!
    expect(redirectAllowed(kept, 'https://Example.com:443' + CALLBACK)).toBe(false)
    expect(redirectAllowed(kept, 'https://example.com:443' + CALLBACK)).toBe(false)
  })
})
