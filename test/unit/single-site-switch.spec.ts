import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  diffModelFile,
  mergeModelFileAdditions,
  type ModelFile,
  type ModelFileField,
  type ModelFileType,
} from '../../packages/cms/src/model-file'

// The switch NUXT_CMS_CUSTOM_TYPES=on makes the one site of single mode a counted site. Here:
// the request wrapper (server/plugins/cms-0-site.ts) that exists only with the switch on, and
// the merge of an app's model file into a site's model (`mergeModelFileAdditions`). The
// module's bundling of the file is in model-file-build.spec.ts.

type SiteModule = typeof import('../../packages/cms/server/utils/cmsSite')
const SITE_FILE = join(import.meta.dirname, '../../packages/cms/server/utils/cmsSite.ts')
const PLUGIN_FILE = join(import.meta.dirname, '../../packages/cms/server/plugins/cms-0-site.ts')

let n = 0
/** The plugin and a fresh copy of the site seam, both loaded anew; the seam's helpers are the plugin's globals. */
async function loadPlugin(customTypes: boolean) {
  vi.stubEnv('NUXT_CMS_TENANCY_MODE', '')
  vi.stubEnv('NUXT_CMS_CUSTOM_TYPES', customTypes ? 'on' : '')
  vi.stubGlobal('useRuntimeConfig', () => ({ cms: {} }))
  const site = await import(/* @vite-ignore */ `${SITE_FILE}?fresh=${++n}`) as SiteModule
  for (const [name, value] of Object.entries(site)) vi.stubGlobal(name, value)
  vi.stubGlobal('defineNitroPlugin', (fn: unknown) => fn)
  vi.stubGlobal('cmsSiteReady', () => Promise.resolve())
  vi.stubGlobal('cmsIsModelLoadError', () => false)
  vi.stubGlobal('cmsModelNames', () => [])
  vi.stubGlobal('unloadAllCmsSites', async () => {})
  vi.stubGlobal('sessionCookieName', () => 'session')
  const plugin = (await import(/* @vite-ignore */ `${PLUGIN_FILE}?fresh=${++n}`)).default as (nitroApp: any) => void
  return { site, plugin }
}

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

describe('single mode: the request wrapper exists only with the switch', () => {
  it('without the switch the handler is left as it is and no hook is registered', async () => {
    const { plugin } = await loadPlugin(false)
    const handler = vi.fn()
    const nitroApp = { h3App: { handler }, hooks: { hook: vi.fn() } }
    plugin(nitroApp)
    expect(nitroApp.h3App.handler).toBe(handler)
    expect(nitroApp.hooks.hook).not.toHaveBeenCalled()
  })

  it('with the switch the handler runs the request inside the site\'s instance and holds it', async () => {
    const { site, plugin } = await loadPlugin(true)
    let inside: boolean | undefined
    const handler = vi.fn((_event: unknown) => { inside = site.cmsInSiteWork(); return 'answer' })
    const nitroApp = { h3App: { handler }, hooks: { hook: vi.fn() } }
    plugin(nitroApp)
    expect(nitroApp.h3App.handler).not.toBe(handler)
    // Nothing is unloaded when the server closes, as single mode never did (tasks may still run).
    expect(nitroApp.hooks.hook).not.toHaveBeenCalled()
    const event: any = { path: '/api/x', node: { req: { url: '/api/x', headers: {} } }, context: {} }
    expect(site.cmsInSiteWork()).toBe(false)
    const result = await nitroApp.h3App.handler(event)
    expect(result).toBe('answer')
    expect(handler).toHaveBeenCalledWith(event)
    expect(inside).toBe(true)
    expect(site.cmsInSiteWork()).toBe(false)
    expect(typeof event.context.waitUntil).toBe('function')
  })

  it('work the request leaves running (event.context.waitUntil) holds the instance, and the platform\'s own waitUntil is still called', async () => {
    const { site, plugin } = await loadPlugin(true)
    const released: string[] = []
    const cache = site.cmsSiteScoped(() => 'value', { dispose: (v) => { released.push(v) } })
    const handler = vi.fn((event: any) => { cache(); site.cmsRetireCurrentSite(); event.context.waitUntil(later); return 'ok' })
    let finish!: () => void
    const later = new Promise<void>((r) => { finish = r })
    const platform = vi.fn()
    const nitroApp = { h3App: { handler }, hooks: { hook: vi.fn() } }
    plugin(nitroApp)
    await nitroApp.h3App.handler({ path: '/api/x', node: { req: { url: '/api/x', headers: {} } }, context: { waitUntil: platform } })
    await new Promise((r) => setTimeout(r, 10))
    expect(platform).toHaveBeenCalledWith(later)
    expect(released).toEqual([])
    finish()
    await new Promise((r) => setTimeout(r, 10))
    expect(released).toEqual(['value'])
  })
})

// ── the merge of an app's model file into a site's model ──────────────────────────

const L = (cs: string) => ({ cs })
const TITLE: ModelFileField = { key: 'title', type: 'text', label: L('Název'), required: true }
const text = (key: string, extra: Record<string, unknown> = {}): ModelFileField => ({ key, type: 'text', label: L(key), ...extra }) as ModelFileField
const select = (key: string, values: string[]): ModelFileField =>
  ({ key, type: 'select', label: L(key), options: values.map((value) => ({ value, label: L(value) })) }) as ModelFileField
const type = (name: string, fields: ModelFileField[] = [TITLE], extra: Record<string, unknown> = {}): ModelFileType =>
  ({ name, label: L(name), titleField: 'title', fields, ...extra }) as ModelFileType
const file = (types: ModelFileType[], extra: Partial<ModelFile> = {}): ModelFile => ({ format: 1, version: 1, types, ...extra })

const diffOps = (a: ModelFile, b: ModelFile) => {
  const { ops, problems } = diffModelFile(a, b)
  expect(problems).toEqual([])
  return ops as any[]
}

describe('mergeModelFileAdditions', () => {
  it('a type only the file has comes whole', () => {
    const current = file([type('event')])
    const theirs = file([type('event'), type('place', [TITLE, text('city')])])
    const merged = mergeModelFileAdditions(current, theirs)
    expect(merged.types.map((t) => t.name)).toEqual(['event', 'place'])
    const ops = diffOps(current, merged)
    expect(ops.map((o) => o.op)[0]).toBe('type.add')
    expect(ops.filter((o) => o.op === 'type.add').map((o) => o.type?.name ?? o.name)).toEqual(['place'])
    for (const op of ops) expect(JSON.stringify(op)).not.toContain('"event"')
    // The new type and its fields come whole.
    expect(merged.types[1]).toEqual(theirs.types[1])
  })

  it('a field only the file has comes after the type\'s own fields', () => {
    const current = file([type('event', [TITLE, text('place')])])
    const theirs = file([type('event', [TITLE, text('extra'), text('place'), text('more')])])
    const merged = mergeModelFileAdditions(current, theirs)
    expect(merged.types[0]!.fields.map((f) => f.key)).toEqual(['title', 'place', 'extra', 'more'])
    const ops = diffOps(current, merged)
    expect(ops.map((o) => o.op)).toEqual(['field.add', 'field.add'])
    expect(ops.map((o) => o.field.key)).toEqual(['extra', 'more'])
  })

  it('what the current model has and the file lacks stays; what both have but differ in stays as current has it', () => {
    const current = file([
      type('event', [TITLE, text('place', { label: L('Místo'), required: true }), select('kind', ['a', 'b']), text('only-here')], { label: L('Akce'), listColumns: ['title', 'place'] } as any),
      type('gone-from-file', [TITLE]),
    ])
    const theirs = file([
      type('event', [select('kind', ['c']), TITLE, text('place', { label: L('Jiné') }), text('new')], { label: L('Událost'), listColumns: ['place', 'title'] } as any),
    ])
    const merged = mergeModelFileAdditions(current, theirs)
    expect(merged.types.map((t) => t.name)).toEqual(['event', 'gone-from-file'])
    const event = merged.types[0]!
    expect(event.label).toEqual(L('Akce'))
    expect((event as any).listColumns).toEqual(['title', 'place'])
    expect(event.fields.map((f) => f.key)).toEqual(['title', 'place', 'kind', 'only-here', 'new'])
    expect(event.fields[1]).toEqual(current.types[0]!.fields[1])
    expect(event.fields[2]).toEqual(current.types[0]!.fields[2])
    const ops = diffOps(current, merged)
    expect(ops.map((o) => o.op)).toEqual(['field.add'])
  })

  it('merging the same file twice is the same as once', () => {
    const current = file([type('event', [TITLE, text('place')])])
    const theirs = file([type('event', [TITLE, text('extra')]), type('place', [TITLE])])
    const once = mergeModelFileAdditions(current, theirs)
    const twice = mergeModelFileAdditions(once, theirs)
    expect(twice).toEqual(once)
    expect(diffOps(once, twice)).toEqual([])
  })

  it('the version and the address are the current model\'s, and the inputs are not changed', () => {
    const current = file([type('event')], { version: 7, site: 'https://a.example' })
    const theirs = file([type('event', [TITLE, text('extra')])], { version: 99, site: 'https://b.example' })
    const before = JSON.stringify([current, theirs])
    const merged = mergeModelFileAdditions(current, theirs)
    expect(merged.version).toBe(7)
    expect(merged.site).toBe('https://a.example')
    expect(JSON.stringify([current, theirs])).toBe(before)
  })

  it('200 random pairs: the difference only adds, and everything current has is kept unchanged', () => {
    // A small seeded generator, so a failure repeats.
    let seed = 20261125
    const rnd = () => {
      seed = (seed + 0x6D2B79F5) | 0
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296
    }
    const pick = <T>(xs: T[]): T => xs[Math.floor(rnd() * xs.length)]!
    const TYPES = ['event', 'place', 'person', 'offer', 'note']
    const KEYS = ['place', 'city', 'price', 'kind', 'notes', 'link']
    const makeField = (key: string): ModelFileField => {
      const label = L(`${key}-${Math.floor(rnd() * 3)}`)
      if (rnd() < 0.3) return { ...select(key, rnd() < 0.5 ? ['a', 'b'] : ['a', 'c']), label } as ModelFileField
      return text(key, { label, ...(rnd() < 0.3 ? { required: true } : {}) })
    }
    const makeFile = (): ModelFile => {
      const types = TYPES.filter(() => rnd() < 0.6).map((name) => {
        const keys = KEYS.filter(() => rnd() < 0.5).sort(() => rnd() - 0.5)
        const fields = [TITLE, ...keys.map(makeField)]
        return type(name, fields, { label: L(`${name}-${Math.floor(rnd() * 3)}`), ...(rnd() < 0.4 ? { listColumns: ['title', ...keys.slice(0, 1)] } : {}) })
      })
      return file(types, { version: 1 + Math.floor(rnd() * 9), ...(rnd() < 0.5 ? { site: 'https://x.example' } : {}) })
    }
    for (let i = 0; i < 200; i++) {
      const current = makeFile()
      const theirs = makeFile()
      const label = `pair ${i}`
      const currentBefore = JSON.stringify(current)
      const merged = mergeModelFileAdditions(current, theirs)
      expect(JSON.stringify(current), label).toBe(currentBefore)
      expect(merged.version, label).toBe(current.version)
      expect(merged.site, label).toBe(current.site)
      const had = new Map(current.types.map((t) => [t.name, t]))
      // Everything current has is in merged, unchanged.
      for (const t of current.types) {
        const m = merged.types.find((x) => x.name === t.name)
        expect(m, label).toBeDefined()
        const { fields: ownFields, ...ownRest } = t
        const { fields: mergedFields, ...mergedRest } = m!
        expect(mergedRest, label).toEqual(ownRest)
        expect(mergedFields.slice(0, ownFields.length), label).toEqual(ownFields)
      }
      // The difference only adds: a type, or a field of a type; nothing touches what current has otherwise.
      const ops = diffOps(current, merged)
      for (const op of ops) {
        // (A new type's fields come as field.add ops on the new type.)
        if (op.op === 'field.add') {
          const own = had.get(op.type)
          if (own) expect(own.fields.some((f) => f.key === op.field.key), `${label} ${JSON.stringify(op)}`).toBe(false)
        }
        else if (op.op === 'type.add') expect(had.has(op.type?.name ?? op.name), label).toBe(false)
        else expect(had.has(op.type), `${label} ${op.op} on a type current has`).toBe(false)
      }
      // The same file again changes nothing.
      expect(mergeModelFileAdditions(merged, theirs), label).toEqual(merged)
    }
  })
})
