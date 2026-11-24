import { describe, expect, it } from 'vitest'
import { canonicalIp, domainPointsAtTarget, isIpAddress, MAX_DOMAINS_PER_SITE, movedAddress, normalizeDomain, parseDomainTarget } from '../../cloud/shared/domains'

// A domain of a customer's own: what may be typed, and when its DNS leads to the service.

const host = (input: unknown, rules = {}) => { const r = normalizeDomain(input, rules); return r.ok ? r.host : `!${r.problem}` }

describe('a domain somebody typed', () => {
  it('is kept lower-cased, without spaces around it and without a dot at its end', () => {
    expect(host('  WWW.Kavarna.CZ  ')).toBe('www.kavarna.cz')
    expect(host('kavarna.cz.')).toBe('kavarna.cz')
    expect(host('a-b.c-d.example.co.uk')).toBe('a-b.c-d.example.co.uk')
  })

  it('keeps punycode as it was typed, and turns a name in another script into it', () => {
    expect(host('xn--kavrna-rta.cz')).toBe('xn--kavrna-rta.cz')
    expect(host('XN--Kavrna-rta.cz')).toBe('xn--kavrna-rta.cz')
    expect(host('kavárna.cz')).toBe('xn--kavrna-rta.cz')
  })

  it('must be a name, not an address: no scheme, path, port, user, question or space', () => {
    for (const bad of ['http://kavarna.cz', 'https://kavarna.cz/', 'kavarna.cz/kontakt', 'kavarna.cz:8080', 'jana@kavarna.cz', 'kavarna.cz?x=1', 'kavarna.cz#top', 'kava rna.cz', '[::1]', 'kavarna\\cz']) expect(host(bad), bad).toBe('!shape')
  })

  it('must look public: two labels or more, well-formed, not an IP address', () => {
    for (const bad of ['kavarna', 'kavarna.', '.cz', 'kavarna..cz', '-kavarna.cz', 'kavarna-.cz', 'kava_rna.cz', '192.168.1.20', '10.0.0.1', `${'a'.repeat(64)}.cz`, '*.kavarna.cz']) expect(host(bad), bad).toBe('!shape')
    expect(host('')).toBe('!empty')
    expect(host(null)).toBe('!empty')
    expect(host(`${'a.'.repeat(130)}cz`)).toBe('!long')
  })

  it('must not be a name that never leads anywhere public', () => {
    for (const bad of ['kavarna.local', 'server.internal', 'kavarna.test', 'kavarna.invalid', 'kavarna.example', 'router.lan', 'x.onion']) expect(host(bad), bad).toBe('!reserved')
    expect(host('kavarna.example.com')).toBe('kavarna.example.com')
  })

  it('may be a *.localhost name only where that is allowed (outside production), and never a site\'s own address at the service', () => {
    expect(host('www.kavarna.localhost')).toBe('!local')
    expect(host('www.kavarna.localhost', { allowLocalhost: true })).toBe('www.kavarna.localhost')
    expect(host('kavarna.localhost', { allowLocalhost: true })).toBe('!service')
    expect(host('localhost', { allowLocalhost: true })).toBe('!shape')
  })

  it('must not be the service\'s own host or anything under it', () => {
    const rules = { serviceHosts: ['tinyzoo.site', 'Sites.Tinyzoo.net.', 'localhost'] }
    expect(host('tinyzoo.site', rules)).toBe('!service')
    expect(host('kavarna.tinyzoo.site', rules)).toBe('!service')
    expect(host('www.sites.tinyzoo.net', rules)).toBe('!service')
    expect(host('nottinyzoo.site', rules)).toBe('nottinyzoo.site')
    expect(host('kavarna.cz', rules)).toBe('kavarna.cz')
  })

  it('is limited to a few per website', () => {
    expect(MAX_DOMAINS_PER_SITE).toBeGreaterThan(1)
    expect(MAX_DOMAINS_PER_SITE).toBeLessThanOrEqual(10)
  })
})

describe('where a domain must lead (NUXT_HOSTING_DOMAIN_TARGET)', () => {
  it('is a host name and/or IP addresses, separated by commas or spaces', () => {
    expect(parseDomainTarget('sites.tinyzoo.net')).toEqual({ cname: 'sites.tinyzoo.net', ips: [] })
    expect(parseDomainTarget('203.0.113.7, 2001:db8::7')).toEqual({ cname: null, ips: ['203.0.113.7', '2001:db8::7'] })
    expect(parseDomainTarget(' Sites.Tinyzoo.net. 203.0.113.7,203.0.113.7 ')).toEqual({ cname: 'sites.tinyzoo.net', ips: ['203.0.113.7'] })
    expect(parseDomainTarget('')).toEqual({ cname: null, ips: [] })
    expect(parseDomainTarget(undefined)).toEqual({ cname: null, ips: [] })
  })

  it('tells an IP address from a name', () => {
    for (const ip of ['127.0.0.1', '203.0.113.7', '::1', '2001:db8::7', '::ffff:10.0.0.1']) expect(isIpAddress(ip), ip).toBe(true)
    for (const name of ['sites.tinyzoo.net', '256.1.1.1', '1.2.3', 'localhost']) expect(isIpAddress(name), name).toBe(false)
  })

  it('compares two spellings of one IPv6 address as equal', () => {
    expect(canonicalIp('2001:DB8::7')).toBe(canonicalIp('2001:0db8:0000:0000:0000:0000:0000:0007'))
    expect(canonicalIp('::1')).toBe('0:0:0:0:0:0:0:1')
    expect(canonicalIp('203.0.113.7')).toBe('203.0.113.7')
  })
})

describe('does the DNS lead to the service?', () => {
  const target = { cname: 'sites.tinyzoo.net', ips: ['203.0.113.7', '2001:db8::7'] }

  it('yes when the name\'s CNAME chain names the target', () => {
    expect(domainPointsAtTarget({ cnames: ['Sites.Tinyzoo.net.'], ips: [] }, target)).toEqual({ ok: true })
    expect(domainPointsAtTarget({ cnames: ['cdn.example.com', 'sites.tinyzoo.net'], ips: ['198.51.100.1'] }, target)).toEqual({ ok: true })
  })

  it('yes when every address of the name is an address of the target', () => {
    expect(domainPointsAtTarget({ cnames: [], ips: ['203.0.113.7'] }, target)).toEqual({ ok: true })
    expect(domainPointsAtTarget({ cnames: [], ips: ['203.0.113.7', '2001:0db8::0007'] }, target)).toEqual({ ok: true })
  })

  it('no when the name does not resolve', () => {
    expect(domainPointsAtTarget({ cnames: [], ips: [] }, target)).toEqual({ ok: false, reason: 'unresolved' })
  })

  it('no when it leads elsewhere, also when only one of its addresses does', () => {
    expect(domainPointsAtTarget({ cnames: [], ips: ['198.51.100.1'] }, target)).toEqual({ ok: false, reason: 'elsewhere' })
    expect(domainPointsAtTarget({ cnames: ['other.example.com'], ips: ['203.0.113.7', '198.51.100.1'] }, target)).toEqual({ ok: false, reason: 'elsewhere' })
  })

  it('no when the service has no target to compare with', () => {
    expect(domainPointsAtTarget({ cnames: ['sites.tinyzoo.net'], ips: ['203.0.113.7'] }, { cname: null, ips: [] })).toEqual({ ok: false, reason: 'no_target' })
  })
})

describe('where a moved website lives now', () => {
  it('is an http(s) address, kept as its origin', () => {
    expect(movedAddress('https://www.kavarna.cz')).toBe('https://www.kavarna.cz')
    expect(movedAddress(' https://www.kavarna.cz/kontakt?x=1 ')).toBe('https://www.kavarna.cz')
    expect(movedAddress('www.kavarna.cz')).toBe('https://www.kavarna.cz')
    expect(movedAddress('http://novy.localhost:4400/')).toBe('http://novy.localhost:4400')
  })

  it('is refused when it is not one', () => {
    for (const bad of ['', '   ', 'not an address', 'ftp://kavarna.cz', 'javascript:alert(1)', 'https://user:pw@kavarna.cz', 'https://localhost', `https://${'a'.repeat(300)}.cz`, null, 42]) expect(movedAddress(bad), String(bad)).toBeNull()
  })
})
