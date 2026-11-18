import { describe, expect, it } from 'vitest'
import { CmsRemoteLogoError, cmsCheckedLookup, fetchRemoteLogo, isPublicIp, type CmsRemoteTransport } from '../../packages/cms/server/utils/cmsRemoteLogo'

// An https:// logo is downloaded by the server (the email logo, the icons). The address
// comes from the site's settings, which a hosted tinyzoo would let people edit, so the
// download must never reach inside the server's network: https only at every step, at most
// two redirects, and only hosts whose every address is public, checked in the lookup the
// connection itself uses (no second DNS answer can slip in).

const PNG = Buffer.from('89504e470d0a1a0a', 'hex')
const publicDns = async () => [{ address: '93.184.215.14', family: 4 }]
const opts = { timeoutMs: 2000, maxBytes: 1024 }

/** A fake server: answers by URL, and "connects" through the lookup it is given, as the real one does. */
function fakeServer(answers: Record<string, { status: number; location?: string; body?: Buffer; length?: number }>): CmsRemoteTransport & { asked: string[] } {
  const asked: string[] = []
  const transport = (async (url, { lookup }) => {
    asked.push(url.href)
    await new Promise<void>((resolve, reject) => lookup(url.hostname, { all: true }, (err: Error | null) => (err ? reject(err) : resolve())))
    const a = answers[url.href]
    if (!a) return { status: 404, length: 0, read: async () => Buffer.alloc(0), discard: () => {} }
    const body = a.body ?? Buffer.alloc(0)
    return {
      status: a.status,
      location: a.location,
      length: a.length ?? body.byteLength,
      read: async (max: number) => {
        if (body.byteLength > max) throw new CmsRemoteLogoError(`the file is larger than ${max} bytes`)
        return body
      },
      discard: () => {},
    }
  }) as CmsRemoteTransport & { asked: string[] }
  transport.asked = asked
  return transport
}

describe('isPublicIp', () => {
  it('lets public addresses through', () => {
    for (const ip of ['8.8.8.8', '1.1.1.1', '93.184.215.14', '172.32.0.1', '100.128.0.1', '2606:4700::1111', '2a00:1450:4001::200e', '::ffff:8.8.8.8', '64:ff9b::808:808', '2002:808:808::'])
      expect(isPublicIp(ip), ip).toBe(true)
  })

  it('refuses loopback, private, link-local and metadata, CGNAT, unique-local, multicast and reserved addresses', () => {
    for (const ip of [
      '127.0.0.1', '127.255.255.254', '0.0.0.0', '10.0.0.1', '172.16.0.1', '172.31.255.255', '192.168.1.1',
      '169.254.169.254', '169.254.0.1', '100.64.0.1', '100.100.100.200', '100.127.255.255',
      '192.0.0.192', '198.18.0.1', '224.0.0.1', '240.0.0.1', '255.255.255.255',
      '::1', '::', '[::1]', '::ffff:127.0.0.1', '::ffff:7f00:1', '::ffff:169.254.169.254', '::127.0.0.1',
      'fd00:ec2::254', 'fc00::1', 'fe80::1', 'fe80::1%en0', 'fec0::1', 'ff02::1', '2001:db8::1', '2001::1',
      '64:ff9b::a00:1', '64:ff9b:1::1', '2002:7f00:1::', '100::1',
      'localhost', 'example.com', '', '1.2.3', '::ffff:999.1.1.1', '1::2::3',
    ]) expect(isPublicIp(ip), ip).toBe(false)
  })
})

describe('the checked lookup', () => {
  const ask = (resolve: Parameters<typeof cmsCheckedLookup>[0], options: object = {}) => new Promise<{ err: Error | null; result: unknown[] }>((done) =>
    cmsCheckedLookup(resolve)('logo.example', options, (err: Error | null, ...result: unknown[]) => done({ err, result })))

  it('gives the connection the addresses it checked', async () => {
    expect(await ask(publicDns)).toEqual({ err: null, result: ['93.184.215.14', 4] })
    expect(await ask(publicDns, { all: true })).toEqual({ err: null, result: [[{ address: '93.184.215.14', family: 4 }]] })
  })

  it('refuses a name with any address that is not public, even next to a public one', async () => {
    const { err } = await ask(async () => [{ address: '93.184.215.14', family: 4 }, { address: '10.0.0.5', family: 4 }])
    expect(err).toBeInstanceOf(CmsRemoteLogoError)
    expect(err!.message).toBe('logo.example resolves to 10.0.0.5, which is not a public address')
    expect((await ask(async () => [{ address: '::1', family: 6 }])).err?.message).toMatch(/::1, which is not a public address/)
  })

  it('refuses a name without an address of the family asked for', async () => {
    expect((await ask(publicDns, { family: 6 })).err?.message).toBe('logo.example has no address')
  })
})

describe('fetchRemoteLogo', () => {
  it('downloads a logo from a public https host', async () => {
    const server = fakeServer({ 'https://cdn.example/logo.png': { status: 200, body: PNG } })
    expect(await fetchRemoteLogo('https://cdn.example/logo.png', { ...opts, resolve: publicDns, transport: server })).toEqual(PNG)
  })

  it('refuses anything but https://, and user names in the address', async () => {
    for (const address of ['http://cdn.example/logo.png', 'ftp://cdn.example/logo.png', 'file:///etc/passwd', 'https://user:pw@cdn.example/logo.png', 'not a url'])
      await expect(fetchRemoteLogo(address, { ...opts, resolve: publicDns, transport: fakeServer({}) }), address).rejects.toThrow(CmsRemoteLogoError)
  })

  it('refuses an IP address that is not public before connecting', async () => {
    for (const address of ['https://127.0.0.1/logo.png', 'https://169.254.169.254/latest/meta-data', 'https://[::1]/logo.png', 'https://[fd00:ec2::254]/', 'https://10.0.0.1:8443/x.png', 'https://0x7f000001/logo.png']) {
      const server = fakeServer({})
      await expect(fetchRemoteLogo(address, { ...opts, resolve: publicDns, transport: server }), address).rejects.toThrow(/not a public address/)
      expect(server.asked, address).toEqual([])
    }
  })

  it('refuses a host that resolves inside, through the real https client (it never connects)', async () => {
    // No transport given: Node's https client with the checked lookup. The name resolves to loopback.
    await expect(fetchRemoteLogo('https://logo.example/logo.png', { ...opts, resolve: async () => [{ address: '127.0.0.1', family: 4 }] }))
      .rejects.toThrow('logo.example resolves to 127.0.0.1, which is not a public address')
    // And with the system's DNS: localhost.
    await expect(fetchRemoteLogo('https://localhost/logo.png', opts)).rejects.toThrow(/localhost resolves to .*not a public address/)
  })

  it('follows at most two redirects, each https and to a public host', async () => {
    const two = fakeServer({
      'https://a.example/logo.png': { status: 301, location: 'https://b.example/logo.png' },
      'https://b.example/logo.png': { status: 302, location: '/final.png' },
      'https://b.example/final.png': { status: 200, body: PNG },
    })
    expect(await fetchRemoteLogo('https://a.example/logo.png', { ...opts, resolve: publicDns, transport: two })).toEqual(PNG)
    expect(two.asked).toEqual(['https://a.example/logo.png', 'https://b.example/logo.png', 'https://b.example/final.png'])

    const three = fakeServer({
      'https://a.example/1': { status: 307, location: 'https://a.example/2' },
      'https://a.example/2': { status: 308, location: 'https://a.example/3' },
      'https://a.example/3': { status: 302, location: 'https://a.example/4' },
      'https://a.example/4': { status: 200, body: PNG },
    })
    await expect(fetchRemoteLogo('https://a.example/1', { ...opts, resolve: publicDns, transport: three })).rejects.toThrow('it redirects more than 2 times')
    expect(three.asked).not.toContain('https://a.example/4')
  })

  it('refuses a redirect to http://, to an inside address, or to a name that resolves inside', async () => {
    const toHttp = fakeServer({ 'https://a.example/l.png': { status: 302, location: 'http://a.example/l.png' } })
    await expect(fetchRemoteLogo('https://a.example/l.png', { ...opts, resolve: publicDns, transport: toHttp })).rejects.toThrow('http:// is not allowed, only https://')

    const toMetadata = fakeServer({ 'https://a.example/l.png': { status: 302, location: 'https://169.254.169.254/latest/meta-data/' } })
    await expect(fetchRemoteLogo('https://a.example/l.png', { ...opts, resolve: publicDns, transport: toMetadata })).rejects.toThrow('169.254.169.254 is not a public address')
    expect(toMetadata.asked).toEqual(['https://a.example/l.png'])

    // DNS rebinding: the name was public for the first connection and is inside for the next.
    let answers = 0
    const rebinding = async () => (answers++ === 0 ? [{ address: '93.184.215.14', family: 4 }] : [{ address: '192.168.0.10', family: 4 }])
    const again = fakeServer({ 'https://a.example/l.png': { status: 302, location: 'https://a.example/m.png' }, 'https://a.example/m.png': { status: 200, body: PNG } })
    await expect(fetchRemoteLogo('https://a.example/l.png', { ...opts, resolve: rebinding, transport: again })).rejects.toThrow('a.example resolves to 192.168.0.10, which is not a public address')
  })

  it('stops at the size cap and says what the server answered', async () => {
    const big = fakeServer({ 'https://a.example/big.png': { status: 200, body: Buffer.alloc(2048) }, 'https://a.example/said.png': { status: 200, body: PNG, length: 4096 } })
    await expect(fetchRemoteLogo('https://a.example/big.png', { ...opts, resolve: publicDns, transport: big })).rejects.toThrow('the file is larger than 1024 bytes')
    await expect(fetchRemoteLogo('https://a.example/said.png', { ...opts, resolve: publicDns, transport: big })).rejects.toThrow('the file is larger than 1024 bytes')
    await expect(fetchRemoteLogo('https://a.example/none.png', { ...opts, resolve: publicDns, transport: big })).rejects.toThrow('the server answered 404')
  })

  it('gives up after the time limit, for all the steps together', async () => {
    const slow: CmsRemoteTransport = (_url, { signal }) => new Promise((_resolve, reject) => signal.addEventListener('abort', () => reject(signal.reason)))
    await expect(fetchRemoteLogo('https://a.example/l.png', { timeoutMs: 50, maxBytes: 1024, resolve: publicDns, transport: slow })).rejects.toThrow()
  })
})
