import { AsyncResource } from 'node:async_hooks'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// The site seam (packages/cms/server/utils/cmsSite.ts) by itself: the current site, per-site
// memory, callbacks bound to their site, work in every site, the directory and its refusals.
//
// The file is the server's (Nitro auto-imports its neighbours): it is loaded by path, afresh
// for each test, because a process decides its mode once (NUXT_CMS_TENANCY_MODE) and keeps
// the directory it read. `useRuntimeConfig` is the one Nitro global it calls: stubbed.
type SiteModule = typeof import('../../packages/cms/server/utils/cmsSite')
const FILE = join(import.meta.dirname, '../../packages/cms/server/utils/cmsSite.ts')

const dir = mkdtempSync(join(tmpdir(), 'cms-site-unit-'))
const directoryFile = join(dir, 'sites.json')
afterAll(() => rmSync(dir, { recursive: true, force: true }))

const row = (id: string, over: Record<string, unknown> = {}) => ({
  id,
  hosts: [`${id}.example`, `www.${id}.example`],
  publicUrl: `https://${id}.example/`,
  databaseUrl: `postgres://u_${id}:pw@db:5432/${id}`,
  secret: `secret-of-${id}-at-least-32-characters-long`,
  ...over,
})

/** What the process's runtime config holds (what a single site reads, and what multi mode lays a site's settings over). */
const PROCESS_CMS = {
  publicUrl: 'https://process.example',
  webhooks: { urls: 'https://process.example/hook', secret: 'process-webhook-secret' },
  status: { token: 'process-status-token' },
  content: { token: 'process-content-token', publicUrl: 'https://process.example' },
  auth: { setupToken: 'process-setup-code', mode: 'builtin', trustedProxies: 1 },
  storage: { driver: 'local', local: { dir: '/process/uploads' }, s3: { region: 'eu-1', bucket: 'process-bucket', secretAccessKey: 'process-s3-secret' } },
  mail: { transport: 'smtp', from: 'Process <no-reply@process.example>', file: { dir: '/process/mail' } },
  forms: { notifyTo: 'process@process.example' },
}

let n = 0
/** The module, loaded anew in the mode asked for. */
async function load(mode: 'single' | 'multi', sites?: unknown[]): Promise<SiteModule> {
  vi.stubEnv('NUXT_CMS_TENANCY_MODE', mode === 'multi' ? 'multi' : '')
  vi.stubEnv('NUXT_CMS_TENANCY_FILE', mode === 'multi' ? directoryFile : '')
  if (sites) writeFileSync(directoryFile, JSON.stringify({ sites }))
  vi.stubGlobal('useRuntimeConfig', () => ({ cms: PROCESS_CMS }))
  return await import(/* @vite-ignore */ `${FILE}?fresh=${++n}`) as SiteModule
}
/** Two sites A and B, and a paused C. */
const three = () => [row('site-a'), row('site-b', { config: { webhooks: { urls: 'https://b.example/hook', secret: 'b-secret' }, mail: { from: 'B <hi@b.example>' } } }), row('site-c', { state: 'paused' })]

/** What was written to the error log, one line per call. */
const logged = (): string[] => errors.mock.calls.map((call: unknown[]) => call.join(' '))
let errors: ReturnType<typeof vi.spyOn>
beforeEach(() => { errors = vi.spyOn(console, 'error').mockImplementation(() => {}) })
afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
  vi.useRealTimers()
  errors.mockRestore()
})

const tick = () => new Promise((r) => setTimeout(r, 5))

describe('single mode (the default): one site, everywhere', () => {
  it('the current site is always there, with no context to set up', async () => {
    const s = await load('single')
    expect(s.cmsIsMultiTenant()).toBe(false)
    expect(s.useCmsSite().id).toBe('default')
    expect(s.currentCmsSite()).toBe(s.useCmsSite())
    expect(s.cmsAllSites()).toEqual([s.useCmsSite()])
    expect(s.cmsSiteById('default')).toBe(s.useCmsSite())
    expect(s.cmsSiteById('site-a')).toBeNull()
    // The helpers are transparent: they run the function, in the same one site.
    expect(s.runInCmsSite({ id: 'other' } as any, () => s.useCmsSite().id)).toBe('default')
    expect(s.outsideCmsSite(() => s.useCmsSite().id)).toBe('default')
    const fn = () => 'unchanged'
    expect(s.bindToCmsSite(fn)).toBe(fn)
  })

  it('a per-site value is one value, and the settings are the runtime config itself', async () => {
    const s = await load('single')
    let made = 0
    const cache = s.cmsSiteScoped(() => ({ made: ++made }))
    expect(cache()).toBe(cache())
    expect(made).toBe(1)
    cache.reset()
    expect(cache().made).toBe(2)
    cache.set({ made: 99 })
    expect(cache().made).toBe(99)
    expect(s.cmsSettings()).toBe(PROCESS_CMS)
  })

  it('work "in every site" runs once, and its failure is the caller\'s, as before', async () => {
    const s = await load('single')
    const seen: string[] = []
    expect(await s.forEachCmsSite((site) => { seen.push(site.id) })).toEqual([])
    expect(seen).toEqual(['default'])
    await expect(s.forEachCmsSite(() => { throw new Error('boom') })).rejects.toThrow('boom')
    // Start-up work runs at once (the server is starting).
    let started = 0
    s.onCmsSiteStart(() => { started++ })
    expect(started).toBe(1)
    s.ensureCmsSiteStarted()
    expect(started).toBe(1)
  })
})

describe('multi mode: the current site', () => {
  it('there is no site outside a site, and asking for one throws; there is no default', async () => {
    const s = await load('multi', three())
    expect(s.cmsIsMultiTenant()).toBe(true)
    expect(s.currentCmsSite()).toBeNull()
    expect(() => s.useCmsSite()).toThrow(s.CmsNoSiteError)
    expect(() => s.useCmsSite('the nightly task')).toThrow(/No site for the nightly task/)
    expect(() => s.cmsSettings()).toThrow(s.CmsNoSiteError)
    const err = (() => { try { s.useCmsSite() } catch (e) { return e as any } })()
    expect(err.name).toBe('CmsNoSiteError')
    expect(err.statusCode).toBe(500)
  })

  it('runInCmsSite carries the site through awaits, timers and promises left running; nesting restores the outer site', async () => {
    const s = await load('multi', three())
    const a = s.cmsSiteById('site-a')!
    const b = s.cmsSiteById('site-b')!
    const seen: string[] = []
    const later: Promise<unknown>[] = []
    await s.runInCmsSite(a, async () => {
      seen.push(s.useCmsSite().id)
      await tick()
      seen.push(s.useCmsSite().id)
      later.push(new Promise((r) => setTimeout(() => { seen.push(`timer:${s.useCmsSite().id}`); r(null) }, 10)))
      // Nested: B inside A, and A again afterwards.
      await s.runInCmsSite(b, async () => {
        await tick()
        seen.push(`nested:${s.useCmsSite().id}`)
        later.push(new Promise((r) => setTimeout(() => { seen.push(`timer:${s.useCmsSite().id}`); r(null) }, 10)))
      })
      seen.push(s.useCmsSite().id)
      // No site at all inside outsideCmsSite, and A again after it.
      s.outsideCmsSite(() => { seen.push(String(s.currentCmsSite())) })
      seen.push(s.useCmsSite().id)
    })
    expect(s.currentCmsSite()).toBeNull()
    await Promise.all(later)
    expect(seen).toEqual(['site-a', 'site-a', 'nested:site-b', 'site-a', 'null', 'site-a', 'timer:site-a', 'timer:site-b'])
  })

  it('two sites at work at the same moment never see each other\'s site', async () => {
    const s = await load('multi', three())
    const work = (id: string) => s.runInCmsSite(s.cmsSiteById(id)!, async () => {
      const seen = new Set<string>()
      for (let i = 0; i < 20; i++) { await tick(); seen.add(s.useCmsSite().id) }
      return [...seen]
    })
    const [a, b] = await Promise.all([work('site-a'), work('site-b')])
    expect(a).toEqual(['site-a'])
    expect(b).toEqual(['site-b'])
  })

  it('bindToCmsSite remembers the site for a callback called from another site, or from none', async () => {
    const s = await load('multi', three())
    const a = s.cmsSiteById('site-a')!
    const b = s.cmsSiteById('site-b')!
    const bound = s.runInCmsSite(a, () => s.bindToCmsSite((suffix: string) => `${s.useCmsSite().id}${suffix}`))
    expect(bound('!')).toBe('site-a!') // called from no site
    expect(s.runInCmsSite(b, () => bound('?'))).toBe('site-a?') // called from B's work
    // And B is B again after the call (a queue that runs A's job from B's job's end).
    expect(s.runInCmsSite(b, () => { bound(''); return s.useCmsSite().id })).toBe('site-b')
    // An async callback keeps it across its awaits.
    const slow = s.runInCmsSite(a, () => s.bindToCmsSite(async () => { await tick(); return s.useCmsSite().id }))
    expect(await s.runInCmsSite(b, () => slow())).toBe('site-a')
    // Binding with no site is refused: a callback must belong to one.
    expect(() => s.bindToCmsSite(() => 1)).toThrow(s.CmsNoSiteError)
  })
})

describe('multi mode: per-site memory', () => {
  it('cmsSiteScoped keeps a value per site, made on first use, and throws where there is no site', async () => {
    const s = await load('multi', three())
    const a = s.cmsSiteById('site-a')!
    const b = s.cmsSiteById('site-b')!
    let made = 0
    const cache = s.cmsSiteScoped(() => ({ of: s.useCmsSite().id, n: ++made, items: [] as string[] }))
    expect(() => cache()).toThrow(s.CmsNoSiteError)
    expect(() => cache.set({ of: 'x', n: 0, items: [] })).toThrow(s.CmsNoSiteError)
    expect(() => cache.reset()).toThrow(s.CmsNoSiteError)
    expect(made).toBe(0)

    s.runInCmsSite(a, () => cache().items.push('from A'))
    s.runInCmsSite(b, () => cache().items.push('from B'))
    expect(s.runInCmsSite(a, () => cache())).toMatchObject({ of: 'site-a', items: ['from A'] })
    expect(s.runInCmsSite(b, () => cache())).toMatchObject({ of: 'site-b', items: ['from B'] })
    expect(made).toBe(2)
    // reset and set touch the current site's value only.
    s.runInCmsSite(a, () => cache.reset())
    expect(s.runInCmsSite(a, () => cache().items)).toEqual([])
    expect(s.runInCmsSite(b, () => cache().items)).toEqual(['from B'])
    s.runInCmsSite(b, () => cache.set({ of: 'site-b', n: 0, items: ['set'] }))
    expect(s.runInCmsSite(b, () => cache().items)).toEqual(['set'])
    expect(s.runInCmsSite(a, () => cache().items)).toEqual([])
    // Two values declared apart are apart, in the same site.
    const other = s.cmsSiteScoped(() => 'other')
    expect(s.runInCmsSite(a, () => [other(), cache().of])).toEqual(['other', 'site-a'])
  })

  it('a value that is `undefined` or `null` is still made once', async () => {
    const s = await load('multi', three())
    const a = s.cmsSiteById('site-a')!
    let made = 0
    const nothing = s.cmsSiteScoped<null>(() => { made++; return null })
    s.runInCmsSite(a, () => { nothing(); nothing(); nothing() })
    expect(made).toBe(1)
  })

  it('the settings of a site are its own laid over the process\'s; a secret or a place the site does not have is empty, never the process\'s', async () => {
    const s = await load('multi', three())
    const a = s.runInCmsSite(s.cmsSiteById('site-a')!, () => s.cmsSettings())
    const b = s.runInCmsSite(s.cmsSiteById('site-b')!, () => s.cmsSettings())
    // The address is the directory's (without the trailing slash), not the process's.
    expect(a.publicUrl).toBe('https://site-a.example')
    expect(b.publicUrl).toBe('https://site-b.example')
    // B has its own webhooks and sender; A has none of its own.
    expect(b.webhooks).toEqual({ urls: 'https://b.example/hook', secret: 'b-secret' })
    expect(b.mail.from).toBe('B <hi@b.example>')
    expect(a.webhooks).toEqual({ urls: '', secret: '' })
    expect(a.status.token).toBe('')
    expect(a.content).toEqual({ token: '', publicUrl: '' })
    expect(a.auth.setupToken).toBe('')
    expect(a.forms.notifyTo).toBe('')
    expect(a.storage.local.dir).toBe('')
    expect(a.storage.s3.bucket).toBe('')
    expect(a.storage.s3.secretAccessKey).toBe('')
    expect(JSON.stringify(a)).not.toContain('process-')
    // What is not a secret or a place stays the process's: the transport, the driver, the default sender.
    expect(a.mail).toMatchObject({ transport: 'smtp', from: 'Process <no-reply@process.example>', file: { dir: '/process/mail' } })
    expect(a.storage.driver).toBe('local')
    expect(a.storage.s3.region).toBe('eu-1')
    expect(a.auth).toMatchObject({ mode: 'builtin', trustedProxies: 1 })
    // Laying a site's settings over the process's changed neither the process's nor the other site's.
    expect(PROCESS_CMS.webhooks.secret).toBe('process-webhook-secret')
    expect(PROCESS_CMS.publicUrl).toBe('https://process.example')
    expect(PROCESS_CMS.mail.from).toBe('Process <no-reply@process.example>')
    expect(a.mail.from).toBe('Process <no-reply@process.example>')
  })
})

describe('multi mode: work in every site', () => {
  it('forEachCmsSite runs the work inside each site that is not paused', async () => {
    const s = await load('multi', three())
    const seen: string[] = []
    const failed = await s.forEachCmsSite(async (site) => {
      await tick()
      seen.push(`${site.id}=${s.useCmsSite().id}`)
    })
    expect(failed).toEqual([])
    expect(seen.sort()).toEqual(['site-a=site-a', 'site-b=site-b'])
    expect(s.currentCmsSite()).toBeNull()
  })

  it('a failure in one site is logged with its id, returned, and does not stop the others', async () => {
    const s = await load('multi', [row('site-a'), row('site-b'), row('site-d'), row('site-e')])
    const done: string[] = []
    const failed = await s.forEachCmsSite(async (site) => {
      await tick()
      if (site.id === 'site-b') throw new Error('B is broken')
      if (site.id === 'site-d') throw new s.CmsNoSiteError('something in D')
      done.push(site.id)
    }, { what: 'the nightly task', concurrency: 1 })
    expect(done).toEqual(['site-a', 'site-e'])
    expect(failed.map((f) => f.site)).toEqual(['site-b', 'site-d'])
    expect((failed[0]!.error as Error).message).toBe('B is broken')
    expect(logged().some((l) => l.includes('site site-b: the nightly task failed') && l.includes('B is broken'))).toBe(true)
    expect(logged().some((l) => l.includes('site site-d: the nightly task failed'))).toBe(true)
  })

  it('runs at most `concurrency` sites at a time', async () => {
    const s = await load('multi', Array.from({ length: 9 }, (_, i) => row(`site-${i}`)))
    let running = 0
    let most = 0
    await s.forEachCmsSite(async () => {
      most = Math.max(most, ++running)
      await tick()
      running--
    }, { concurrency: 3 })
    expect(most).toBe(3)
  })

  it('start-up work is kept until a site is first used, then runs once, inside that site', async () => {
    const s = await load('multi', three())
    const started: string[] = []
    s.onCmsSiteStart(() => { started.push(s.useCmsSite().id) })
    s.onCmsSiteStart(() => { throw new Error('one hook fails') })
    s.onCmsSiteStart(() => { started.push(`second:${s.useCmsSite().id}`) })
    expect(started).toEqual([])
    const a = s.cmsSiteById('site-a')!
    s.runInCmsSite(a, () => { s.ensureCmsSiteStarted(); s.ensureCmsSiteStarted() })
    expect(started).toEqual(['site-a', 'second:site-a'])
    s.runInCmsSite(s.cmsSiteById('site-b')!, () => s.ensureCmsSiteStarted())
    expect(started).toEqual(['site-a', 'second:site-a', 'site-b', 'second:site-b'])
    expect(() => s.ensureCmsSiteStarted()).toThrow(s.CmsNoSiteError)
  })
})

describe('multi mode: the site directory', () => {
  it('finds a site by its host, whatever the case, the port or a trailing dot; an alias is not the site\'s own host', async () => {
    const s = await load('multi', three())
    expect(s.cmsSiteForHost('site-a.example')).toMatchObject({ main: true, site: { id: 'site-a', publicUrl: 'https://site-a.example', state: 'active' } })
    expect(s.cmsSiteForHost('SITE-A.Example:8443')!.site.id).toBe('site-a')
    expect(s.cmsSiteForHost('site-a.example.')!.site.id).toBe('site-a')
    expect(s.cmsSiteForHost('www.site-b.example')).toMatchObject({ main: false, site: { id: 'site-b' } })
    expect(s.cmsSiteForHost('site-c.example')!.site.state).toBe('paused')
    for (const host of ['nobody.example', 'site-a.example.evil.test', 'xsite-a.example', '', null, undefined, '127.0.0.1', '[::1]:3000']) {
      expect(s.cmsSiteForHost(host), String(host)).toBeNull()
    }
    expect(s.cmsAllSites().map((x) => x.id)).toEqual(['site-a', 'site-b', 'site-c'])
    expect(s.cmsSiteById('site-b')!.hosts).toEqual(['site-b.example', 'www.site-b.example'])
    expect(s.cmsSiteById('nobody')).toBeNull()
  })

  it('the host a request names is its Host header; a forwarded host counts only when the deployment says a proxy sets it', async () => {
    const s = await load('multi', three())
    expect(s.cmsRequestHost({ host: 'Site-A.example:443', forwarded: 'site-b.example' })).toBe('site-a.example')
    expect(s.cmsNormalHost('[::1]:3000')).toBe('[::1]')
    vi.stubEnv('NUXT_CMS_TENANCY_FORWARDED_HOST', 'true')
    expect(s.cmsRequestHost({ host: 'internal:3000', forwarded: 'site-b.example, proxy.internal' })).toBe('site-b.example')
    expect(s.cmsRequestHost({ host: 'site-a.example' })).toBe('site-a.example')
  })

  it.each([
    ['two sites with one host', [row('site-a'), row('site-b', { hosts: ['SITE-A.example'] })], /lists the host site-a\.example twice/],
    ['a host that is another site\'s alias', [row('site-a'), row('site-b', { hosts: ['site-b.example', 'www.site-a.example'] })], /lists the host www\.site-a\.example twice/],
    ['one id twice', [row('site-a'), row('site-a', { hosts: ['other.example'] })], /lists the id site-a twice/],
    ['a secret shorter than 32 characters', [row('site-a', { secret: 'short' })], /"secret" must be at least 32 characters/],
    ['no secret', [row('site-a', { secret: undefined })], /"secret" must be at least 32 characters/],
    ['an id with capitals or spaces', [row('Site A')], /"id" must be 1-63 characters of a-z, 0-9, - and _/],
    ['an id that could leave a folder', [row('../site')], /"id" must be/],
    ['an id of 64 characters', [row('a'.repeat(64))], /"id" must be/],
    ['no id', [{ ...row('x'), id: undefined }], /"id" must be/],
    ['no hosts', [row('site-a', { hosts: [] })], /"hosts" needs at least one host name/],
    ['a database address that is not Postgres', [row('site-a', { databaseUrl: 'mysql://db/x' })], /"databaseUrl" must be a postgres:\/\/ address/],
    ['a public address without a scheme', [row('site-a', { publicUrl: 'site-a.example' })], /"publicUrl" must be the site's address/],
  ])('refuses a directory with %s', async (_what, sites, message) => {
    const s = await load('multi', sites)
    expect(() => s.cmsAllSites()).toThrow(message)
    expect(() => s.cmsSiteForHost('site-a.example')).toThrow(message)
  })

  it('refuses to work without the directory file, or with a relative path to it', async () => {
    const s = await load('multi', three())
    vi.stubEnv('NUXT_CMS_TENANCY_FILE', '')
    expect(() => s.cmsAllSites()).toThrow(/set NUXT_CMS_TENANCY_FILE/)
    vi.stubEnv('NUXT_CMS_TENANCY_FILE', 'sites.json')
    expect(() => s.cmsAllSites()).toThrow(/must be an absolute path/)
    vi.stubEnv('NUXT_CMS_TENANCY_FILE', join(dir, 'missing.json'))
    expect(() => s.cmsAllSites()).toThrow(/cannot be read/)
  })

  it('accepts a bare list as well as { sites }; a row without a state is active', async () => {
    writeFileSync(directoryFile, JSON.stringify([row('site-a'), row('site-b', { state: 'read-only' }), row('site-c', { state: 'paused' })]))
    const s = await load('multi')
    expect(s.cmsAllSites().map((x) => [x.id, x.state])).toEqual([['site-a', 'active'], ['site-b', 'read-only'], ['site-c', 'paused']])
  })
})

describe('multi mode: the directory changes while the process runs', () => {
  /** Rewrite the file and let the half second pass after which it is looked at again. */
  const rewrite = async (sites: unknown, raw?: string) => {
    writeFileSync(directoryFile, raw ?? JSON.stringify({ sites }))
    await new Promise((r) => setTimeout(r, 550))
  }

  it('a site that left is forgotten and its resources released; one whose row changed too; an unchanged one keeps what it had', async () => {
    const s = await load('multi', three())
    const released: string[] = []
    const first = s.cmsSiteScoped(() => ({ of: s.useCmsSite().id, kind: 'first' }), { dispose: (v) => { released.push(`${v.kind}:${v.of}`) } })
    const second = s.cmsSiteScoped(() => ({ of: s.useCmsSite().id, kind: 'second' }), { dispose: (v) => { released.push(`${v.kind}:${v.of}`) } })
    const made: Record<string, unknown> = {}
    for (const id of ['site-a', 'site-b']) s.runInCmsSite(s.cmsSiteById(id)!, () => { made[id] = first(); second() })

    // A leaves; B's row changes (a new host); C stays as it was.
    await rewrite([row('site-b', { hosts: ['site-b.example', 'new.site-b.example'] }), row('site-c', { state: 'paused' })])
    expect(s.cmsSiteForHost('site-a.example')).toBeNull()
    expect(s.cmsSiteById('site-a')).toBeNull()
    expect(s.cmsSiteForHost('new.site-b.example')!.site.id).toBe('site-b')
    await tick()
    // Released newest first within a site (what was made later may need what was made earlier).
    expect(released.filter((r) => r.endsWith('site-a'))).toEqual(['second:site-a', 'first:site-a'])
    expect(released.filter((r) => r.endsWith('site-b'))).toEqual(['second:site-b', 'first:site-b'])
    // B is made anew on its next use.
    expect(s.runInCmsSite(s.cmsSiteById('site-b')!, () => first())).not.toBe(made['site-b'])

    // A file rewritten with the same rows releases nothing.
    const before = released.length
    const kept = s.runInCmsSite(s.cmsSiteById('site-b')!, () => first())
    await rewrite([row('site-b', { hosts: ['site-b.example', 'new.site-b.example'] }), row('site-c', { state: 'paused' }), row('site-z')])
    expect(s.cmsSiteById('site-z')).not.toBeNull()
    expect(released.length).toBe(before)
    expect(s.runInCmsSite(s.cmsSiteById('site-b')!, () => first())).toBe(kept)
  })

  it('work under way when its site\'s row changes finishes with what it started with, and cannot make the site\'s new memory', async () => {
    const s = await load('multi', three())
    const old = s.cmsSiteById('site-a')!
    const released: string[] = []
    const settings = s.cmsSiteScoped(() => `made from ${s.useCmsSite().config.status?.token ?? 'nothing'}`, { dispose: (v) => { released.push(v) } })
    // A request under way: it has made its memory from the old row and is waiting on something.
    let finish!: () => void
    const waiting = new Promise<void>((r) => { finish = r })
    const underWay = s.runInCmsSite(old, async () => {
      const before = settings()
      await waiting
      // After the change it still has its own row, its own memory, and the site has not "left".
      return { before, after: settings(), site: s.useCmsSite(), left: s.cmsSiteHasLeft(), token: s.cmsSettings().status.token }
    })
    // A callback bound before the change (a job in a queue).
    const bound = s.runInCmsSite(old, () => s.bindToCmsSite(() => s.cmsSettings().status.token))

    await rewrite([row('site-a', { config: { status: { token: 'the-new-token' } }, publicUrl: 'https://new.site-a.example' }), row('site-b')])
    const now = s.cmsSiteById('site-a')!
    expect(now).not.toBe(old)
    // New work reads the new row, and so does work started with the old row object in hand (a timer that kept it).
    expect(s.runInCmsSite(now, () => s.cmsSettings())).toMatchObject({ publicUrl: 'https://new.site-a.example', status: { token: 'the-new-token' } })
    expect(s.runInCmsSite(old, () => s.useCmsSite())).toBe(now)
    expect(s.runInCmsSite(now, () => settings())).toBe('made from the-new-token')
    // The bound callback goes on in the site as it is loaded now.
    expect(bound()).toBe('the-new-token')
    // The old memory is kept while the request is under way…
    expect(released).toEqual([])
    finish()
    expect(await underWay).toEqual({ before: 'made from nothing', after: 'made from nothing', site: old, left: false, token: '' })
    await tick()
    // …and released when it has finished. The new memory was never touched by it.
    expect(released).toEqual(['made from nothing'])
    expect(s.runInCmsSite(now, () => settings())).toBe('made from the-new-token')
  })

  it('work left running after its request, long after the row changed, goes on in the site as it is loaded now', async () => {
    const s = await load('multi', three())
    const settings = s.cmsSiteScoped(() => `made from ${s.useCmsSite().config.status?.token ?? 'nothing'}`)
    let late!: () => string
    // Captured inside the request without being bound: a promise chain that outlives it.
    await s.runInCmsSite(s.cmsSiteById('site-a')!, async () => { settings(); late = AsyncResource.bind(() => `${settings()} at ${s.useCmsSite().publicUrl}`) })
    await rewrite([row('site-a', { config: { status: { token: 'the-new-token' } }, publicUrl: 'https://new.site-a.example' }), row('site-b')])
    expect(s.cmsAllSites()).toHaveLength(2)
    await tick() // the old memory is released: nothing was under way
    expect(late()).toBe('made from the-new-token at https://new.site-a.example')
  })

  it('work handed to event.waitUntil keeps the site\'s memory until it has finished', async () => {
    const s = await load('multi', three())
    const released: string[] = []
    const pool = s.cmsSiteScoped(() => 'the old pool', { dispose: (v) => { released.push(v) } })
    let finish!: () => void
    const afterResponse = new Promise<void>((r) => { finish = r })
    await s.runInCmsSite(s.cmsSiteById('site-a')!, async () => { pool(); s.cmsHoldSiteUntil(afterResponse) })
    await rewrite([row('site-a', { publicUrl: 'https://new.site-a.example' }), row('site-b')])
    expect(s.cmsAllSites()).toHaveLength(2)
    await tick()
    expect(released).toEqual([]) // the request is over, its e-mail is not sent yet
    finish()
    await tick()
    expect(released).toEqual(['the old pool'])
  })

  it('a site that left the directory: nothing new starts in it, its work under way is told, and late work cannot keep anything', async () => {
    const s = await load('multi', three())
    const b = s.cmsSiteById('site-b')!
    const cache = s.cmsSiteScoped(() => ({ n: 0 }))
    let finish!: () => void
    const waiting = new Promise<void>((r) => { finish = r })
    let late!: () => unknown
    let leftCheck!: () => boolean
    const underWay = s.runInCmsSite(b, async () => {
      cache().n++
      leftCheck = s.cmsSiteLeftCheck()
      late = s.bindToCmsSite(() => cache())
      await waiting
      return { left: s.cmsSiteHasLeft(), n: cache().n }
    })
    expect(leftCheck()).toBe(false)

    await rewrite([row('site-a')])
    expect(s.cmsSiteById('site-b')).toBeNull()
    // Starting work in it, with its old row in hand, is refused.
    expect(() => s.runInCmsSite(b, () => 1)).toThrow(/site-b, which is not in the site directory/)
    // What its storage driver asks before every write.
    expect(leftCheck()).toBe(true)
    finish()
    expect(await underWay).toEqual({ left: true, n: 1 })
    await tick()
    // Its memory is released; a callback bound in it earlier fails instead of making a new cache (or database pool).
    expect(() => late()).toThrow(/late work of site site-b, which left the site directory/)
  })

  it('a row with a state that is not one of the three is refused, not read as active', async () => {
    const s = await load('multi', three())
    expect(s.cmsAllSites()).toHaveLength(3)
    await rewrite([row('site-a', { state: 'moved' }), row('site-b')])
    // The directory that cannot be used is not taken up: the last good one stays.
    expect(s.cmsAllSites().map((x: any) => x.id).sort()).toEqual(['site-a', 'site-b', 'site-c'])
  })

  it('a file that cannot be used keeps the last good directory and says so; a good one is taken up again', async () => {
    const s = await load('multi', three())
    expect(s.cmsAllSites()).toHaveLength(3)
    await rewrite(null, '{ not json')
    expect(s.cmsAllSites().map((x) => x.id)).toEqual(['site-a', 'site-b', 'site-c'])
    await rewrite([row('site-a'), row('site-b', { hosts: ['site-a.example'] })])
    expect(s.cmsSiteForHost('site-a.example')!.site.id).toBe('site-a')
    expect(logged().filter((l) => l.includes('keeping the previous one'))).toHaveLength(2)
    await rewrite([row('site-a')])
    expect(s.cmsAllSites().map((x) => x.id)).toEqual(['site-a'])
  })

  it('unloadAllCmsSites releases every site\'s resources (the server stopping), and a failing release does not stop the rest', async () => {
    const s = await load('multi', three())
    const released: string[] = []
    const pool = s.cmsSiteScoped(() => s.useCmsSite().id, { dispose: (id) => { released.push(id) } })
    const broken = s.cmsSiteScoped(() => s.useCmsSite().id, { dispose: () => { throw new Error('could not close') } })
    for (const id of ['site-a', 'site-b']) s.runInCmsSite(s.cmsSiteById(id)!, () => { pool(); broken() })
    await s.unloadAllCmsSites()
    expect(released.sort()).toEqual(['site-a', 'site-b'])
    expect(logged().filter((l) => l.includes('could not release a resource'))).toHaveLength(2)
  })
})
