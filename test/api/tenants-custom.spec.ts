import { readdirSync } from 'node:fs'
import { join } from 'node:path'
import pg from 'pg'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { type Client, doc, signIn } from '../helpers/api'
import { createAuthor } from '../helpers/fixtures'
import { repoRoot } from '../setup/database'
import { expectNoSiteErrors, siteClient, siteQuery, startTenants, type Tenants, type TenantSite, tenantGet, until } from '../helpers/tenants'

// Two sites of the same model in one process, each with content types of its own
// (docs/custom-types-plan.md): site A makes `x_course` (a page, publishing, a choice, a picture,
// a relation to the author, a required text) and site B makes `x_recipe`. The structure is
// changed through `POST /api/cms/_model`.
//
// What is proven: the routes that serve the playground's own types serve a site's own types too;
// a type of one site does not exist on the other (every route answers 404, and nothing the
// other site says names it); a change on one site leaves the other site's instance as it was; a
// request under way during a change ends well; the function refuses what the plan refuses and
// nothing else reaches the database; hidden fields come back with their values and are deleted
// for good only after their time; and the model survives an idle unload, a restart and a second
// instance.
let t: Tenants
let adminA: Client
let adminB: Client
const OPERATOR = 'operator-token-of-the-custom-suite'

/** Words that are in one site's content only. */
const WORD = { a: 'kometovnik', b: 'zeppelinova' }
const UUID_NOWHERE = '00000000-0000-4000-8000-000000000000'

/** Short waits before the later deletion (the test knobs): an empty hidden thing goes after 3 s, any after 10 s. */
const PURGE_EMPTY_MS = 3000
const PURGE_MS = 10_000

let bHadModelTable: boolean | null = null
let authorA: string
let course: { id: string; slug: string }
let courseDraft: { id: string; slug: string }
let recipe: { id: string; slug: string }
const changeMs: number[] = []

const text = (label: string) => ({ en: label })
const textField = (key: string, extra: Record<string, unknown> = {}) => ({ key, type: 'text', label: text(key), ...extra })

/** The current version and document of a site's model. */
async function model(c: Client): Promise<any> {
  const res = await c.get('/api/cms/_model')
  if (res.status !== 200) throw new Error(`GET /api/cms/_model: ${res.status} ${JSON.stringify(res.body)}`)
  return res.body
}

/**
 * Change a site's structure against its current version. A change of the server's own (the later
 * deletion) can come between the read and the write: that answer (stale) is tried again.
 */
async function change(c: Client, ops: unknown[], extra: Record<string, unknown> = {}) {
  for (let round = 0; ; round++) {
    const m = await model(c)
    const started = performance.now()
    const res = await c.post('/api/cms/_model', { baseVersion: m.version, ops, ...extra })
    if (res.status === 409 && res.body?.data?.code === 'stale-version' && round < 4) continue
    if (res.status === 200 && !extra.dryRun) changeMs.push(performance.now() - started)
    return res
  }
}

async function mustChange(c: Client, ops: unknown[]) {
  const res = await change(c, ops)
  if (res.status !== 200) throw new Error(`change ${JSON.stringify(ops).slice(0, 300)}: ${res.status} ${JSON.stringify(res.body)}`)
  return res.body
}

const get = (site: { url: string }, path: string) => tenantGet(site.url, path)
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
const graph = async (c: Client) => (await c.get('/api/cms/_graph')).body as any[]
const graphEntity = async (c: Client, name: string) => (await graph(c)).find((e) => e.name === name)
const fieldKeys = async (c: Client, name: string) => ((await graphEntity(c, name))?.fields ?? []).map((f: any) => f.key as string)

const tablesOf = async (site: Pick<TenantSite, 'databaseUrl'>) => (await siteQuery(site, `select table_name from information_schema.tables where table_schema = 'public' and table_type = 'BASE TABLE' order by table_name`)).map((r) => r.table_name as string)
const columnsOf = async (site: Pick<TenantSite, 'databaseUrl'>, table: string) => (await siteQuery(site, `select column_name from information_schema.columns where table_schema = 'public' and table_name = $1 order by column_name`, [table])).map((r) => r.column_name as string)

/** What the operator's route says of the sites of one server. */
async function seen(ipUrl: string, id: string): Promise<{ id: string; loaded: boolean; loads: number; model: { version: number; types: number } | null }> {
  const res = await tenantGet(ipUrl, '/api/health/sites', '', { authorization: `Bearer ${OPERATOR}` })
  if (res.status !== 200) throw new Error(`/api/health/sites: ${res.status} ${res.text}`)
  return res.body.sites.find((s: any) => s.id === id)
}

beforeAll(async () => {
  t = await startTenants('custom', {
    NUXT_CMS_CUSTOM_TYPES: 'on',
    NUXT_CMS_TENANCY_OPERATOR_TOKEN: OPERATOR,
    CMS_TEST_MODEL_PURGE_EMPTY_MS: String(PURGE_EMPTY_MS),
    CMS_TEST_MODEL_PURGE_MS: String(PURGE_MS),
    CMS_TEST_MODEL_SWEEP_MS: '500',
  })
  adminA = siteClient(t.a, 'admin')
  adminB = siteClient(t.b, 'admin')

  // B has never changed its structure: it has no table of model versions yet.
  bHadModelTable = (await siteQuery(t.b, `select to_regclass('public.cms_model') as t`))[0].t !== null
}, 240_000)

afterAll(async () => {
  try {
    if (changeMs.length) {
      const sorted = [...changeMs].sort((a, b) => a - b)
      console.info(`[timing] all structure changes over HTTP in this run: ${sorted.length} samples, min ${sorted[0]!.toFixed(0)} ms, median ${sorted[Math.floor(sorted.length / 2)]!.toFixed(0)} ms, max ${sorted.at(-1)!.toFixed(0)} ms`)
    }
    if (t) {
      const built = [...t.server.logs.join('').matchAll(/search index built: (\d+) entries and translations in (\d+) ms/g)].map((m) => ({ rows: Number(m[1]), ms: Number(m[2]) }))
      if (built.length) {
        const ms = built.map((b) => b.ms).sort((a, b) => a - b)
        console.info(`[timing] search index rebuilds in the server log: ${built.length}, min ${ms[0]} ms, median ${ms[Math.floor(ms.length / 2)]} ms, max ${ms.at(-1)} ms (largest index ${Math.max(...built.map((b) => b.rows))} entries)`)
      }
    }
    expectNoSiteErrors(t)
  }
  finally { await t?.stop() }
})

describe('the premise', () => {
  // Every later test builds on what this one makes.
  it('each site makes its own types through the structure function, and its first entries through the admin routes', async () => {
    // A: a type with a page and publishing, then its fields (the required text while the type is empty).
    await mustChange(adminA, [{ op: 'type.add', name: 'x_course', label: text('Courses'), labelSingular: text('Course'), page: { prefix: 'kurzy' }, publish: true }])
    await mustChange(adminA, [
      { op: 'field.add', type: 'x_course', field: { key: 'level', type: 'select', label: text('Level'), options: [{ value: 'beginner', label: text('Beginner') }, { value: 'advanced', label: text('Advanced') }] } },
      { op: 'field.add', type: 'x_course', field: { key: 'cover', type: 'media', label: text('Cover') } },
      { op: 'field.add', type: 'x_course', field: { key: 'author', type: 'relation', to: 'author', label: text('Author') } },
      { op: 'field.add', type: 'x_course', field: { key: 'teacher', type: 'text', required: true, label: text('Teacher') } },
    ])
    // A second type of A's (for the tests that change the structure while x_course is in use).
    await mustChange(adminA, [{ op: 'type.add', name: 'x_event', label: text('Events'), labelSingular: text('Event'), page: { prefix: 'akce' }, publish: true }])
    // B: its own type.
    await mustChange(adminB, [{ op: 'type.add', name: 'x_recipe', label: text('Recipes'), labelSingular: text('Recipe'), page: { prefix: 'recepty' }, publish: true }])
    await mustChange(adminB, [{ op: 'field.add', type: 'x_recipe', field: { key: 'minutes', type: 'number', label: text('Minutes') } }])

    // Content of each site's own, made before anything asks for the sitemap (it is cached for a while).
    authorA = (await createAuthor(adminA, { name: 'Autor kurzu' })).id
    const made = await adminA.post('/api/cms/x_course', { title: `Kurz ${WORD.a}`, slug: 'python', teacher: 'Ada', level: 'beginner', author: authorA, status: 'published' })
    if (made.status !== 201) throw new Error(`course on A: ${made.status} ${JSON.stringify(made.body)}`)
    course = { id: made.body.row.id, slug: made.body.row.slug }
    const draft = await adminA.post('/api/cms/x_course', { title: `Koncept ${WORD.a}`, slug: 'koncept', teacher: 'Bob', status: 'draft' })
    if (draft.status !== 201) throw new Error(`draft on A: ${draft.status} ${JSON.stringify(draft.body)}`)
    courseDraft = { id: draft.body.row.id, slug: draft.body.row.slug }
    const r = await adminB.post('/api/cms/x_recipe', { title: `Polévka ${WORD.b}`, slug: 'polevka', minutes: 20, status: 'published' })
    if (r.status !== 201) throw new Error(`recipe on B: ${r.status} ${JSON.stringify(r.body)}`)
    recipe = { id: r.body.row.id, slug: r.body.row.slug }
  }, 60_000)

  it('the sites have types of their own, and B had no table of model versions before it changed its structure', async () => {
    expect(bHadModelTable).toBe(false)
    const a = await model(adminA)
    const b = await model(adminB)
    expect(a.doc.types.map((x: any) => x.name)).toEqual(['x_course', 'x_event'])
    expect(b.doc.types.map((x: any) => x.name)).toEqual(['x_recipe'])
    expect(a.problems).toEqual([])
    expect(b.limits).toEqual({ types: 12, fields: 30, options: 30 })
    expect(b.used).toEqual({ types: 1 })
    expect(a.entries).toMatchObject({ x_course: 2, x_event: 0 })
    expect(b.entries).toEqual({ x_recipe: 1 })
    // The design's own types are listed for the editor to read.
    expect(a.design.map((d: any) => d.name)).toEqual(expect.arrayContaining(['author', 'post', 'page']))
  })
})

const menuKeys = (m: any): string[] => [...m.home, ...m.groups.flatMap((g: any) => g.items), ...m.settings]

describe('the menu', () => {
  it('has the content types behind Settings, before the team, for an administrator of a site with the feature', async () => {
    for (const admin of [adminA, adminB]) {
      const menu = (await admin.get('/api/cms/_menu')).body
      expect(menu.settings).toContain('@model')
      expect(menu.settings.indexOf('@model')).toBe(menu.settings.indexOf('@team') - 1)
      expect(menuKeys(menu).filter((k) => k === '@model')).toHaveLength(1)
    }
  })

  it('has no such row for an editor or an author of the same site', async () => {
    for (const role of ['editor', 'author'] as const) {
      const menu = (await siteClient(t.a, role).get('/api/cms/_menu')).body
      expect(menuKeys(menu), role).not.toContain('@model')
    }
  })

  it('takes an arrangement that holds the row, and keeps the row when an arrangement leaves it out', async () => {
    const before = (await adminA.get('/api/cms/_menu')).body
    try {
      const groups = Object.fromEntries(before.groups.map((g: any) => [g.id, g.items]))
      const moved = await adminA.put('/api/cms/_menu', { home: ['@model', ...before.home], groups, settings: before.settings.filter((k: string) => k !== '@model') })
      expect(moved.status, JSON.stringify(moved.body)).toBe(200)
      expect(moved.body.home[0]).toBe('@model')
      const without = await adminA.put('/api/cms/_menu', { home: before.home, groups, settings: before.settings.filter((k: string) => k !== '@model') })
      expect(without.status).toBe(200)
      expect(without.body.settings).toContain('@model')
    }
    finally {
      await adminA.delete('/api/cms/_menu')
    }
  })

  it('is as it always was on a server without the switch (the single site of this project)', async () => {
    const menu = (await (await signIn('admin')).get('/api/cms/_menu')).body
    expect(menu.settings).toContain('@team')
    expect(menuKeys(menu)).not.toContain('@model')
  })
})

describe('the routes of the playground serve a site\'s own type', () => {
  it('makes, checks, publishes and reads an entry of a custom type', async () => {
    // A bad entry: the required field is missing, a choice that does not exist, no title.
    expect((await adminA.post('/api/cms/x_course', { title: 'Bez učitele', slug: 'bez-ucitele' })).status).toBe(422)
    expect((await adminA.post('/api/cms/x_course', { title: 'Zlá volba', slug: 'zla-volba', teacher: 'Eva', level: 'expert' })).status).toBe(422)
    expect((await adminA.post('/api/cms/x_course', { slug: 'bez-nazvu', teacher: 'Eva' })).status).toBe(422)
    expect((await siteQuery(t.a, `select slug from x_course order by slug`)).map((r) => r.slug)).toEqual(['koncept', 'python'])

    // A draft is made, read by the admin, not served; publishing serves it.
    const made = await adminA.post('/api/cms/x_course', { title: 'JavaScript', slug: 'javascript', teacher: 'Jan', level: 'advanced', author: authorA, status: 'draft' })
    expect(made.status, JSON.stringify(made.body)).toBe(201)
    const id = made.body.row.id
    expect(made.body.row).toMatchObject({ title: 'JavaScript', teacher: 'Jan', level: 'advanced', status: 'draft' })
    expect((await adminA.get(`/api/cms/x_course/${id}`)).body.row.teacher).toBe('Jan')
    expect((await get(t.a, '/api/content/x_course/javascript')).status).toBe(404)
    expect((await get(t.a, '/api/content/x_course')).body.items.map((i: any) => i.slug)).toEqual(['python'])

    const published = await adminA.patch(`/api/cms/x_course/${id}`, { status: 'published' })
    expect(published.status, JSON.stringify(published.body)).toBe(200)
    const list = await get(t.a, '/api/content/x_course')
    expect(list.status).toBe(200)
    expect(list.body.items.map((i: any) => i.slug).sort()).toEqual(['javascript', 'python'])
    const one = await get(t.a, '/api/content/x_course/python')
    expect(one.status).toBe(200)
    expect(one.body.item).toMatchObject({ title: `Kurz ${WORD.a}`, teacher: 'Ada', level: 'beginner' })
    expect((await get(t.a, '/api/content/x_course/koncept')).status).toBe(404)
    expect((await get(t.a, `/api/content/x_course/${UUID_NOWHERE}`)).status).toBe(404)

    // An update and a delete on the admin routes.
    expect((await adminA.patch(`/api/cms/x_course/${id}`, { teacher: 'Jana' })).body.row.teacher).toBe('Jana')
    expect((await adminA.patch(`/api/cms/x_course/${id}`, { teacher: '' })).status).toBe(422)
    expect((await adminA.delete(`/api/cms/x_course/${id}`)).status).toBe(200)
    expect((await get(t.a, '/api/content/x_course/javascript')).status).toBe(404)
  })

  it('lists the type in the admin graph, the generated types and the API description', async () => {
    const e = await graphEntity(adminA, 'x_course')
    expect(e).toBeTruthy()
    expect((e.fields as any[]).map((f) => f.key)).toEqual(expect.arrayContaining(['title', 'slug', 'status', 'level', 'cover', 'author', 'teacher']))
    expect((e.fields as any[]).find((f) => f.key === 'teacher').required).toBe(true)
    expect(await fieldKeys(adminA, 'x_event')).toEqual(expect.arrayContaining(['title', 'slug', 'status']))

    const types = await get(t.a, '/api/content-types.ts')
    expect(types.status).toBe(200)
    expect(types.text).toMatch(/\bXCourse\b/)
    expect(types.text).toMatch(/\bXEvent\b/)
    expect(/export interface XCourse \{[^]*?\n\}/.exec(types.text)?.[0]).toContain('teacher')

    const api = (await get(t.a, '/api/openapi.json')).body
    expect(Object.keys(api.paths)).toEqual(expect.arrayContaining(['/api/content/x_course', '/api/content/x_course/{slug}']))
    expect(Object.keys(api.components.schemas).some((s) => s.startsWith('XCourse'))).toBe(true)
  })

  it('finds an entry in the site search, the admin search and the sitemap', async () => {
    const found = await until('the site search to find the course', async () => (await get(t.a, `/api/content/_search?q=${WORD.a}`)).body?.items ?? [], (items: any[]) => items.some((i) => i.entity === 'x_course'), 10_000)
    expect(found.filter((i: any) => i.entity === 'x_course').map((i: any) => i.path)).toEqual(['/kurzy/python'])
    const admin = await until('the admin search to find the course', async () => (await adminA.get(`/api/cms/_search?q=${WORD.a}`)).body?.items ?? [], (items: any[]) => items.some((i) => i.entity === 'x_course'), 10_000)
    // The admin sees the draft too, the site does not.
    expect(admin.filter((i: any) => i.entity === 'x_course').map((i: any) => i.id).sort()).toEqual([course.id, courseDraft.id].sort())

    const sitemap = await get(t.a, '/sitemap.xml')
    expect(sitemap.status).toBe(200)
    const locs = [...sitemap.text.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]!)
    expect(locs).toContain(`${t.a.url}/kurzy/python`)
    expect(locs).not.toContain(`${t.a.url}/kurzy/koncept`)
    expect(locs.some((l) => l.includes('/recepty/'))).toBe(false)
    expect((await get(t.a, '/api/content/_sitemap')).body.entries.map((e: any) => e.loc)).toContain('/kurzy/python')
  })
})

describe('a type of one site does not exist on the other', () => {
  /** Admin routes taking a type name, from the files (the method is in the file name). */
  function adminTypeRoutes(name: string): { method: string; path: string; source: string }[] {
    const root = join(repoRoot, 'packages/cms/server/api/cms/[entity]')
    const out: { method: string; path: string; source: string }[] = []
    for (const entry of readdirSync(root, { recursive: true, withFileTypes: true }) as any[]) {
      if (!entry.isFile()) continue
      const source = join(entry.parentPath ?? entry.path, entry.name).slice(root.length + 1)
      const m = /^(.*)\.(get|post|put|patch|delete|head)\.ts$/.exec(source)
      if (!m) continue
      const path = m[1]!.split('/').filter((s) => s !== 'index').map((s) => (/^\[(.+)\]$/.test(s) ? UUID_NOWHERE : s)).join('/')
      out.push({ method: m[2]!.toUpperCase(), path: `/api/cms/${name}${path ? `/${path}` : ''}`, source })
    }
    return out
  }

  /** Content routes taking a type name. */
  function contentTypeRoutes(name: string): { path: string }[] {
    return [
      { path: `/api/content/${name}` },
      { path: `/api/content/${name}/some-slug` },
      { path: `/api/content/${name}/${UUID_NOWHERE}` },
      { path: `/api/content/_tree/${name}` },
      { path: `/api/content/_global/${name}` },
    ]
  }

  async function sweep(site: TenantSite, admin: Client, absent: string[]) {
    const failures: string[] = []
    let calls = 0
    for (const name of absent) {
      for (const r of adminTypeRoutes(name)) {
        const write = r.method !== 'GET' && r.method !== 'HEAD'
        const res = await admin.request(r.method, r.path, write ? { json: {} } : {})
        calls++
        if (res.status !== 404) failures.push(`${site.id} admin ${r.method} ${r.path}: ${res.status} ${JSON.stringify(res.body).slice(0, 160)}`)
      }
      for (const method of ['GET', 'PUT'] as const) {
        const res = await admin.request(method, `/api/cms/_singleton/${name}`, method === 'PUT' ? { json: {} } : {})
        calls++
        if (res.status !== 404) failures.push(`${site.id} admin ${method} /api/cms/_singleton/${name}: ${res.status} ${JSON.stringify(res.body).slice(0, 160)}`)
      }
      for (const r of contentTypeRoutes(name)) {
        const res = await get(site, r.path)
        calls++
        if (res.status !== 404) failures.push(`${site.id} content ${r.path}: ${res.status} ${res.text.slice(0, 160)}`)
      }
    }
    return { failures, calls }
  }

  it('finds the routes (the sweep is generated from the files, so it must not quietly find none)', () => {
    const sources = adminTypeRoutes('x_course').map((r) => `${r.method} ${r.source}`).sort()
    expect(sources).toEqual([
      'DELETE [id].delete.ts', 'GET [id].get.ts', 'GET [id]/revisions/[rev].get.ts', 'GET [id]/revisions/index.get.ts', 'GET _export.get.ts',
      'GET _tree.get.ts', 'GET index.get.ts', 'GET options.get.ts', 'PATCH [id].patch.ts', 'POST _move.post.ts', 'POST _order.post.ts', 'POST index.post.ts',
    ].sort())
    const content = join(repoRoot, 'packages/cms/server/api/content')
    for (const f of ['[entity]/index.get.ts', '[entity]/[slug].get.ts', '_tree/[entity].get.ts', '_global/[name].get.ts']) expect(readdirSync(content, { recursive: true }), f).toContain(f)
  })

  it('A\'s types are 404 on B in every admin and content route, called as B\'s own administrator', async () => {
    const { failures, calls } = await sweep(t.b, adminB, ['x_course', 'x_event'])
    expect(failures).toEqual([])
    expect(calls).toBeGreaterThan(30)
  })

  it('B\'s type is 404 on A in every admin and content route, called as A\'s own administrator', async () => {
    const { failures, calls } = await sweep(t.a, adminA, ['x_recipe'])
    expect(failures).toEqual([])
    expect(calls).toBeGreaterThan(15)
  })

  it('the same routes answer for the types a site has (so the 404 above is the model\'s, not the route\'s)', async () => {
    for (const [site, admin, own] of [[t.a, adminA, 'x_course'], [t.b, adminB, 'x_recipe']] as const) {
      expect((await admin.get(`/api/cms/${own}`)).status, `${site.id} list`).toBe(200)
      expect((await admin.get(`/api/cms/${own}/options`)).status, `${site.id} options`).toBe(200)
      expect((await admin.get(`/api/cms/${own}/${UUID_NOWHERE}`)).status, `${site.id} one`).toBe(404) // an entry that is not there: 404 for another reason
      expect((await get(site, `/api/content/${own}`)).status, `${site.id} content`).toBe(200)
    }
  })

  it('B\'s graph, generated types, API description, search and sitemap name nothing of A\'s, and the other way round', async () => {
    const namesOf = (g: any[]) => g.map((e) => e.name as string)
    expect(namesOf(await graph(adminB))).not.toEqual(expect.arrayContaining(['x_course']))
    expect(namesOf(await graph(adminB)).filter((n) => n.startsWith('x_'))).toEqual(['x_recipe'])
    expect(namesOf(await graph(adminA)).filter((n) => n.startsWith('x_')).sort()).toEqual(['x_course', 'x_event'])

    const typesA = (await get(t.a, '/api/content-types.ts')).text
    const typesB = (await get(t.b, '/api/content-types.ts')).text
    expect(typesB).toMatch(/\bXRecipe\b/)
    expect(typesB).not.toMatch(/XCourse|XEvent|x_course|x_event|teacher/)
    expect(typesA).not.toMatch(/XRecipe|x_recipe|minutes/)

    const apiA = JSON.stringify((await get(t.a, '/api/openapi.json')).body)
    const apiB = JSON.stringify((await get(t.b, '/api/openapi.json')).body)
    expect(apiB).toContain('x_recipe')
    expect(apiB).not.toMatch(/x_course|x_event|XCourse|XEvent/)
    expect(apiA).not.toMatch(/x_recipe|XRecipe/)

    // Search: each site's word is found at home and never on the other.
    await until('B\'s search to find the recipe', async () => (await get(t.b, `/api/content/_search?q=${WORD.b}`)).body?.items ?? [], (items: any[]) => items.length > 0, 10_000)
    expect((await get(t.b, `/api/content/_search?q=${WORD.b}`)).body.items.map((i: any) => [i.entity, i.path])).toEqual([['x_recipe', `/recepty/${recipe.slug}`]])
    expect((await adminB.get(`/api/cms/_search?q=${WORD.b}`)).body.items.map((i: any) => [i.entity, i.id])).toEqual([['x_recipe', recipe.id]])
    expect((await get(t.a, `/api/content/_search?q=${WORD.b}`)).body.items).toEqual([])
    expect((await adminA.get(`/api/cms/_search?q=${WORD.b}`)).body.items).toEqual([])
    expect((await get(t.b, `/api/content/_search?q=${WORD.a}`)).body.items).toEqual([])
    expect((await adminB.get(`/api/cms/_search?q=${WORD.a}`)).body.items).toEqual([])
    expect((await get(t.a, `/api/content/_search?q=${WORD.b}&entity=x_recipe`)).body.items).toEqual([])
    const entities = async (site: TenantSite) => (await siteQuery(site, 'select distinct entity from cms_search order by entity')).map((r) => r.entity as string)
    expect((await entities(t.b)).filter((e) => e.startsWith('x_'))).toEqual(['x_recipe'])
    expect((await entities(t.a)).filter((e) => e.startsWith('x_'))).toEqual(['x_course'])

    // Sitemap: B lists the recipe and nothing of A, A the course and nothing of B.
    const b = await get(t.b, '/sitemap.xml')
    const locsB = [...b.text.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]!)
    expect(locsB).toContain(`${t.b.url}/recepty/${recipe.slug}`)
    for (const loc of locsB) expect(loc.startsWith(`${t.b.url}/`), loc).toBe(true)
    expect(b.text).not.toMatch(/kurzy|akce|python/)
    const a = await get(t.a, '/sitemap.xml')
    expect(a.text).toContain(`${t.a.url}/kurzy/python`)
    expect(a.text).not.toMatch(/recepty|polevka/)
  })

  it('each database holds only its own custom tables and its own model versions, and B had no versions until it changed its structure', async () => {
    const x = (all: string[]) => all.filter((n) => n.startsWith('x_'))
    const a = x(await tablesOf(t.a))
    const b = x(await tablesOf(t.b))
    expect(a.length).toBeGreaterThan(0)
    expect(b.length).toBeGreaterThan(0)
    for (const name of a) expect(name, `A's table ${name}`).toMatch(/^x_(course|event)(_|$)/)
    for (const name of b) expect(name, `B's table ${name}`).toMatch(/^x_recipe(_|$)/)
    expect(a).toEqual(expect.arrayContaining(['x_course', 'x_event']))
    expect(b).toContain('x_recipe')

    const docsOf = async (site: TenantSite) => (await siteQuery(site, 'select version, doc from cms_model order by version')).map((r) => ({ version: r.version as number, types: (r.doc.types as any[]).map((x) => x.name as string) }))
    const docsA = await docsOf(t.a)
    const docsB = await docsOf(t.b)
    expect(docsB.map((d) => d.version)).toEqual([1, 2])
    for (const d of docsB) expect(d.types).toEqual(['x_recipe'])
    for (const d of docsA) for (const name of d.types) expect(name).toMatch(/^x_(course|event)$/)
    expect(docsA.at(-1)!.types).toEqual(['x_course', 'x_event'])
    // The design's own tables are the same on both: nothing of the other site's came in.
    expect(await columnsOf(t.b, 'x_recipe')).toEqual(expect.arrayContaining(['id', 'title', 'slug', 'status', 'minutes']))
    expect(await columnsOf(t.b, 'x_recipe')).not.toContain('teacher')
    expect(await columnsOf(t.a, 'x_course')).toEqual(expect.arrayContaining(['id', 'title', 'slug', 'status', 'level', 'teacher']))
    expect(await columnsOf(t.a, 'x_course')).not.toContain('minutes')
    expect(await siteQuery(t.b, `select 1 from information_schema.tables where table_name = 'x_course'`)).toEqual([])
  })
})

describe('a change on one site leaves the other alone', () => {
  it('keeps B\'s instance when A changes (a request to B and to A in between), while A has a new one', async () => {
    expect((await get(t.b, '/api/content/x_recipe')).status).toBe(200)
    expect((await get(t.a, '/api/content/x_course')).status).toBe(200)
    const before = { a: await seen(t.ipUrl, 'site-a'), b: await seen(t.ipUrl, 'site-b') }
    expect(before.a.loaded).toBe(true)
    expect(before.b.loaded).toBe(true)

    const started = performance.now()
    await mustChange(adminA, [{ op: 'field.add', type: 'x_event', field: textField('place') }])
    console.info(`[timing] a structure change on A while B is loaded: ${(performance.now() - started).toFixed(0)} ms (version read and change)`)
    // B answers during and after it, from the instance it had.
    expect((await get(t.b, '/api/content/x_recipe')).status).toBe(200)
    expect((await adminB.get('/api/cms/x_recipe')).status).toBe(200)
    const mid = await seen(t.ipUrl, 'site-b')
    expect(mid.loads).toBe(before.b.loads)
    expect(mid.loaded).toBe(true)

    // A's next request makes its new instance, with the new field.
    expect(await fieldKeys(adminA, 'x_event')).toContain('place')
    const after = { a: await seen(t.ipUrl, 'site-a'), b: await seen(t.ipUrl, 'site-b') }
    expect(after.b.loads).toBe(before.b.loads)
    expect(after.a.loads).toBe(before.a.loads + 1)
    expect(after.b.model).toEqual(before.b.model)
    expect(after.a.model!.version).toBe(before.a.model!.version + 1)
    // B's model is as it was.
    expect(await fieldKeys(adminB, 'x_recipe')).not.toContain('place')
  })
})

describe('a request under way while the structure changes', () => {
  it('ends well with the model it started with, and the next request sees the new model', async () => {
    const db = new pg.Client({ connectionString: t.a.databaseUrl })
    await db.connect()
    let pending: Promise<{ status: number; body: any }> | undefined
    try {
      await db.query('begin')
      await db.query('select id from x_course where id = $1 for update', [course.id])
      let settled = false
      pending = adminA.patch(`/api/cms/x_course/${course.id}`, { title: `Kurz ${WORD.a} (změněno)` })
      void pending.then(() => { settled = true }, () => { settled = true })
      await sleep(300)
      expect(settled, 'the update waits for the row the test holds').toBe(false)

      // The structure of ANOTHER type changes while the update waits.
      const res = await change(adminA, [{ op: 'field.add', type: 'x_event', field: textField('city') }])
      expect(res.status, JSON.stringify(res.body)).toBe(200)
      expect(settled, 'the update is still waiting after the change').toBe(false)
      await db.query('commit')
    }
    finally {
      await db.query('rollback').catch(() => {})
      await db.end()
    }
    const done = await pending!
    expect(done.status, JSON.stringify(done.body)).toBe(200)
    expect(done.body.row.title).toBe(`Kurz ${WORD.a} (změněno)`)
    expect((await siteQuery(t.a, 'select title from x_course where id = $1', [course.id]))[0].title).toBe(`Kurz ${WORD.a} (změněno)`)
    await adminA.patch(`/api/cms/x_course/${course.id}`, { title: `Kurz ${WORD.a}` })
    // The new request is served by the new model.
    expect(await fieldKeys(adminA, 'x_event')).toContain('city')
    expect((await get(t.a, '/api/content/x_course/python')).status).toBe(200)
  })

  it('refuses a change of the type itself while its row is locked (busy, within about 2 s), and the site answers normally afterwards', async () => {
    const before = await model(adminA)
    const db = new pg.Client({ connectionString: t.a.databaseUrl })
    await db.connect()
    try {
      await db.query('begin')
      await db.query('select id from x_course where id = $1 for update', [course.id])
      const started = performance.now()
      const res = await adminA.post('/api/cms/_model', { baseVersion: before.version, ops: [{ op: 'field.add', type: 'x_course', field: textField('notes') }] })
      const took = performance.now() - started
      console.info(`[timing] a change that meets a locked table is refused as busy after ${took.toFixed(0)} ms`)
      expect(res.status, JSON.stringify(res.body)).toBe(503)
      expect(res.body.data.code).toBe('busy')
      expect(took).toBeLessThan(4000)
      expect(took).toBeGreaterThan(1500)
    }
    finally {
      await db.query('rollback').catch(() => {})
      await db.end()
    }
    // Nothing was changed, and the site serves.
    const after = await model(adminA)
    expect(after.version).toBe(before.version)
    expect(await columnsOf(t.a, 'x_course')).not.toContain('notes')
    expect((await get(t.a, '/api/content/x_course/python')).status).toBe(200)
    expect((await adminA.patch(`/api/cms/x_course/${course.id}`, { teacher: 'Ada' })).status).toBe(200)
    // And the same change goes through once the lock is gone.
    expect((await change(adminA, [{ op: 'field.add', type: 'x_course', field: textField('notes') }])).status).toBe(200)
    expect(await columnsOf(t.a, 'x_course')).toContain('notes')
  })
})

describe('a fresh instance of a site', () => {
  it('waits for the site\'s own types before it answers the site\'s first request', async () => {
    // The test holds the table of model versions, so a process that starts now cannot read A's types yet.
    const db = new pg.Client({ connectionString: t.a.databaseUrl })
    await db.connect()
    let extra: Awaited<ReturnType<Tenants['startInstance']>> | undefined
    let pending: Promise<{ status: number; body: any }> | undefined
    try {
      await db.query('begin')
      await db.query('lock table cms_model in access exclusive mode')
      extra = await t.startInstance()
      let settled = false
      pending = get({ url: `http://${t.a.host}:${extra.port}` }, '/api/content/x_course/python')
      void pending.then(() => { settled = true }, () => { settled = true })
      await sleep(500)
      // It neither answers without the types (a 404 for x_course) nor fails: it waits.
      expect(settled, 'the first request waits for the site\'s own types').toBe(false)
      await db.query('commit')
      const res = await pending
      expect(res.status, JSON.stringify(res.body)).toBe(200)
      expect(res.body.item.teacher).toBe('Ada')
      // B, which has its own types too, is served by the same process.
      expect((await get({ url: `http://${t.b.host}:${extra.port}` }, `/api/content/x_recipe/${recipe.slug}`)).status).toBe(200)
    }
    finally {
      await db.query('rollback').catch(() => {})
      await db.end()
      await pending?.catch(() => {})
      await extra?.server.stop()
    }
    expectNoSiteErrors(extra)
  }, 60_000)
})

describe('the function', () => {
  it('refuses a change made against an old version with the current one, and changes nothing', async () => {
    const m = await model(adminA)
    expect(m.version).toBeGreaterThan(1)
    const tables = await tablesOf(t.a)
    const res = await adminA.post('/api/cms/_model', { baseVersion: m.version - 1, ops: [{ op: 'type.add', name: 'x_stale', label: text('Stale') }] })
    expect(res.status, JSON.stringify(res.body)).toBe(409)
    expect(res.body.data).toMatchObject({ code: 'stale-version', version: m.version })
    expect((await model(adminA)).version).toBe(m.version)
    expect(await tablesOf(t.a)).toEqual(tables)
    // A version that was never made is stale too.
    const ahead = await adminA.post('/api/cms/_model', { baseVersion: m.version + 5, ops: [{ op: 'type.add', name: 'x_stale', label: text('Stale') }] })
    expect(ahead.status).toBe(409)
    expect(ahead.body.data.code).toBe('stale-version')
  })

  it('changes nothing in a dry run', async () => {
    const m = await model(adminA)
    const tables = await tablesOf(t.a)
    const history = (await adminA.get('/api/cms/_model/history')).body.length
    const res = await adminA.post('/api/cms/_model', { baseVersion: m.version, dryRun: true, ops: [
      { op: 'type.add', name: 'x_ghost', label: text('Ghosts'), page: { prefix: 'duchove' } },
      { op: 'field.add', type: 'x_course', field: textField('ghostly') },
    ] })
    expect(res.status, JSON.stringify(res.body)).toBe(200)
    expect(res.body.dryRun).toBe(true)
    expect(res.body.statements).toBeGreaterThan(0)
    expect(res.body.doc.types.map((x: any) => x.name)).toContain('x_ghost')
    const after = await model(adminA)
    expect(after.version).toBe(m.version)
    expect(after.doc.types.map((x: any) => x.name)).not.toContain('x_ghost')
    expect(await tablesOf(t.a)).toEqual(tables)
    expect(await columnsOf(t.a, 'x_course')).not.toContain('ghostly')
    expect((await adminA.get('/api/cms/_model/history')).body).toHaveLength(history)
    expect((await get(t.a, '/api/content/x_ghost')).status).toBe(404)
    // A dry run that would be refused says so, as the real one does.
    const refused = await adminA.post('/api/cms/_model', { baseVersion: m.version, dryRun: true, ops: [{ op: 'type.add', name: 'post', label: text('Posts') }] })
    expect(refused.status).toBe(422)
  })

  it('refuses a second type over the site\'s limit (the limit is the site\'s own, from its row)', async () => {
    try {
      await t.writeDirectory([t.rows[0], { ...t.rows[1], config: { ...t.rows[1].config, customTypes: { types: 1 } } }])
      await until('B to use its limit', async () => (await adminB.get('/api/cms/_model')).body?.limits, (l: any) => l?.types === 1, 8000)
      const m = await model(adminB)
      expect(m.used).toEqual({ types: 1 })
      const res = await adminB.post('/api/cms/_model', { baseVersion: m.version, ops: [{ op: 'type.add', name: 'x_second', label: text('Second') }] })
      expect(res.status, JSON.stringify(res.body)).toBe(422)
      expect(res.body.data.code).toBe('limit-types')
      expect(res.body.data.op).toBe(0)
      expect(await tablesOf(t.b)).not.toContain('x_second')
      // A's limit is the default, whatever B's row says.
      expect((await model(adminA)).limits.types).toBe(12)
    }
    finally {
      await t.writeDirectory(t.rows)
    }
    await until('B to use the default limit again', async () => (await adminB.get('/api/cms/_model')).body?.limits, (l: any) => l?.types === 12, 8000)
    const lifted = await change(adminB, [{ op: 'type.add', name: 'x_second', label: text('Second') }], { dryRun: true })
    expect(lifted.status, JSON.stringify(lifted.body)).toBe(200)
  })

  it('is for administrators only', async () => {
    const editor = siteClient(t.a, 'editor')
    const author = siteClient(t.a, 'author')
    const anonymous = siteClient(t.a)
    const m = await model(adminA)
    const body = { baseVersion: m.version, ops: [{ op: 'type.add', name: 'x_nope', label: text('Nope') }] }
    for (const path of ['/api/cms/_model', '/api/cms/_model/history', '/api/cms/_model/usage?type=x_course']) {
      expect((await editor.get(path)).status, `editor GET ${path}`).toBe(403)
      expect((await author.get(path)).status, `author GET ${path}`).toBe(403)
      expect((await anonymous.get(path)).status, `anonymous GET ${path}`).toBe(401)
    }
    expect((await editor.post('/api/cms/_model', body)).status).toBe(403)
    expect((await author.post('/api/cms/_model', body)).status).toBe(403)
    expect((await anonymous.post('/api/cms/_model', body)).status).toBe(401)
    // An administrator of the other site is not one here.
    expect((await siteClient(t.b, { cookie: t.a.cookies.admin }).get('/api/cms/_model')).status).toBe(401)
    expect(await tablesOf(t.a)).not.toContain('x_nope')
    expect((await model(adminA)).version).toBe(m.version)
  })

  it('does nothing for a site that has the switch off: no route, no table, no version, and the site serves its type again when it is on', async () => {
    const tables = await tablesOf(t.b)
    const versions = (await siteQuery(t.b, 'select version from cms_model order by version')).map((r) => r.version)
    try {
      await t.writeDirectory([t.rows[0], { ...t.rows[1], config: { ...t.rows[1].config, customTypes: { enabled: false } } }])
      await until('B\'s model to go', async () => (await adminB.get('/api/cms/_model')).status, (s) => s === 404, 8000)
      expect((await adminB.get('/api/cms/_model')).status).toBe(404)
      expect((await adminB.post('/api/cms/_model', { baseVersion: versions.at(-1), ops: [{ op: 'type.add', name: 'x_off', label: text('Off') }] })).status).toBe(404)
      expect((await adminB.get('/api/cms/_model/history')).status).toBe(404)
      // The menu has no row for it, and is the menu of a site without the feature.
      const menuOff = (await adminB.get('/api/cms/_menu')).body
      expect(menuKeys(menuOff)).not.toContain('@model')
      expect(menuOff.settings.slice(-3)).toEqual(['@team', '@privacy', '@about'])
      expect((await adminB.get('/api/cms/x_recipe')).status).toBe(404)
      expect((await get(t.b, '/api/content/x_recipe')).status).toBe(404)
      expect((await get(t.b, '/api/content/x_recipe/polevka')).status).toBe(404)
      expect((await graph(adminB)).map((e) => e.name)).not.toContain('x_recipe')
      expect((await get(t.b, '/api/content-types.ts')).text).not.toMatch(/XRecipe/)
      // A is not touched.
      expect((await adminA.get('/api/cms/_model')).status).toBe(200)
      expect((await get(t.a, '/api/content/x_course')).status).toBe(200)
      expect(await tablesOf(t.b)).toEqual(tables)
      expect((await siteQuery(t.b, 'select version from cms_model order by version')).map((r) => r.version)).toEqual(versions)
    }
    finally {
      await t.writeDirectory(t.rows)
    }
    await until('B to serve its type again', async () => (await get(t.b, '/api/content/x_recipe')).status, (s) => s === 200, 8000)
    expect((await adminB.get('/api/cms/_model')).status).toBe(200)
    expect((await get(t.b, '/api/content/x_recipe/polevka')).body.item.title).toBe(`Polévka ${WORD.b}`)
    expect((await adminB.get('/api/cms/x_recipe')).status).toBe(200)
  })

  it('keeps a history of the versions, newest first, with who made them', async () => {
    const m = await model(adminA)
    const history = await adminA.get('/api/cms/_model/history')
    expect(history.status).toBe(200)
    expect(Array.isArray(history.body)).toBe(true)
    const versions = history.body.map((h: any) => h.version)
    expect(versions[0]).toBe(m.version)
    expect(versions).toEqual([...versions].sort((a, b) => b - a))
    expect(new Set(versions).size).toBe(versions.length)
    const dates = history.body.map((h: any) => Date.parse(h.at))
    expect(dates).toEqual([...dates].sort((a, b) => b - a))
    expect(history.body[0].by).toEqual({ id: t.a.users.admin, name: expect.any(String) })
    expect(history.body[0].by.name).not.toBe('')
    const first = history.body.at(-1)
    expect(first.version).toBe(1)
    expect(first.ops[0]).toMatchObject({ op: 'type.add', name: 'x_course' })
    // B's history is B's own.
    const b = (await adminB.get('/api/cms/_model/history')).body
    expect(b.map((h: any) => h.version)).toEqual([2, 1])
    expect(JSON.stringify(b)).not.toContain('x_course')
    expect(b[0].ops[0]).toMatchObject({ op: 'field.add', type: 'x_recipe' })
  })
})

describe('what the function refuses', () => {
  it('lets nothing reach the database that part 1 refuses: the tables, the columns and the version stay as they were', async () => {
    const m = await model(adminA)
    const tables = await tablesOf(t.a)
    const columns = { course: await columnsOf(t.a, 'x_course'), event: await columnsOf(t.a, 'x_event'), post: await columnsOf(t.a, 'post'), users: await columnsOf(t.a, 'cms_users') }
    const refusals: [string, unknown[], string?][] = [
      ['a changed kind', [{ op: 'field.update', type: 'x_course', key: 'teacher', kind: 'number' }], 'not-changeable'],
      ['a changed field type', [{ op: 'field.update', type: 'x_course', key: 'teacher', fieldType: 'number' }], 'not-changeable'],
      ['a changed target', [{ op: 'field.update', type: 'x_course', key: 'author', to: 'post' }], 'not-changeable'],
      ['a renamed type', [{ op: 'type.update', type: 'x_course', name: 'x_class' }], 'not-changeable'],
      ['a changed publish', [{ op: 'type.update', type: 'x_course', publish: false }], 'not-changeable'],
      ['pages switched off', [{ op: 'type.update', type: 'x_course', page: null }], 'not-changeable'],
      ['a changed address', [{ op: 'type.update', type: 'x_course', page: { prefix: 'classes' } }], 'not-changeable'],
      ['a name of the design', [{ op: 'type.add', name: 'post', label: text('Posts') }]],
      ['a name without the prefix', [{ op: 'type.add', name: 'courses', label: text('Courses') }], 'invalid-name'],
      ['a name that is a statement', [{ op: 'type.add', name: 'x_a"; drop table post; --', label: text('Drop') }], 'invalid-name'],
      ['a name of a table of tinyzoo', [{ op: 'type.add', name: 'cms_users', label: text('Users') }], 'invalid-name'],
      ['a name taken', [{ op: 'type.add', name: 'x_course', label: text('Again') }], 'name-taken'],
      ['an address taken', [{ op: 'type.add', name: 'x_other', label: text('Other'), page: { prefix: 'kurzy' } }], 'prefix-taken'],
      ['an operation of the server only', [{ op: 'purge', types: ['x_course'] }], 'internal-only'],
      ['an unknown operation', [{ op: 'drop.table', type: 'post' }], 'invalid-op'],
      ['a type of the design', [{ op: 'field.add', type: 'post', field: textField('extra') }]],
      ['a type of the design removed', [{ op: 'type.remove', type: 'post' }]],
      ['a field of the design removed', [{ op: 'field.remove', type: 'post', key: 'title' }]],
      ['a field that is made by tinyzoo', [{ op: 'field.remove', type: 'x_course', key: 'slug' }], 'system-field'],
      ['the title removed', [{ op: 'field.remove', type: 'x_course', key: 'title' }], 'title-field'],
      ['a required field with entries', [{ op: 'field.add', type: 'x_course', field: textField('must', { required: true }) }], 'needs-optional'],
      ['a field made required with entries missing', [{ op: 'field.update', type: 'x_course', key: 'notes', required: true }], 'has-missing-values'],
      ['a field twice', [{ op: 'field.add', type: 'x_course', field: textField('teacher') }]],
      ['a relation to a type that is not there', [{ op: 'field.add', type: 'x_course', field: { key: 'friend', type: 'relation', to: 'x_nowhere', label: text('Friend') } }]],
      ['a good change followed by a bad one', [{ op: 'field.add', type: 'x_course', field: textField('half') }, { op: 'field.update', type: 'x_course', key: 'teacher', kind: 'number' }], 'not-changeable'],
    ]
    for (const [what, ops, code] of refusals) {
      const res = await adminA.post('/api/cms/_model', { baseVersion: m.version, ops })
      expect(res.status, `${what}: ${JSON.stringify(res.body)}`).toBe(422)
      if (code) expect(res.body.data.code, what).toBe(code)
    }
    // A request that is not an operation at all.
    for (const body of [{ baseVersion: m.version, ops: [] }, { baseVersion: m.version, ops: ['drop table post'] }, { baseVersion: 'x', ops: [] }, { ops: [{ op: 'type.remove', type: 'x_course' }] }, { baseVersion: m.version, ops: [{ op: 'type.remove', type: 'x_course' }], extra: 1 }]) {
      const res = await adminA.post('/api/cms/_model', body)
      expect([400, 422], JSON.stringify(body)).toContain(res.status)
    }

    expect((await model(adminA)).version).toBe(m.version)
    expect(await tablesOf(t.a)).toEqual(tables)
    expect(await columnsOf(t.a, 'x_course')).toEqual(columns.course)
    expect(await columnsOf(t.a, 'x_event')).toEqual(columns.event)
    expect(await columnsOf(t.a, 'post')).toEqual(columns.post)
    expect(await columnsOf(t.a, 'cms_users')).toEqual(columns.users)
    expect((await siteQuery(t.a, 'select count(*)::int n from cms_model'))[0].n).toBe(m.version)
    // The site serves as before.
    expect((await get(t.a, '/api/content/x_course/python')).body.item.teacher).toBe('Ada')
  })
})

describe('hiding and restoring', () => {
  it('hides a field from the graph, the content API and the generated types while its column keeps the values, and restore brings them back', async () => {
    const hid = await change(adminA, [{ op: 'field.remove', type: 'x_course', key: 'level' }])
    expect(hid.status, JSON.stringify(hid.body)).toBe(200)
    try {
      expect(await fieldKeys(adminA, 'x_course')).not.toContain('level')
      const item = (await get(t.a, '/api/content/x_course/python')).body.item
      expect(item).not.toHaveProperty('level')
      expect(item.teacher).toBe('Ada')
      expect(/export interface XCourse \{[^]*?\n\}/.exec((await get(t.a, '/api/content-types.ts')).text)?.[0]).not.toContain('level')
      expect(JSON.stringify((await get(t.a, '/api/openapi.json')).body.components.schemas.XCourse)).not.toContain('level')
      // The column and its value are in the database; the model says it is removed.
      expect((await siteQuery(t.a, `select level from x_course where slug = 'python'`))[0].level).toBe('beginner')
      const m = await model(adminA)
      expect(m.doc.types.find((x: any) => x.name === 'x_course').fields.find((f: any) => f.key === 'level').removedAt).toBeTruthy()
      // A write that no longer knows the field leaves its value alone, and the field cannot be sent.
      expect((await adminA.patch(`/api/cms/x_course/${course.id}`, { teacher: 'Ada' })).status).toBe(200)
      expect((await siteQuery(t.a, `select level from x_course where slug = 'python'`))[0].level).toBe('beginner')
      // Its name is still taken.
      expect((await change(adminA, [{ op: 'field.add', type: 'x_course', field: textField('level') }])).status).toBe(422)
    }
    finally {
      const back = await change(adminA, [{ op: 'field.restore', type: 'x_course', key: 'level' }])
      expect(back.status, JSON.stringify(back.body)).toBe(200)
    }
    expect(await fieldKeys(adminA, 'x_course')).toContain('level')
    expect((await get(t.a, '/api/content/x_course/python')).body.item.level).toBe('beginner')
    expect((await adminA.get(`/api/cms/x_course/${course.id}`)).body.row.level).toBe('beginner')
    expect(/export interface XCourse \{[^]*?\n\}/.exec((await get(t.a, '/api/content-types.ts')).text)?.[0]).toContain('level')
  })

  it('lets a new entry be saved without a required text field that is hidden, and brings it back optional when entries lack it', async () => {
    const hid = await change(adminA, [{ op: 'field.remove', type: 'x_course', key: 'teacher' }])
    expect(hid.status, JSON.stringify(hid.body)).toBe(200)
    let extra: string | undefined
    try {
      const made = await adminA.post('/api/cms/x_course', { title: 'Bez učitele', slug: 'bez-ucitele', status: 'draft' })
      expect(made.status, JSON.stringify(made.body)).toBe(201)
      extra = made.body.row.id
      expect((await siteQuery(t.a, 'select teacher from x_course where id = $1', [extra]))[0].teacher).toBeNull()
      expect((await siteQuery(t.a, `select teacher from x_course where slug = 'python'`))[0].teacher).toBe('Ada')
    }
    finally {
      const back = await change(adminA, [{ op: 'field.restore', type: 'x_course', key: 'teacher' }])
      expect(back.status, JSON.stringify(back.body)).toBe(200)
      expect(back.body.notes.map((n: any) => n.code)).toContain('restored-optional')
    }
    const teacher = (await graphEntity(adminA, 'x_course')).fields.find((f: any) => f.key === 'teacher')
    expect(teacher.required).toBeFalsy()
    expect((await get(t.a, '/api/content/x_course/python')).body.item.teacher).toBe('Ada')
    // Clean up: the entry without a teacher goes, and the field can be required again.
    expect((await adminA.delete(`/api/cms/x_course/${extra}`)).status).toBe(200)
    expect((await change(adminA, [{ op: 'field.update', type: 'x_course', key: 'teacher', required: true }])).status).toBe(200)
    expect((await adminA.post('/api/cms/x_course', { title: 'Zase bez', slug: 'zase-bez' })).status).toBe(422)
  })

  it('does not remove a type that another type\'s field points at, and says which field', async () => {
    await mustChange(adminA, [
      { op: 'type.add', name: 'x_lesson', label: text('Lessons'), labelSingular: text('Lesson') },
      { op: 'field.add', type: 'x_lesson', field: { key: 'course', type: 'relation', to: 'x_course', label: text('Course') } },
    ])
    const m = await model(adminA)
    const res = await adminA.post('/api/cms/_model', { baseVersion: m.version, ops: [{ op: 'type.remove', type: 'x_course' }] })
    expect(res.status, JSON.stringify(res.body)).toBe(422)
    expect(res.body.data.code).toBe('points-at-type')
    expect(res.body.data.details.fields).toEqual([{ type: 'x_lesson', key: 'course' }])
    expect(res.body.data.op).toBe(0)
    expect(res.body.data.message).toContain('course')
    expect((await model(adminA)).version).toBe(m.version)
    expect((await get(t.a, '/api/content/x_course/python')).status).toBe(200)
    // The lesson itself can point at a course.
    const lesson = await adminA.post('/api/cms/x_lesson', { title: 'První hodina', course: course.id })
    expect(lesson.status, JSON.stringify(lesson.body)).toBe(201)
    expect((await adminA.delete(`/api/cms/x_lesson/${lesson.body.row.id}`)).status).toBe(200)
  })

  it('does not remove a type that content links to, names the entry that links, and removes it once the link is gone', async () => {
    await mustChange(adminA, [{ op: 'type.add', name: 'x_note', label: text('Notes'), labelSingular: text('Note') }])
    const note = await adminA.post('/api/cms/x_note', { title: 'Poznámka' })
    expect(note.status, JSON.stringify(note.body)).toBe(201)
    const link = (id: string) => ({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Viz poznámku', marks: [{ type: 'link', attrs: { href: `cms:x_note/${id}` } }] }] }] })
    const linker = await createAuthor(adminA, { name: 'Autor s odkazem', bio: link(note.body.row.id) })
    expect(JSON.stringify((await adminA.get(`/api/cms/author/${linker.id}`)).body.row.bio)).toContain(`cms:x_note/${note.body.row.id}`)

    const usage = await adminA.get('/api/cms/_model/usage?type=x_note')
    expect(usage.status).toBe(200)
    expect(usage.body.places).toEqual([expect.objectContaining({ entity: 'author', id: linker.id, title: 'Autor s odkazem', field: 'bio' })])

    const m = await model(adminA)
    const res = await adminA.post('/api/cms/_model', { baseVersion: m.version, ops: [{ op: 'type.remove', type: 'x_note' }] })
    expect(res.status, JSON.stringify(res.body)).toBe(409)
    expect(res.body.data.code).toBe('in-use')
    expect(res.body.data.places).toEqual([expect.objectContaining({ entity: 'author', id: linker.id, field: 'bio', admin: `/admin/author/${linker.id}` })])
    expect((await model(adminA)).version).toBe(m.version)
    expect((await get(t.a, '/api/content/x_course')).status).toBe(200)

    // Without the link the type can go (and comes back).
    expect((await adminA.patch(`/api/cms/author/${linker.id}`, { bio: doc('Bez odkazu') })).status).toBe(200)
    expect((await adminA.get('/api/cms/_model/usage?type=x_note')).body.places).toEqual([])
    expect((await change(adminA, [{ op: 'type.remove', type: 'x_note' }])).status).toBe(200)
    expect((await adminA.get('/api/cms/x_note')).status).toBe(404)
    expect((await graph(adminA)).map((e) => e.name)).not.toContain('x_note')
    expect((await siteQuery(t.a, 'select title from x_note')).map((r) => r.title)).toEqual(['Poznámka'])
    expect((await change(adminA, [{ op: 'type.restore', type: 'x_note' }])).status).toBe(200)
    expect((await adminA.get('/api/cms/x_note')).body.rows.map((r: any) => r.title)).toEqual(['Poznámka'])
  })
})

describe('the later deletion', () => {
  it('deletes an empty hidden field after the short time and one with content after the longer one, then frees the name', async () => {
    await mustChange(adminA, [{ op: 'field.add', type: 'x_course', field: textField('tmpEmpty') }, { op: 'field.add', type: 'x_course', field: textField('tmpFull') }])
    expect((await adminA.patch(`/api/cms/x_course/${course.id}`, { tmpFull: 'keep me' })).status).toBe(200)
    expect(await columnsOf(t.a, 'x_course')).toEqual(expect.arrayContaining(['tmp_empty', 'tmp_full']))

    const hid = await change(adminA, [{ op: 'field.remove', type: 'x_course', key: 'tmpEmpty' }, { op: 'field.remove', type: 'x_course', key: 'tmpFull' }])
    expect(hid.status, JSON.stringify(hid.body)).toBe(200)
    const hiddenAt = performance.now()
    expect(await columnsOf(t.a, 'x_course')).toEqual(expect.arrayContaining(['tmp_empty', 'tmp_full']))

    // The empty one goes after the short time; requests meanwhile keep a loaded instance there to look.
    let emptyGoneAfter = 0
    await until('the empty hidden column to be deleted', async () => { await adminA.get('/api/cms/_model'); return columnsOf(t.a, 'x_course') }, (cols) => !cols.includes('tmp_empty'), PURGE_MS)
    emptyGoneAfter = performance.now() - hiddenAt
    expect(emptyGoneAfter).toBeGreaterThanOrEqual(PURGE_EMPTY_MS - 500)
    // The one with content is still there, with its value.
    expect(await columnsOf(t.a, 'x_course')).toContain('tmp_full')
    expect((await siteQuery(t.a, 'select tmp_full from x_course where id = $1', [course.id]))[0].tmp_full).toBe('keep me')
    let m = await model(adminA)
    expect(m.doc.types.find((x: any) => x.name === 'x_course').fields.map((f: any) => f.key)).not.toContain('tmpEmpty')
    expect(m.doc.types.find((x: any) => x.name === 'x_course').fields.map((f: any) => f.key)).toContain('tmpFull')

    // It goes after the longer one.
    await until('the hidden column with content to be deleted', async () => { await adminA.get('/api/cms/_model'); return columnsOf(t.a, 'x_course') }, (cols) => !cols.includes('tmp_full'), PURGE_MS + 8000)
    const fullGoneAfter = performance.now() - hiddenAt
    expect(fullGoneAfter).toBeGreaterThanOrEqual(PURGE_MS - 500)
    console.info(`[timing] later deletion (test knobs ${PURGE_EMPTY_MS} ms / ${PURGE_MS} ms): the empty field went after ${emptyGoneAfter.toFixed(0)} ms, the one with content after ${fullGoneAfter.toFixed(0)} ms`)
    m = await model(adminA)
    expect(m.doc.types.find((x: any) => x.name === 'x_course').fields.map((f: any) => f.key)).not.toContain('tmpFull')
    expect(await columnsOf(t.a, 'x_course')).toEqual(expect.arrayContaining(['id', 'title', 'slug', 'status', 'level', 'teacher']))

    // The name is free again.
    expect((await change(adminA, [{ op: 'field.add', type: 'x_course', field: textField('tmpEmpty') }, { op: 'field.add', type: 'x_course', field: textField('tmpFull') }])).status).toBe(200)
    expect(await columnsOf(t.a, 'x_course')).toEqual(expect.arrayContaining(['tmp_empty', 'tmp_full']))
    expect((await siteQuery(t.a, 'select tmp_full from x_course where id = $1', [course.id]))[0].tmp_full).toBeNull()
    // The sweep is the server's own: B was not touched by it.
    expect((await model(adminB)).doc.types[0].fields.every((f: any) => !f.removedAt)).toBe(true)
  }, 60_000)

  it('deletes a hidden type with its table once it is due, and only when nothing points at it', async () => {
    await mustChange(adminA, [{ op: 'type.add', name: 'x_tmp', label: text('Temporary') }])
    expect(await tablesOf(t.a)).toContain('x_tmp')
    const hid = await change(adminA, [{ op: 'type.remove', type: 'x_tmp' }])
    expect(hid.status, JSON.stringify(hid.body)).toBe(200)
    await until('the hidden type to be deleted', async () => { await adminA.get('/api/cms/_model'); return tablesOf(t.a) }, (tables) => !tables.includes('x_tmp'), PURGE_MS)
    expect((await model(adminA)).doc.types.map((x: any) => x.name)).not.toContain('x_tmp')
    expect((await change(adminA, [{ op: 'type.add', name: 'x_tmp', label: text('Temporary') }, { op: 'type.remove', type: 'x_tmp' }])).status).toBe(200)
    await until('the second hidden type to be deleted', async () => { await adminA.get('/api/cms/_model'); return tablesOf(t.a) }, (tables) => !tables.includes('x_tmp'), PURGE_MS)
  }, 60_000)
})

describe('timings', () => {
  it('measures how long a change and the first request after it take (printed)', async () => {
    const changes: number[] = []
    const firsts: number[] = []
    for (let n = 1; n <= 5; n++) {
      const m = await model(adminA)
      const started = performance.now()
      const res = await adminA.post('/api/cms/_model', { baseVersion: m.version, ops: [{ op: 'field.add', type: 'x_event', field: textField(`sample${n}`) }] })
      changes.push(performance.now() - started)
      expect(res.status, JSON.stringify(res.body)).toBe(200)
      const first = performance.now()
      expect((await adminA.get('/api/cms/x_event')).status).toBe(200)
      firsts.push(performance.now() - first)
      expect(await fieldKeys(adminA, 'x_event')).toContain(`sample${n}`)
    }
    const line = (xs: number[]) => `${xs.map((x) => x.toFixed(0)).join(', ')} ms (median ${[...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)]!.toFixed(0)} ms)`
    console.info(`[timing] structure change over HTTP, 5 samples (a field added): ${line(changes)}`)
    console.info(`[timing] first request after a change (the admin list of the type, which makes the new instance): ${line(firsts)}`)
    const warm = performance.now()
    await adminA.get('/api/cms/x_event')
    console.info(`[timing] the same request once the instance is warm: ${(performance.now() - warm).toFixed(0)} ms`)
  })
})

describe('the model stays over an idle unload, a restart and a second process', () => {
  it('serves the types again after the site is unloaded for being idle, and in a process started afterwards', async () => {
    const one = await t.startInstance({ CMS_TEST_TENANCY_IDLE_MS: '1500' })
    const ip = `http://127.0.0.1:${one.port}`
    const siteOn = (site: TenantSite, port: number): TenantSite => ({ ...site, url: `http://${site.host}:${port}` })
    const clientOne = siteClient(siteOn(t.a, one.port), 'admin')
    const keys = async (c: Client) => (await fieldKeys(c, 'x_course')).slice().sort()
    const expected = (await fieldKeys(adminA, 'x_course')).slice().sort()
    expect(expected).toEqual(expect.arrayContaining(['title', 'slug', 'status', 'level', 'cover', 'author', 'teacher']))

    expect(await keys(clientOne)).toEqual(expected)
    expect((await get(siteOn(t.a, one.port), '/api/content/x_course/python')).status).toBe(200)
    expect((await seen(ip, 'site-a')).loaded).toBe(true)
    const loads = (await seen(ip, 'site-a')).loads

    // Quiet for the idle time: A is unloaded (looking at the list does not load it).
    await until('A to be unloaded on the extra process', () => seen(ip, 'site-a'), (s) => s.loaded === false, 10_000)
    expect((await seen(ip, 'site-a')).model).toBeNull()

    // The next request makes it again, with the same types.
    expect(await keys(clientOne)).toEqual(expected)
    const item = await get(siteOn(t.a, one.port), '/api/content/x_course/python')
    expect(item.status).toBe(200)
    expect(item.body.item).toMatchObject({ teacher: 'Ada', level: 'beginner' })
    const again = await seen(ip, 'site-a')
    expect(again.loads).toBe(loads + 1)
    expect(again.model!.version).toBe((await model(adminA)).version)

    // A new process reads the model from the database.
    await one.server.stop()
    const two = await t.startInstance()
    const clientTwo = siteClient(siteOn(t.a, two.port), 'admin')
    expect(await keys(clientTwo)).toEqual(expected)
    expect((await get(siteOn(t.a, two.port), '/api/content/x_course/python')).body.item.teacher).toBe('Ada')
    expect((await get(siteOn(t.b, two.port), '/api/content/x_recipe/polevka')).status).toBe(200)
    expect((await get(siteOn(t.b, two.port), '/api/content/x_course')).status).toBe(404)
    expect((await seen(`http://127.0.0.1:${two.port}`, 'site-a')).model!.version).toBe((await model(adminA)).version)
    await two.server.stop()
    expectNoSiteErrors(one)
    expectNoSiteErrors(two)
  }, 90_000)
})

describe.skipIf(!process.env.TEST_REDIS_URL)('two instances of one app', () => {
  it('serves a change made on one instance on the other within about a second, without touching B there, and takes a change made there', async () => {
    const two = await t.startInstance()
    await two.server.waitForLog(/\[cms\] shared store: redis/, 15_000)
    const ip = `http://127.0.0.1:${two.port}`
    const siteOn = (site: TenantSite): TenantSite => ({ ...site, url: `http://${site.host}:${two.port}` })
    const a2 = siteClient(siteOn(t.a), 'admin')
    const b2 = siteClient(siteOn(t.b), 'admin')
    try {
      // A and B are loaded on instance two.
      expect(await fieldKeys(a2, 'x_event')).not.toContain('fromOne')
      expect((await b2.get('/api/cms/x_recipe')).status).toBe(200)
      const before = { a: await seen(ip, 'site-a'), b: await seen(ip, 'site-b') }
      expect(before.a.loaded).toBe(true)
      expect(before.b.loaded).toBe(true)

      // A change on instance one is served by instance two within about a second.
      const first = await change(adminA, [{ op: 'field.add', type: 'x_event', field: textField('fromOne') }])
      expect(first.status, JSON.stringify(first.body)).toBe(200)
      const madeAt = performance.now()
      await until('instance two to serve the change', () => fieldKeys(a2, 'x_event'), (keys: string[]) => keys.includes('fromOne'), 1500)
      console.info(`[timing] a change made on instance one is served by instance two after ${(performance.now() - madeAt).toFixed(0)} ms`)
      const mid = { a: await seen(ip, 'site-a'), b: await seen(ip, 'site-b') }
      expect(mid.b.loads).toBe(before.b.loads)
      expect(mid.b.model).toEqual(before.b.model)
      expect(mid.a.loads).toBe(before.a.loads + 1)
      expect(mid.a.model!.version).toBe(first.body.version)

      // A second change, made on instance two with the version it reads.
      const known = await a2.get('/api/cms/_model')
      expect(known.status).toBe(200)
      expect(known.body.version).toBe(first.body.version)
      const second = await a2.post('/api/cms/_model', { baseVersion: known.body.version, ops: [{ op: 'field.add', type: 'x_event', field: textField('fromTwo') }] })
      expect(second.status, JSON.stringify(second.body)).toBe(200)
      expect(second.body.version).toBe(known.body.version + 1)
      await until('instance one to serve the second change', () => fieldKeys(adminA, 'x_event'), (keys: string[]) => keys.includes('fromTwo'), 1500)
      expect(await fieldKeys(adminA, 'x_event')).toEqual(expect.arrayContaining(['fromOne', 'fromTwo']))
      expect((await model(adminA)).version).toBe(second.body.version)
      // B was left alone on both instances.
      expect((await seen(ip, 'site-b')).loads).toBe(before.b.loads)
      expect((await seen(t.ipUrl, 'site-b')).model).toEqual(before.b.model)
      expect(await fieldKeys(adminB, 'x_recipe')).not.toContain('fromTwo')
    }
    finally {
      await two.server.stop()
    }
    expectNoSiteErrors(two)
  }, 60_000)
})
