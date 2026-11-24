// A domain of a customer's own for a website: what may be typed, and what the DNS must say.
// Pure functions: the server checks with them, the page shows their words.

/** How many domains one website may have. */
export const MAX_DOMAINS_PER_SITE = 5

/** Why a name cannot be a website's domain (the dictionary's `domain.<problem>`). */
export type DomainProblem = 'empty' | 'shape' | 'long' | 'local' | 'service' | 'reserved'

// Names that never lead anywhere on the public internet (RFC 2606, RFC 6761, RFC 6762 and what home routers use).
const RESERVED_TLDS = new Set(['localhost', 'local', 'localdomain', 'internal', 'intranet', 'lan', 'home', 'corp', 'test', 'invalid', 'example', 'onion', 'arpa'])
const LABEL = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/

export interface DomainRules {
  /** `*.localhost` names may be used (outside production, to try the flow on one machine). */
  allowLocalhost?: boolean
  /** Hosts that are the service's own and never a customer's: `localhost` (the sites' own addresses are `<slug>.localhost`), the cloud's host, the DNS target. */
  serviceHosts?: string[]
}

/**
 * The host name somebody typed, as it is kept: lower case, no dot at the end, a name in
 * another script as its punycode (`xn--…`, which is also kept as it was typed). Refused: an
 * address (a scheme, a path, a port, a user), an IP address, a name with one label, a name
 * that is not public (`.local`, `.test`, …), and a name of the service's own.
 */
export function normalizeDomain(input: unknown, rules: DomainRules = {}): { ok: true; host: string } | { ok: false; problem: DomainProblem } {
  const bad = (problem: DomainProblem) => ({ ok: false as const, problem })
  let text = String(input ?? '').trim().toLowerCase()
  if (!text) return bad('empty')
  if (/[\s/:@?#\\[\]]/.test(text)) return bad('shape')
  text = text.replace(/\.$/, '')
  // A name in another script: the same conversion a browser's address bar does. Plain ASCII passes through.
  if (/[^\x20-\x7e]/.test(text)) {
    try { text = new URL(`http://${text}`).hostname }
    catch { return bad('shape') }
  }
  if (text.length > 253) return bad('long')
  const labels = text.split('.')
  if (labels.length < 2 || labels.some((label) => !LABEL.test(label))) return bad('shape')
  const tld = labels.at(-1)!
  // An IP address, or a last label that no public name ends with.
  if (/^\d+$/.test(tld)) return bad('shape')
  if (tld === 'localhost') {
    // <slug>.localhost is a site's own address at the service; a deeper name is free for trying things out.
    if (!rules.allowLocalhost) return bad('local')
    if (labels.length < 3) return bad('service')
    return { ok: true, host: text }
  }
  if (RESERVED_TLDS.has(tld)) return bad('reserved')
  for (const own of rules.serviceHosts ?? []) {
    const host = own.trim().toLowerCase().replace(/\.$/, '')
    if (host && host !== 'localhost' && (text === host || text.endsWith(`.${host}`))) return bad('service')
  }
  return { ok: true, host: text }
}

/** Where a customer's domain must lead: a host name to point a CNAME at, and/or IP addresses for A and AAAA records. */
export interface DomainTarget { cname: string | null; ips: string[] }

const IPV4 = /^(25[0-5]|2[0-4]\d|1?\d?\d)(\.(25[0-5]|2[0-4]\d|1?\d?\d)){3}$/
export const isIpAddress = (text: string): boolean => IPV4.test(text) || (text.includes(':') && /^[0-9a-f:.]+$/i.test(text))

/** NUXT_HOSTING_DOMAIN_TARGET: a host name and/or IP addresses, separated by commas or spaces. */
export function parseDomainTarget(value: unknown): DomainTarget {
  const parts = String(value ?? '').split(/[\s,]+/).map((p) => p.trim().toLowerCase().replace(/\.$/, '')).filter(Boolean)
  const ips = parts.filter(isIpAddress)
  const cname = parts.find((p) => !isIpAddress(p) && p.split('.').every((label) => LABEL.test(label))) ?? null
  return { cname, ips: [...new Set(ips)] }
}

/** An IPv6 address written out in full, so two spellings of one address compare equal. Other texts come back lower-cased. */
export function canonicalIp(ip: string): string {
  const text = ip.trim().toLowerCase()
  if (!text.includes(':')) return text
  const [head = '', tail] = text.split('::') as [string, string | undefined]
  const left = head ? head.split(':') : []
  const right = tail ? tail.split(':') : []
  const groups = tail === undefined ? left : [...left, ...Array(Math.max(0, 8 - left.length - right.length)).fill('0'), ...right]
  return groups.map((g) => g.replace(/^0+(?=.)/, '')).join(':')
}

/** What the DNS said about a name: the names its CNAME chain passes through, and the addresses it ends at. */
export interface DnsAnswers { cnames: string[]; ips: string[] }

/** Why a domain is still waiting (the dictionary's `domain.wait.<reason>`). */
export type DomainWait = 'no_target' | 'unresolved' | 'elsewhere'

/**
 * Does the name lead to the service? Yes when its CNAME chain names the target's host, or
 * when it resolves to addresses and every one of them is an address of the target. One stray
 * address is a no: part of the visitors would arrive somewhere else.
 */
export function domainPointsAtTarget(answers: DnsAnswers, target: { cname: string | null; ips: string[] }): { ok: true } | { ok: false; reason: DomainWait } {
  if (!target.cname && !target.ips.length) return { ok: false, reason: 'no_target' }
  const names = answers.cnames.map((n) => n.toLowerCase().replace(/\.$/, ''))
  if (target.cname && names.includes(target.cname)) return { ok: true }
  if (!answers.ips.length) return { ok: false, reason: 'unresolved' }
  const allowed = new Set(target.ips.map(canonicalIp))
  return answers.ips.every((ip) => allowed.has(canonicalIp(ip))) ? { ok: true } : { ok: false, reason: 'elsewhere' }
}

/** A domain as its owner's browser gets it. */
export interface DomainView {
  id: string
  host: string
  /** The name leads to the service: it is in use. */
  verified: boolean
  /** The website's address is this domain. */
  main: boolean
  /** While waiting: why the last check said no. */
  wait: DomainWait | null
  checkedAt: string | null
  createdAt: string
}

/** The domains of one website, with what a waiting one must be given in its DNS. */
export interface DomainsView {
  domains: DomainView[]
  max: number
  /** What to set in the DNS: a CNAME to this name, or A/AAAA records with these addresses. Both empty: the service has no target configured. */
  target: DomainTarget
  /** The website's address at the service (always works, whatever the domains say). */
  serviceUrl: string | null
}

/** Where a moved website lives now: an http(s) address, kept as its origin. Null for anything else. */
export function movedAddress(input: unknown): string | null {
  const text = typeof input === 'string' ? input.trim() : ''
  if (!text || text.length > 300) return null
  try {
    const url = new URL(/^https?:\/\//i.test(text) ? text : `https://${text}`)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null
    if (url.username || url.password || !url.hostname.includes('.')) return null
    return url.origin
  }
  catch {
    return null
  }
}
