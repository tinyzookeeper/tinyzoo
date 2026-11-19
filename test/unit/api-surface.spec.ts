import { spawnSync } from 'node:child_process'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { buildOpenApiDocument, buildRegistry, CMS_WEBHOOK_HEADERS, emitContentTypes, webhookPayload, type CmsChange } from 'tinyzoo'
import * as surface from '../contracts/surface/cms.config'
import { CLI_COMMANDS, usage } from '../../packages/cms/cli/usage'
import { API_ENTRIES, apiExports, apiReport, repoRoot, serverHelpersReport } from '../helpers/apiReport'
import { goldenTests } from '../helpers/golden'
import { CMS_IMAGE_WIDTHS } from '../../packages/cms/shared/image-widths'

// Several checks build TypeScript programs or start the CLI; a busy CI runner needs more than 5 s.
vi.setConfig({ testTimeout: 60_000 })

// The 1.0 freeze, as golden files in test/contracts (docs/api-surface.md lists the same
// surfaces in words). A change to any of them is a change to what a site, a plugin or a
// deploy depends on: the test fails with the lines that differ, `pnpm contracts:update`
// accepts it, and the changeset says whether it breaks (a removal, a rename, a narrower type:
// breaking; something added: not). See "Contracts" in CONTRIBUTING.md.
//
//   api-*.txt                the exported API of each entry point (declarations, @internal left out)
//   module-options.json      the options of the `cms` key in nuxt.config with their defaults, and the
//                            NUXT_CMS_* variables that follow from them
//   nitro-hooks.d.ts         the Nitro hooks (cms:change, cms:sitemap, cms:error) with their argument types
//   server-helpers.d.ts      the server helpers for plugins: useCms() and requireCmsUser(event)
//   cli-usage.txt            the commands and flags of the `tinyzoo` CLI
//   webhook.json             the body and headers of a publish webhook
//   content-routes.txt       the HTTP routes of the public content API
//   layer-config.json        what `extends: ['tinyzoo/layer']` sets up
//   surface.*                the content API, client types and admin graph of a config that uses every field

// ── the Nuxt module, run against a stub of @nuxt/kit ───────────────────────────────

const kit = vi.hoisted(() => ({ templates: [] as { filename: string; getContents: () => string }[], dependencies: undefined as unknown }))
// (By the path under packages/cms: @nuxt/kit is a dependency of that package, not of the workspace root.)
vi.mock('../../packages/cms/node_modules/@nuxt/kit', () => ({
  defineNuxtModule: (def: Record<string, unknown>) => { kit.dependencies = def.moduleDependencies; return def },
  addComponentsDir: () => {},
  addServerHandler: () => {},
  addServerPlugin: () => {},
  extendPages: () => {},
  addTypeTemplate: (t: { filename: string; getContents: () => string }) => { kit.templates.push(t) },
}))

const load = (file: string): Promise<{ default: unknown }> => import(/* @vite-ignore */ join(repoRoot, file))

/** Runs the module's `setup()` for module options and returns what it writes to the runtime config. */
async function runModule(options: Record<string, unknown> = {}) {
  // (Imported by a computed path: the module and the layer config are checked by Nuxt's typecheck, not by this folder's.)
  const mod = (await load('packages/cms/module')).default as unknown as {
    meta: unknown
    defaults: unknown
    setup: (options: Record<string, unknown>, nuxt: unknown) => Promise<void>
  }
  const nuxt = { options: { rootDir: '/nonexistent-tinyzoo-site', alias: {}, runtimeConfig: { public: {} as Record<string, unknown> } as Record<string, any> }, hook: () => {} }
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
  try { await mod.setup({ ...(mod.defaults as object), ...options }, nuxt) }
  finally { warn.mockRestore() }
  return { mod, runtimeConfig: nuxt.options.runtimeConfig }
}

/** Nitro binds `NUXT_<PATH>` to a runtime config path: `cms.storage.s3.bucket` is NUXT_CMS_STORAGE_S3_BUCKET. */
function envNames(value: unknown, path: string[] = []): { name: string; default: unknown }[] {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return Object.entries(value).flatMap(([k, v]) => envNames(v, [...path, k]))
  }
  return [{ name: `NUXT_${path.map((p) => p.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toUpperCase()).join('_')}`, default: value }]
}

const moduleOptions = async () => {
  const { mod, runtimeConfig } = await runModule()
  const { cms, public: pub } = runtimeConfig
  return `${JSON.stringify({
    module: { meta: (mod as any).meta, defaults: (mod as any).defaults, moduleDependencies: kit.dependencies },
    'runtimeConfig.cms': cms,
    'runtimeConfig.public': { cmsPlugins: pub.cmsPlugins, cmsTurnstileSiteKey: pub.cmsTurnstileSiteKey, cmsDemo: pub.cmsDemo },
    // Every runtime config value can be set from the environment, without a rebuild.
    environment: [
      ...envNames(cms, ['cms']).map((e) => ({ ...e, default: e.default === undefined ? null : e.default })),
      ...envNames({ cmsTurnstileSiteKey: pub.cmsTurnstileSiteKey, cmsDemo: pub.cmsDemo }, ['public']).map((e) => ({ ...e, default: e.default === undefined ? null : e.default })),
    ],
  }, null, 2)}\n`
}

// ── routes of the public content API, from the files that serve them ──────────────

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n)
    return statSync(p).isDirectory() ? files(p) : [p]
  })
}

const routeOf = (apiDir: string, file: string): string => {
  const rel = relative(apiDir, file).replace(/\\/g, '/')
  const m = /^(.*?)(?:\.(get|post|put|patch|delete|head))?\.ts$/.exec(rel)!
  const path = m[1]!.replace(/\/index$/, '').replace(/\[\.\.\.(\w+)\]/g, ':$1*').replace(/\[(\w+)\]/g, ':$1')
  return `${(m[2] ?? 'any').toUpperCase().padEnd(4)} /api/${path}`
}

function contentRoutes(): string {
  const apiDir = join(repoRoot, 'packages/cms/server/api')
  const routes = files(apiDir)
    .filter((f) => /^(content[\\/]|content-types\.ts|openapi|health[\\/])/.test(relative(apiDir, f)))
    .map((f) => routeOf(apiDir, f))
  // The forms plugin adds one under /api/content (its handler's `contentPath`).
  routes.push('GET  /api/content/_form/:name   (tinyzoo/forms)', 'POST /api/content/_form/:name   (tinyzoo/forms)')
  // And the analytics plugin's tracker sends its page views to one.
  routes.push('POST /api/content/_analytics/e   (tinyzoo/analytics)')
  // And a fleet monitor reads its daily totals from another, with the status token.
  routes.push('GET  /api/content/_analytics/rollups   (tinyzoo/analytics)')
  // Addresses under /api/cms that tinyzoo writes into content: a file's address (`cms_media.url`,
  // the `src` of a picture in rich text), the smaller copies <CmsImage> lists in srcset (cached a
  // year), the logo in e-mails already sent. Stored and cached, so they are frozen too.
  const stored = files(apiDir)
    .filter((f) => /^cms[\\/](_media[\\/](raw|img)[\\/]|_brand[\\/])/.test(relative(apiDir, f)))
    .map((f) => `${routeOf(apiDir, f)}   (stored in content)`)
  return `${[
    '# The HTTP routes of the public content API (and the documents around it): frozen from 1.0.',
    '# Everything else under /api (/api/cms/*) is the admin\'s own API and may change in any minor,',
    '# except the addresses marked "stored in content": tinyzoo writes them into the database, rich',
    '# text and e-mails (/api/cms/_media/raw/<key>, /api/cms/_media/img/<id>/<width>.webp,',
    '# /api/cms/_brand/<file>), so they keep working within a major.',
    ...routes.sort(),
    ...stored.sort(),
    '',
    `# The widths of /api/cms/_media/img/<id>/<width>.webp (may only grow): ${CMS_IMAGE_WIDTHS.join(', ')}`,
  ].join('\n')}\n`
}

/** The widths 1.0 shipped. Pages and CDNs keep srcset addresses for a year: a width may be added, never removed. */
const IMAGE_WIDTHS_10 = [320, 640, 960, 1280, 1920]

// ── the layer ───────────────────────────────────────────────────────────────────

async function layerConfig(): Promise<string> {
  ;(globalThis as any).defineNuxtConfig = (c: unknown) => c
  const config = (await load('packages/cms/nuxt.config')).default as Record<string, any>
  const relativize = (v: unknown): unknown => typeof v === 'string' ? v.replace(repoRoot, '<repo>') : Array.isArray(v) ? v.map(relativize) : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, relativize(x)])) : v
  return `${JSON.stringify(relativize(config), null, 2)}\n`
}

// ── the webhook ─────────────────────────────────────────────────────────────────

const fullChange: CmsChange = {
  type: 'entry.published',
  entity: 'page',
  id: '00000000-0000-4000-8000-000000000001',
  locale: 'en',
  public: true,
  paths: ['/en/about/team'],
  globals: ['navigation'],
  moved: [{ id: '00000000-0000-4000-8000-000000000001', locale: 'en', from: '/en/team', to: '/en/about/team' }],
  by: '00000000-0000-4000-8000-0000000000aa',
  version: '2026-01-01T10:00:00.000Z',
  at: '2026-01-01T10:00:01.000Z',
}

const webhook = () => `${JSON.stringify({
  headers: CMS_WEBHOOK_HEADERS,
  // `by` (who made the change) never leaves the admin.
  body: webhookPayload(fullChange, '11111111-1111-4111-8111-111111111111'),
  // The signature header is `t=<unix seconds>,v1=<hex HMAC-SHA256 of "<t>.<raw body>">`.
  changeTypes: ['entry.created', 'entry.updated', 'entry.deleted', 'entry.published', 'entry.unpublished', 'translation.updated', 'translation.deleted', 'global.updated'],
}, null, 2)}\n`

// ── the golden files ────────────────────────────────────────────────────────────

goldenTests('frozen API surface (test/contracts)', [
  ...API_ENTRIES.map((entry) => ({
    file: entry.golden,
    what: `the exported API of \`${entry.name}\``,
    render: () => apiReport(entry),
  })),
  { file: 'module-options.json', what: 'the `cms` module options with their defaults and the NUXT_CMS_* variables', render: moduleOptions },
  {
    file: 'nitro-hooks.d.ts',
    what: 'the Nitro hooks (cms:*) with their argument types, and the session user the module declares',
    render: async () => {
      await runModule()
      const t = kit.templates.find((x) => x.filename === 'types/cms-auth.d.ts')
      if (!t) throw new Error('the module registers no types/cms-auth.d.ts template')
      return t.getContents()
    },
  },
  { file: 'server-helpers.d.ts', what: 'the server helpers for plugins (useCms, requireCmsUser) with their types', render: serverHelpersReport },
  { file: 'cli-usage.txt', what: 'the commands and flags of the `tinyzoo` CLI', render: usage },
  { file: 'webhook.json', what: 'the publish webhook (headers and body)', render: webhook },
  { file: 'content-routes.txt', what: 'the HTTP routes of the public content API', render: contentRoutes },
  { file: 'layer-config.json', what: 'what the layer (`tinyzoo/layer`) sets up', render: layerConfig },
  { file: 'surface.client-types.ts', what: 'the generated client types of a config that uses every field', render: () => emitContentTypes(surface) },
  { file: 'surface.openapi.json', what: 'the OpenAPI document of a config that uses every field', render: () => `${JSON.stringify(buildOpenApiDocument(surface, { title: 'Content API' }), null, 2)}\n` },
  { file: 'surface.admin-graph.json', what: 'the admin graph (what field renderers receive) of a config that uses every field', render: () => `${JSON.stringify(buildRegistry(surface).graph, null, 2)}\n` },
], 'The frozen API changed')

// ── the facts the goldens do not say by themselves ───────────────────────────────

describe('addresses stored in content', () => {
  it('keeps every image width 1.0 shipped (the list may only grow)', () => {
    const removed = IMAGE_WIDTHS_10.filter((w) => !(CMS_IMAGE_WIDTHS as readonly number[]).includes(w))
    expect(removed, 'a width was removed: pages and CDNs still ask for its address').toEqual([])
    expect([...CMS_IMAGE_WIDTHS], 'ascending, no repeats').toEqual([...new Set(CMS_IMAGE_WIDTHS)].sort((a, b) => a - b))
  })

  it('serves the three stored addresses', () => {
    const stored = contentRoutes().split('\n').filter((l) => l.includes('(stored in content)')).map((l) => l.replace(/\s+\(.*$/, ''))
    expect(stored).toEqual(expect.arrayContaining([
      'GET  /api/cms/_media/raw/:key*',
      'GET  /api/cms/_media/img/:id/:file',
      'GET  /api/cms/_brand/:file',
    ]))
  })
})

describe('the API report', () => {
  it('has a public and an internal part for every entry, and nothing public is tagged @internal', () => {
    for (const entry of API_ENTRIES) {
      const exports = apiExports(entry)
      expect(exports.length, entry.name).toBeGreaterThan(0)
      const text = apiReport(entry)
      const [pub] = text.split('// ── internal')
      expect(pub, entry.name).not.toMatch(/@internal/)
    }
  })

  it('leaves @internal members of a public interface out', () => {
    const text = apiReport(API_ENTRIES[0]!)
    // CmsRegistry is public, its system tables are not.
    const registry = /export interface CmsRegistry \{[^}]*\}/s.exec(text)?.[0] ?? ''
    expect(registry).toContain('entities: CmsEntity[]')
    expect(registry).not.toContain('cmsUsers')
    // FieldDescriptor's column IR is not part of the API.
    const field = /export interface FieldDescriptor<[^]*?\n\}/.exec(text)?.[0] ?? ''
    expect(field).toContain('optional()')
    expect(field).not.toMatch(/\bspec:/)
  })
})

/** Every `.ts`, `.vue` and `.md` file under these paths of the repository (not dependencies or build output). */
function sourcesUnder(paths: string[]): string[] {
  const skip = new Set(['node_modules', '.nuxt', '.output', 'dist', '.cache', '.git'])
  const walk = (p: string): string[] => {
    if (!statSync(p, { throwIfNoEntry: false })?.isDirectory()) return /\.(ts|vue|md)$/.test(p) ? [p] : []
    return readdirSync(p).filter((n) => !skip.has(n)).flatMap((n) => walk(join(p, n)))
  }
  return paths.flatMap((p) => walk(join(repoRoot, p)))
}

describe('what sites import', () => {
  it('is never @internal: the docs, the website, the playground and the starter use the public API only', () => {
    const internal = new Map(API_ENTRIES.map((entry) => [entry.name, new Set(apiExports(entry).filter((e) => e.internal).map((e) => e.name))]))
    const used: string[] = []
    let seen = 0
    // tinyzoo's own website searches its docs with the matcher the content search uses. It is built and
    // type-checked from the same commit as the package, so an internal change cannot strand it.
    const allowed = new Set(['site/server/api/site-docs/search.get.ts'])
    const re = /import\s+(?:type\s+)?\{([^}]*)\}\s+from\s+['"](tinyzoo|tinyzoo\/forms|tinyzoo\/analytics|tinyzoo\/module|@tinyzoo\/client)['"]/g
    for (const file of sourcesUnder(['docs', 'README.md', 'packages/cms/README.md', 'packages/client/README.md', 'site', 'playground', 'packages/cms/starter', 'test/docs'])) {
      if (/docs[\\/](roadmap|production-plan|pilot-plan)\.md$/.test(file)) continue // the history of the project
      for (const m of readFileSync(file, 'utf8').matchAll(re)) {
        for (const raw of m[1]!.split(',')) {
          const name = raw.trim().replace(/^type\s+/, '').split(/\s+as\s+/)[0]!.trim()
          seen++
          if (internal.get(m[2]!)?.has(name) && !allowed.has(relative(repoRoot, file).split('\\').join('/'))) used.push(`${relative(repoRoot, file)} imports the @internal ${name} from ${m[2]}`)
        }
      }
    }
    expect(seen, 'imports found (the scan reads something)').toBeGreaterThan(20)
    expect(used).toEqual([])
  })
})

describe('the CLI usage', () => {
  it('lists every command the CLI dispatches, and every command once', () => {
    const source = readFileSync(join(repoRoot, 'packages/cms/cli/index.ts'), 'utf8')
    const dispatched = [...source.matchAll(/^ {2}case '([a-z:]+)':/gm)].map((m) => m[1]!).filter((c) => c !== 'help')
    const listed = CLI_COMMANDS.map((c) => c.name)
    expect(new Set(listed).size).toBe(listed.length)
    expect([...listed].sort()).toEqual([...dispatched].sort())
  })
})

describe('`tinyzoo help`', () => {
  const run = (...args: string[]) => spawnSync('pnpm', ['exec', 'tsx', join(repoRoot, 'packages/cms/cli/index.ts'), ...args], { cwd: join(repoRoot, 'packages/cms'), encoding: 'utf8' })

  it('prints the usage and exits 0 for help, --help and -h', () => {
    for (const arg of ['help', '--help', '-h']) {
      const res = run(arg)
      expect(res.status, arg).toBe(0)
      expect(res.stdout, arg).toBe(usage())
    }
  })

  it('prints the same usage to stderr and exits 1 for an unknown command or none', () => {
    for (const args of [['nope'], []]) {
      const res = run(...args)
      expect(res.status, args.join(' ')).toBe(1)
      expect(res.stderr).toContain(usage().trimEnd())
    }
  })
})

describe('the webhook', () => {
  it('leaves out who made the change, and puts the delivery id first', () => {
    const body = webhookPayload(fullChange, 'd')
    expect(body).not.toHaveProperty('by')
    expect(Object.keys(body)[0]).toBe('delivery')
    // Every other key of a change is in the body: a new field of CmsChange reaches the website on purpose.
    expect(Object.keys(body).sort()).toEqual(['delivery', ...Object.keys(fullChange).filter((k) => k !== 'by')].sort())
  })
})

// ── the page that says it in words: docs/api-surface.md ───────────────────────────

const doc = readFileSync(join(repoRoot, 'docs/api-surface.md'), 'utf8')
/** Named as `name` or as a call, `name(args)`. */
const documented = (name: string) => doc.includes(`\`${name}\``) || doc.includes(`\`${name}(`)

describe('docs/api-surface.md', () => {
  it('names every public export of every entry point', () => {
    const missing = API_ENTRIES.flatMap((entry) => apiExports(entry)
      .filter((e) => !e.internal && e.name !== 'default' && !documented(e.name))
      .map((e) => `${entry.name}: ${e.name}`))
    expect(missing, 'public exports the page does not name (add them there, or tag them @internal)').toEqual([])
  })

  it('does not list what is @internal as an entry of its own', () => {
    const listed = API_ENTRIES.flatMap((entry) => apiExports(entry)
      .filter((e) => e.internal && new RegExp(`^\\s*(?:\\||[-*])\\s*\`${e.name}(?:[(\`])`, 'm').test(doc))
      .map((e) => `${entry.name}: ${e.name}`))
    expect(listed, 'internal exports the page lists as part of the API').toEqual([])
  })

  it('does not let a public declaration name an @internal export', () => {
    const leaks: string[] = []
    for (const entry of API_ENTRIES) {
      const exports = apiExports(entry)
      const internal = exports.filter((e) => e.internal).map((e) => e.name)
      for (const e of exports.filter((x) => !x.internal)) {
        for (const name of internal) if (new RegExp(`(?<![\\w$.'"])${name}(?![\\w$'"])`).test(e.text)) leaks.push(`${entry.name}: ${e.name} names the @internal ${name}`)
      }
    }
    expect(leaks).toEqual([])
  })

  it('names every environment variable the module options bind', async () => {
    const options = JSON.parse(await moduleOptions()) as { environment: { name: string }[] }
    const missing = options.environment.map((e) => e.name).filter((name) => !documented(name))
    expect(missing).toEqual([])
  })

  it('names every CLI command and flag', () => {
    const missing: string[] = []
    for (const c of CLI_COMMANDS) {
      if (!doc.includes(`tinyzoo ${c.name}`)) missing.push(c.name)
      for (const [flag] of c.flags ?? []) if (!doc.includes(`\`${flag.replace(/ <.*$/, '')}`)) missing.push(`${c.name} ${flag}`)
    }
    expect(missing).toEqual([])
  })

  it('names every route of the content API, every hook, and every key and header of the webhook', () => {
    const routes = contentRoutes().split('\n').filter((l) => /^(GET|POST)/.test(l)).map((l) => l.replace(/^\w+\s+/, '').replace(/\s+\(.*$/, ''))
    const hooks = [...(kit.templates.find((t) => t.filename === 'types/cms-auth.d.ts')?.getContents() ?? '').matchAll(/'(cms:[a-z]+)'/g)].map((m) => m[1]!)
    expect(hooks.length).toBeGreaterThan(0)
    const body = Object.keys(webhookPayload(fullChange, 'd'))
    // The addresses stored in content are written as people read them (`/api/cms/_brand/<file>`):
    // check those by their fixed part, up to the first parameter.
    const named = routes.map((r) => (r.startsWith('/api/cms/') ? r.replace(/\/:.*$/, '/') : r))
    const missing = [...named, ...hooks, ...body, ...Object.values(CMS_WEBHOOK_HEADERS)].filter((x) => !doc.includes(x))
    expect(missing).toEqual([])
  })

  it('is linked from CONTRIBUTING.md and docs/upgrading.md', () => {
    for (const file of ['CONTRIBUTING.md', 'docs/upgrading.md']) {
      expect(readFileSync(join(repoRoot, file), 'utf8'), file).toMatch(/api-surface\.md/)
    }
  })
})
