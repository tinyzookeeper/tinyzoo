import { createHash } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import {
  accountEnvLines, adminThroughAccount, callbackOf, CALLBACK_PATH, clientAddress, codeTtlMs, isAccountId, isLocalHost, isPkceChallenge, isPkceVerifier,
  isServerPath, memberRole, parseBasicAuth, redirectAllowed, redirectWith, returnPath,
} from '../../cloud/shared/account'

// The account service (the cloud as the issuer of sign-in for websites, docs/multi-tenant-plan.md
// 2.15): the pure checks on what a website and a browser send.

describe('a website\'s address', () => {
  it('is kept as scheme, host and port', () => {
    expect(clientAddress('https://www.studiogrand.cz')).toBe('https://www.studiogrand.cz')
    expect(clientAddress('  https://WWW.StudioGrand.cz/  ')).toBe('https://www.studiogrand.cz')
    expect(clientAddress('https://studio.example:8443')).toBe('https://studio.example:8443')
    expect(clientAddress('https://studio.example:443')).toBe('https://studio.example')
  })

  it('takes a bare host name as https, and as http on this machine', () => {
    expect(clientAddress('www.6dance.cz')).toBe('https://www.6dance.cz')
    expect(clientAddress('localhost:3000')).toBe('http://localhost:3000')
    expect(clientAddress('studio.localhost:4610')).toBe('http://studio.localhost:4610')
  })

  it('allows http only for a website on this machine', () => {
    expect(clientAddress('http://localhost:3000')).toBe('http://localhost:3000')
    expect(clientAddress('http://studio.localhost:4610/')).toBe('http://studio.localhost:4610')
    expect(clientAddress('http://127.0.0.1:3000')).toBe('http://127.0.0.1:3000')
    expect(clientAddress('http://[::1]:3000')).toBe('http://[::1]:3000')
    for (const bad of ['http://www.studiogrand.cz', 'http://localhost.evil.example', 'http://evil-localhost', 'http://127.0.0.2:3000']) expect(clientAddress(bad), bad).toBeNull()
    expect(isLocalHost('LOCALHOST')).toBe(true)
    expect(isLocalHost('notlocalhost')).toBe(false)
  })

  it('refuses anything that is more, or other, than a website\'s own address', () => {
    for (const bad of [
      '', '   ', 'web', 'https://', 'ftp://www.example.cz', 'javascript:alert(1)', 'data:text/html,x', 'file:///etc/passwd',
      'https://www.example.cz/web', 'https://www.example.cz/?a=1', 'https://www.example.cz?a=1', 'https://www.example.cz/#x', 'https://www.example.cz#x',
      'https://user:pass@www.example.cz', 'https://user@www.example.cz', 'https://www.example.cz\\@evil.example', 'https://www example.cz',
      `https://${'a'.repeat(300)}.cz`, null, undefined, 42, {},
    ]) expect(clientAddress(bad), String(bad)).toBeNull()
  })
})

describe('the address a sign-in comes back to', () => {
  const address = 'https://www.studiogrand.cz'

  it('is the website\'s address followed by the callback path', () => {
    expect(CALLBACK_PATH).toBe('/api/cms/_auth/account/callback')
    expect(callbackOf(address)).toBe('https://www.studiogrand.cz/api/cms/_auth/account/callback')
    expect(redirectAllowed(address, callbackOf(address))).toBe(true)
    expect(redirectAllowed('http://studio.localhost:4610', 'http://studio.localhost:4610/api/cms/_auth/account/callback')).toBe(true)
  })

  it('must be exactly that: nothing that only looks like it', () => {
    for (const bad of [
      `https://www.studiogrand.cz.evil.example${CALLBACK_PATH}`, `https://evil-www.studiogrand.cz${CALLBACK_PATH}`, `https://www.studiogrand.cz@evil.example${CALLBACK_PATH}`,
      `http://www.studiogrand.cz${CALLBACK_PATH}`, `https://www.studiogrand.cz:443${CALLBACK_PATH}`, `https://www.studiogrand.cz:8443${CALLBACK_PATH}`,
      `${callbackOf(address)}/`, `${callbackOf(address)}?x=1`, `${callbackOf(address)}#x`, `${address}/${CALLBACK_PATH}`, `${address}${CALLBACK_PATH.toUpperCase()}`,
      `https://WWW.STUDIOGRAND.CZ${CALLBACK_PATH}`, `https://www.studiogrand.cz.${CALLBACK_PATH}`, `${address}/api/cms/_auth/account/callback/../callback`,
      ` ${callbackOf(address)}`, address, '', undefined, null, [callbackOf(address)],
    ]) expect(redirectAllowed(address, bad), String(bad)).toBe(false)
  })

  it('a client without an address has none', () => {
    expect(redirectAllowed(null, CALLBACK_PATH)).toBe(false)
    expect(redirectAllowed('', CALLBACK_PATH)).toBe(false)
    expect(redirectAllowed(undefined, 'undefined/api/cms/_auth/account/callback')).toBe(false)
  })

  it('carries the answer as its query', () => {
    expect(redirectWith(callbackOf(address), { code: 'a b&c', state: 's=1' })).toBe(`${callbackOf(address)}?code=a+b%26c&state=s%3D1`)
    expect(redirectWith(callbackOf(address), { error: 'login_required', state: undefined })).toBe(`${callbackOf(address)}?error=login_required`)
  })

  it('the admin is entered through the website\'s own start of a sign-in', () => {
    expect(adminThroughAccount('https://www.studiogrand.cz')).toBe('https://www.studiogrand.cz/api/cms/_auth/account/start?next=/admin')
    expect(adminThroughAccount('http://studio.localhost:4610/')).toBe('http://studio.localhost:4610/api/cms/_auth/account/start?next=/admin')
  })
})

describe('where the sign-in page goes afterwards', () => {
  it('is a path of this app', () => {
    expect(returnPath('/sites')).toBe('/sites')
    expect(returnPath('/sites/123?runtime=1#top')).toBe('/sites/123?runtime=1#top')
    const authorize = '/oauth/authorize?response_type=code&client_id=7f3a2c1e-0b4d-4e6f-8a9b-0c1d2e3f4a5b&redirect_uri=https%3A%2F%2Fwww.studiogrand.cz%2Fapi%2Fcms%2F_auth%2Faccount%2Fcallback&state=x'
    expect(returnPath(authorize)).toBe(authorize)
  })

  it('is never another website (an open redirect)', () => {
    for (const bad of [
      'https://evil.example/', 'http://evil.example', '//evil.example', '///evil.example', '/\\evil.example', '\\\\evil.example', '/\t/evil.example', '/\n/evil.example',
      'javascript:alert(1)', 'data:text/html,x', 'evil.example', 'sites', '', ' /sites', `/${'a'.repeat(4001)}`, null, undefined, 42, ['/sites'],
    ]) expect(returnPath(bad), String(bad)).toBeNull()
  })

  it('knows the one path the server answers itself', () => {
    expect(isServerPath('/oauth/authorize?client_id=x')).toBe(true)
    expect(isServerPath('/oauth/authorize')).toBe(true)
    expect(isServerPath('/oauth/authorized')).toBe(false)
    expect(isServerPath('/sites')).toBe(false)
  })
})

describe('PKCE', () => {
  const verifier = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk'
  const challenge = createHash('sha256').update(verifier).digest('base64url')

  it('a challenge is the base64url of a SHA-256: 43 characters', () => {
    expect(challenge).toBe('E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM')
    expect(isPkceChallenge(challenge)).toBe(true)
    for (const bad of ['', 'short', `${challenge}=`, `${challenge}a`, challenge.slice(1), challenge.replace('-', '+'), null, undefined, 42]) expect(isPkceChallenge(bad), String(bad)).toBe(false)
  })

  it('a verifier is 43 to 128 unreserved characters', () => {
    expect(isPkceVerifier(verifier)).toBe(true)
    expect(isPkceVerifier('a'.repeat(128))).toBe(true)
    expect(isPkceVerifier('A-z0.9_~'.repeat(6))).toBe(true)
    for (const bad of ['', 'a'.repeat(42), 'a'.repeat(129), `${'a'.repeat(43)} `, `${'a'.repeat(43)}+`, null, undefined]) expect(isPkceVerifier(bad), String(bad)).toBe(false)
  })
})

describe('how long a code works', () => {
  it('is a minute', () => {
    for (const unset of ['', undefined, null, 'x', 0, -5, Number.NaN]) expect(codeTtlMs(unset), String(unset)).toBe(60_000)
  })

  it('can be set shorter (for the checks), never longer', () => {
    expect(codeTtlMs('3')).toBe(3000)
    expect(codeTtlMs(0.5)).toBe(500)
    expect(codeTtlMs('60')).toBe(60_000)
    expect(codeTtlMs('61')).toBe(60_000)
    expect(codeTtlMs(3600)).toBe(60_000)
  })
})

describe('what a website\'s server sends', () => {
  const id = '7f3a2c1e-0b4d-4e6f-8a9b-0c1d2e3f4a5b'

  it('its client id and secret, as Basic authorization', () => {
    const header = (text: string) => `Basic ${Buffer.from(text).toString('base64')}`
    expect(parseBasicAuth(header(`${id}:s3cret`))).toEqual({ id, secret: 's3cret' })
    expect(parseBasicAuth(header(`${id}:with:colons`))).toEqual({ id, secret: 'with:colons' })
    expect(parseBasicAuth(`basic ${Buffer.from(`${id}:x`).toString('base64url')}`)).toEqual({ id, secret: 'x' })
    for (const bad of [undefined, null, '', 'Basic', 'Basic !!!', `Bearer ${id}`, header(id), header(`${id}:`), header(':secret'), 42]) expect(parseBasicAuth(bad), String(bad)).toBeNull()
  })

  it('ids are lower-case uuids', () => {
    expect(isAccountId(id)).toBe(true)
    for (const bad of [id.toUpperCase(), `${id} `, id.replace(/-/g, ''), '', 'me', null, undefined, 1]) expect(isAccountId(bad), String(bad)).toBe(false)
  })

  it('a role is a short plain text, kept for showing only', () => {
    expect(memberRole('admin')).toBe('admin')
    expect(memberRole('  Hlavní redaktor ')).toBe('Hlavní redaktor')
    for (const bad of ['', '   ', 'x'.repeat(61), '<b>admin</b>', 'ad\nmin', null, undefined, 7, { role: 'admin' }]) expect(memberRole(bad), String(bad)).toBeNull()
  })
})

describe('the settings a connected website is given', () => {
  it('are three lines of its environment', () => {
    expect(accountEnvLines({ issuer: 'https://tinyzoo.example', clientId: '7f3a2c1e-0b4d-4e6f-8a9b-0c1d2e3f4a5b', clientSecret: 'abc-DEF_123' })).toBe([
      'NUXT_CMS_AUTH_ACCOUNT_ISSUER=https://tinyzoo.example',
      'NUXT_CMS_AUTH_ACCOUNT_CLIENT_ID=7f3a2c1e-0b4d-4e6f-8a9b-0c1d2e3f4a5b',
      'NUXT_CMS_AUTH_ACCOUNT_CLIENT_SECRET=abc-DEF_123',
    ].join('\n'))
  })
})
