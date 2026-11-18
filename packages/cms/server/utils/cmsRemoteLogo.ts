import { lookup as dnsLookup } from 'node:dns/promises'
import { request } from 'node:https'
import { isIP } from 'node:net'

// Downloads an `https://` logo (cmsBrandSource.ts) without letting the address reach inside
// the server's own network. Today only app.config sets the logo, but the theme seam is meant
// to read stored per-site settings one day, and then whoever edits those settings chooses
// the address the server fetches.
//
//  - Only https://, at every step. Redirects are followed by hand, at most two, each checked
//    again like the first address.
//  - The host is resolved here and every address it resolves to must be public: no loopback,
//    private, link-local (cloud metadata), CGNAT, unique-local IPv6, multicast or reserved
//    range. The connection then goes to an address that was checked (the check is the
//    connection's own DNS lookup), so a name that resolves differently the second time
//    (DNS rebinding) cannot slip in.
//  - A time limit for the whole download and a size cap, counted while reading.
//
// Plain Node, no Nitro globals: the unit tests import it directly.

/** Why a logo could not be downloaded, in words for the server log. */
export class CmsRemoteLogoError extends Error {}

/** IPv4 ranges that are not the public internet: [first octets as a number, prefix length]. */
const BLOCKED_V4: Array<[string, number]> = [
  ['0.0.0.0', 8], // "this network"
  ['10.0.0.0', 8], // private
  ['100.64.0.0', 10], // carrier-grade NAT (Alibaba's metadata service is 100.100.100.200)
  ['127.0.0.0', 8], // loopback
  ['169.254.0.0', 16], // link-local: the cloud metadata services (169.254.169.254)
  ['172.16.0.0', 12], // private
  ['192.0.0.0', 24], // IETF protocol assignments
  ['192.0.2.0', 24], // documentation
  ['192.88.99.0', 24], // 6to4 relay
  ['192.168.0.0', 16], // private
  ['198.18.0.0', 15], // benchmarking
  ['198.51.100.0', 24], // documentation
  ['203.0.113.0', 24], // documentation
  ['224.0.0.0', 4], // multicast
  ['240.0.0.0', 4], // reserved, and the broadcast address
]

function v4Number(ip: string): number {
  return ip.split('.').reduce((n, part) => n * 256 + Number(part), 0)
}

function v4Blocked(ip: string): boolean {
  const n = v4Number(ip)
  return BLOCKED_V4.some(([base, bits]) => Math.floor(n / 2 ** (32 - bits)) === Math.floor(v4Number(base) / 2 ** (32 - bits)))
}

/** An IPv6 address as 16 bytes (an IPv4 address written at its end, `::ffff:127.0.0.1`, counts as its two groups). */
function v6Bytes(ip: string): number[] | null {
  let text = ip.split('%')[0]!.toLowerCase()
  const v4 = /(?:^|:)(\d+\.\d+\.\d+\.\d+)$/.exec(text)
  if (v4) {
    if (isIP(v4[1]!) !== 4) return null
    const [a, b, c, d] = v4[1]!.split('.').map(Number) as [number, number, number, number]
    text = text.slice(0, -v4[1]!.length) + `${((a << 8) | b).toString(16)}:${((c << 8) | d).toString(16)}`
  }
  const halves = text.split('::')
  if (halves.length > 2) return null
  const groups = (s: string) => (s ? s.split(':') : [])
  const head = groups(halves[0]!)
  const rest = halves.length === 2 ? groups(halves[1]!) : []
  const missing = 8 - head.length - rest.length
  if (missing < 0 || (halves.length === 1 && missing !== 0)) return null
  const bytes: number[] = []
  for (const g of [...head, ...Array<string>(missing).fill('0'), ...rest]) {
    if (!/^[0-9a-f]{1,4}$/.test(g)) return null
    const n = Number.parseInt(g, 16)
    bytes.push(n >> 8, n & 0xFF)
  }
  return bytes
}

const startsWith = (bytes: number[], prefix: number[]) => prefix.every((b, i) => bytes[i] === b)
const v4At = (bytes: number[], at: number) => bytes.slice(at, at + 4).join('.')

function v6Blocked(ip: string): boolean {
  const b = v6Bytes(ip)
  if (!b) return true
  // ::/96 (unspecified, loopback, IPv4-compatible) and ::ffff:0:0/96 (IPv4-mapped): the IPv4 address decides.
  if (b.slice(0, 10).every((x) => x === 0) && ((b[10] === 0 && b[11] === 0) || (b[10] === 0xFF && b[11] === 0xFF))) return v4Blocked(v4At(b, 12))
  if (startsWith(b, [0x00, 0x64, 0xFF, 0x9B]) && b.slice(4, 12).every((x) => x === 0)) return v4Blocked(v4At(b, 12)) // NAT64 64:ff9b::/96
  if (startsWith(b, [0x00, 0x64, 0xFF, 0x9B, 0x00, 0x01])) return true // local-use NAT64 64:ff9b:1::/48
  if (startsWith(b, [0x20, 0x02])) return v4Blocked(v4At(b, 2)) // 6to4 2002::/16 carries an IPv4 address
  if (startsWith(b, [0x20, 0x01, 0x00, 0x00])) return true // Teredo 2001::/32 (hides an IPv4 address)
  if (startsWith(b, [0x20, 0x01, 0x0D, 0xB8])) return true // documentation 2001:db8::/32
  if (startsWith(b, [0x01, 0x00, 0, 0, 0, 0, 0, 0])) return true // discard 100::/64
  if ((b[0]! & 0xFE) === 0xFC) return true // unique local fc00::/7 (AWS metadata fd00:ec2::254)
  if (b[0] === 0xFE && (b[1]! & 0xC0) === 0x80) return true // link-local fe80::/10
  if (b[0] === 0xFE && (b[1]! & 0xC0) === 0xC0) return true // site-local fec0::/10 (deprecated)
  if (b[0] === 0xFF) return true // multicast
  return false
}

/** Whether an IP address is on the public internet (a logo may be downloaded from it). Anything that is not an IP address is not. */
export function isPublicIp(ip: string): boolean {
  const bare = ip.replace(/^\[|\]$/g, '')
  const kind = isIP(bare.split('%')[0]!)
  if (kind === 4) return !v4Blocked(bare)
  if (kind === 6) return !v6Blocked(bare)
  return false
}

export interface CmsResolvedAddress { address: string; family: number }
export type CmsResolve = (hostname: string) => Promise<CmsResolvedAddress[]>

const systemResolve: CmsResolve = (hostname) => dnsLookup(hostname, { all: true, verbatim: true })

/**
 * A `lookup` for `https.request` that resolves the name and gives the connection only
 * addresses that were checked: any address of the name that is not public refuses the
 * name as a whole (a host that is half inside is not a logo host).
 */
export function cmsCheckedLookup(resolve: CmsResolve = systemResolve) {
  return (hostname: string, options: { all?: boolean; family?: number | string } | number | undefined, callback: (...args: any[]) => void) => {
    const opts = typeof options === 'object' && options ? options : {}
    resolve(hostname).then((found) => {
      const family = opts.family === 'IPv4' || opts.family === 4 ? 4 : opts.family === 'IPv6' || opts.family === 6 ? 6 : 0
      const blocked = found.find((a) => !isPublicIp(a.address))
      if (blocked) return callback(new CmsRemoteLogoError(`${hostname} resolves to ${blocked.address}, which is not a public address`))
      const usable = family ? found.filter((a) => a.family === family) : found
      if (!usable.length) return callback(new CmsRemoteLogoError(`${hostname} has no address`))
      if (opts.all) return callback(null, usable)
      callback(null, usable[0]!.address, usable[0]!.family)
    }, (err) => callback(err))
  }
}

/** One answer of the server, before its body is read. */
export interface CmsRemoteResponse {
  status: number
  location?: string
  length: number
  /** The body, up to `maxBytes` (throws beyond it). */
  read: (maxBytes: number) => Promise<Buffer>
  /** Drops the body (a redirect's). */
  discard: () => void
}

export type CmsRemoteTransport = (url: URL, opts: { lookup: ReturnType<typeof cmsCheckedLookup>; signal: AbortSignal }) => Promise<CmsRemoteResponse>

async function readCapped(stream: AsyncIterable<Uint8Array> & { destroy?: () => void }, maxBytes: number): Promise<Buffer> {
  const chunks: Uint8Array[] = []
  let size = 0
  for await (const chunk of stream) {
    size += chunk.byteLength
    if (size > maxBytes) {
      stream.destroy?.()
      throw new CmsRemoteLogoError(`the file is larger than ${maxBytes} bytes`)
    }
    chunks.push(chunk)
  }
  return Buffer.concat(chunks)
}

/** The real transport: Node's https client, connecting only through the checked lookup. */
const httpsTransport: CmsRemoteTransport = (url, { lookup, signal }) => new Promise((resolve, reject) => {
  const req = request(url, { method: 'GET', lookup: lookup as any, signal, headers: { 'accept': 'image/*', 'user-agent': 'tinyzoo' } }, (res) => {
    resolve({
      status: res.statusCode ?? 0,
      location: typeof res.headers.location === 'string' ? res.headers.location : undefined,
      length: Number(res.headers['content-length'] || 0),
      read: (maxBytes) => readCapped(res, maxBytes),
      discard: () => res.destroy(),
    })
  })
  req.on('error', reject)
  req.end()
})

/** Refuses an address the server must not fetch: not https, with a user name, or an IP address that is not public. */
function checkUrl(url: URL) {
  if (url.protocol !== 'https:') throw new CmsRemoteLogoError(`${url.protocol}// is not allowed, only https://`)
  if (url.username || url.password) throw new CmsRemoteLogoError('the address carries a user name or password')
  const host = url.hostname.replace(/^\[|\]$/g, '')
  if (!host) throw new CmsRemoteLogoError('the address has no host')
  // An IP address is connected to without a lookup, so it is checked here.
  if (isIP(host) && !isPublicIp(host)) throw new CmsRemoteLogoError(`${host} is not a public address`)
}

const REDIRECTS = new Set([301, 302, 303, 307, 308])

/**
 * Downloads an `https://` logo: at most `maxRedirects` redirects (each https and public
 * again), `timeoutMs` for all of it, at most `maxBytes`. Throws `CmsRemoteLogoError` (or a
 * network error) with a reason for the log.
 */
export async function fetchRemoteLogo(address: string, opts: { timeoutMs: number; maxBytes: number; maxRedirects?: number; resolve?: CmsResolve; transport?: CmsRemoteTransport }): Promise<Buffer> {
  const maxRedirects = opts.maxRedirects ?? 2
  const lookup = cmsCheckedLookup(opts.resolve)
  const transport = opts.transport ?? httpsTransport
  const signal = AbortSignal.timeout(opts.timeoutMs)
  let url: URL
  try {
    url = new URL(address)
  }
  catch {
    throw new CmsRemoteLogoError('it is not a valid address')
  }
  for (let hop = 0; ; hop++) {
    checkUrl(url)
    const res = await transport(url, { lookup, signal })
    if (REDIRECTS.has(res.status)) {
      res.discard()
      if (hop >= maxRedirects) throw new CmsRemoteLogoError(`it redirects more than ${maxRedirects} times`)
      if (!res.location) throw new CmsRemoteLogoError(`the server answered ${res.status} without a new address`)
      try {
        url = new URL(res.location, url)
      }
      catch {
        throw new CmsRemoteLogoError('it redirects to an address that is not valid')
      }
      continue
    }
    if (res.status !== 200) {
      res.discard()
      throw new CmsRemoteLogoError(`the server answered ${res.status}`)
    }
    if (res.length > opts.maxBytes) {
      res.discard()
      throw new CmsRemoteLogoError(`the file is larger than ${opts.maxBytes} bytes`)
    }
    return res.read(opts.maxBytes)
  }
}
