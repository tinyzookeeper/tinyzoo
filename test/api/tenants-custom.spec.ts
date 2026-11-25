import { readdirSync } from 'node:fs'
import { join } from 'node:path'
import pg from 'pg'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { Client, doc, signIn } from '../helpers/api'
import { createAuthor } from '../helpers/fixtures'
import { repoRoot } from '../setup/database'
import { Collaborator } from '../helpers/sockets'
import { expectNoSiteErrors, siteClient, siteQuery, startTenants, type Tenants, type TenantSite, tenantGet, tenantPost, until } from '../helpers/tenants'

// Two sites of the same model in one process, each with content types of its own
// (docs/custom-types-plan.md): site A makes `custom_course` (a page, publishing, a choice, a picture,
// a relation to the author, a required text) and site B makes `custom_recipe`. The structure is
// changed through `POST /api/cms/_model`.
//
// What is proven: the routes that serve the playground's own types serve a site's own types too;
// a type of one site does not exist on the other (every route answers 404, and nothing the
// other site says names it); a change on one site leaves the other site's instance as it was; a
// request under way during a change ends well; the function refuses what the plan refuses and
// nothing else reaches the database; removed fields come back with their values; a timer deletes only
// what was removed empty, a person deletes the rest for good; and the model survives an idle unload, a restart and a second
// instance.
let t: Tenants
let adminA: Client
let adminB: Client
const OPERATOR = 'operator-token-of-the-custom-suite'

/** Words that are in one site's content only. */
const WORD = { a: 'kometovnik', b: 'zeppelinova' }
const UUID_NOWHERE = '00000000-0000-4000-8000-000000000000'

/**
 * Short waits (the test knobs): the server deletes a thing removed empty after 3 s, if it still
 * holds nothing; a person may delete a removed thing for good 1.5 s after it was removed.
 */
const PURGE_EMPTY_MS = 3000
const DELETE_WAIT_MS = 1500

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
    CMS_TEST_MODEL_DELETE_WAIT_MS: String(DELETE_WAIT_MS),
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
    await mustChange(adminA, [{ op: 'type.add', name: 'custom_course', label: text('Courses'), labelSingular: text('Course'), page: { prefix: 'kurzy' }, publish: true }])
    await mustChange(adminA, [
      { op: 'field.add', type: 'custom_course', field: { key: 'level', type: 'select', label: text('Level'), options: [{ value: 'beginner', label: text('Beginner') }, { value: 'advanced', label: text('Advanced') }] } },
      { op: 'field.add', type: 'custom_course', field: { key: 'cover', type: 'media', label: text('Cover') } },
      { op: 'field.add', type: 'custom_course', field: { key: 'author', type: 'relation', to: 'author', label: text('Author') } },
      { op: 'field.add', type: 'custom_course', field: { key: 'teacher', type: 'text', required: true, label: text('Teacher') } },
    ])
    // A second type of A's (for the tests that change the structure while custom_course is in use).
    await mustChange(adminA, [{ op: 'type.add', name: 'custom_event', label: text('Events'), labelSingular: text('Event'), page: { prefix: 'akce' }, publish: true }])
    // B: its own type.
    await mustChange(adminB, [{ op: 'type.add', name: 'custom_recipe', label: text('Recipes'), labelSingular: text('Recipe'), page: { prefix: 'recepty' }, publish: true }])
    await mustChange(adminB, [{ op: 'field.add', type: 'custom_recipe', field: { key: 'minutes', type: 'number', label: text('Minutes') } }])

    // Content of each site's own, made before anything asks for the sitemap (it is cached for a while).
    authorA = (await createAuthor(adminA, { name: 'Autor kurzu' })).id
    const made = await adminA.post('/api/cms/custom_course', { title: `Kurz ${WORD.a}`, slug: 'python', teacher: 'Ada', level: 'beginner', author: authorA, status: 'published' })
    if (made.status !== 201) throw new Error(`course on A: ${made.status} ${JSON.stringify(made.body)}`)
    course = { id: made.body.row.id, slug: made.body.row.slug }
    const draft = await adminA.post('/api/cms/custom_course', { title: `Koncept ${WORD.a}`, slug: 'koncept', teacher: 'Bob', status: 'draft' })
    if (draft.status !== 201) throw new Error(`draft on A: ${draft.status} ${JSON.stringify(draft.body)}`)
    courseDraft = { id: draft.body.row.id, slug: draft.body.row.slug }
    const r = await adminB.post('/api/cms/custom_recipe', { title: `Polévka ${WORD.b}`, slug: 'polevka', minutes: 20, status: 'published' })
    if (r.status !== 201) throw new Error(`recipe on B: ${r.status} ${JSON.stringify(r.body)}`)
    recipe = { id: r.body.row.id, slug: r.body.row.slug }
  }, 60_000)

  it('the sites have types of their own, and B had no table of model versions before it changed its structure', async () => {
    expect(bHadModelTable).toBe(false)
    const a = await model(adminA)
    const b = await model(adminB)
    expect(a.doc.types.map((x: any) => x.name)).toEqual(['custom_course', 'custom_event'])
    expect(b.doc.types.map((x: any) => x.name)).toEqual(['custom_recipe'])
    expect(a.problems).toEqual([])
    expect(b.limits).toEqual({ types: 12, fields: 30, options: 30 })
    expect(b.used).toEqual({ types: 1 })
    expect(a.entries).toMatchObject({ custom_course: 2, custom_event: 0 })
    expect(b.entries).toEqual({ custom_recipe: 1 })
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
    expect((await adminA.post('/api/cms/custom_course', { title: 'Bez učitele', slug: 'bez-ucitele' })).status).toBe(422)
    expect((await adminA.post('/api/cms/custom_course', { title: 'Zlá volba', slug: 'zla-volba', teacher: 'Eva', level: 'expert' })).status).toBe(422)
    expect((await adminA.post('/api/cms/custom_course', { slug: 'bez-nazvu', teacher: 'Eva' })).status).toBe(422)
    expect((await siteQuery(t.a, `select slug from custom_course order by slug`)).map((r) => r.slug)).toEqual(['koncept', 'python'])

    // A draft is made, read by the admin, not served; publishing serves it.
    const made = await adminA.post('/api/cms/custom_course', { title: 'JavaScript', slug: 'javascript', teacher: 'Jan', level: 'advanced', author: authorA, status: 'draft' })
    expect(made.status, JSON.stringify(made.body)).toBe(201)
    const id = made.body.row.id
    expect(made.body.row).toMatchObject({ title: 'JavaScript', teacher: 'Jan', level: 'advanced', status: 'draft' })
    expect((await adminA.get(`/api/cms/custom_course/${id}`)).body.row.teacher).toBe('Jan')
    expect((await get(t.a, '/api/content/custom_course/javascript')).status).toBe(404)
    expect((await get(t.a, '/api/content/custom_course')).body.items.map((i: any) => i.slug)).toEqual(['python'])

    const published = await adminA.patch(`/api/cms/custom_course/${id}`, { status: 'published' })
    expect(published.status, JSON.stringify(published.body)).toBe(200)
    const list = await get(t.a, '/api/content/custom_course')
    expect(list.status).toBe(200)
    expect(list.body.items.map((i: any) => i.slug).sort()).toEqual(['javascript', 'python'])
    const one = await get(t.a, '/api/content/custom_course/python')
    expect(one.status).toBe(200)
    expect(one.body.item).toMatchObject({ title: `Kurz ${WORD.a}`, teacher: 'Ada', level: 'beginner' })
    expect((await get(t.a, '/api/content/custom_course/koncept')).status).toBe(404)
    expect((await get(t.a, `/api/content/custom_course/${UUID_NOWHERE}`)).status).toBe(404)

    // An update and a delete on the admin routes.
    expect((await adminA.patch(`/api/cms/custom_course/${id}`, { teacher: 'Jana' })).body.row.teacher).toBe('Jana')
    expect((await adminA.patch(`/api/cms/custom_course/${id}`, { teacher: '' })).status).toBe(422)
    expect((await adminA.delete(`/api/cms/custom_course/${id}`)).status).toBe(200)
    expect((await get(t.a, '/api/content/custom_course/javascript')).status).toBe(404)
  })

  it('lists the type in the admin graph, the generated types and the API description', async () => {
    const e = await graphEntity(adminA, 'custom_course')
    expect(e).toBeTruthy()
    expect((e.fields as any[]).map((f) => f.key)).toEqual(expect.arrayContaining(['title', 'slug', 'status', 'level', 'cover', 'author', 'teacher']))
    expect((e.fields as any[]).find((f) => f.key === 'teacher').required).toBe(true)
    expect(await fieldKeys(adminA, 'custom_event')).toEqual(expect.arrayContaining(['title', 'slug', 'status']))

    const types = await get(t.a, '/api/content-types.ts')
    expect(types.status).toBe(200)
    expect(types.text).toMatch(/\bCustomCourse\b/)
    expect(types.text).toMatch(/\bCustomEvent\b/)
    expect(/export interface CustomCourse \{[^]*?\n\}/.exec(types.text)?.[0]).toContain('teacher')

    const api = (await get(t.a, '/api/openapi.json')).body
    expect(Object.keys(api.paths)).toEqual(expect.arrayContaining(['/api/content/custom_course', '/api/content/custom_course/{slug}']))
    expect(Object.keys(api.components.schemas).some((s) => s.startsWith('CustomCourse'))).toBe(true)
  })

  it('finds an entry in the site search, the admin search and the sitemap', async () => {
    const found = await until('the site search to find the course', async () => (await get(t.a, `/api/content/_search?q=${WORD.a}`)).body?.items ?? [], (items: any[]) => items.some((i) => i.entity === 'custom_course'), 10_000)
    expect(found.filter((i: any) => i.entity === 'custom_course').map((i: any) => i.path)).toEqual(['/kurzy/python'])
    const admin = await until('the admin search to find the course', async () => (await adminA.get(`/api/cms/_search?q=${WORD.a}`)).body?.items ?? [], (items: any[]) => items.some((i) => i.entity === 'custom_course'), 10_000)
    // The admin sees the draft too, the site does not.
    expect(admin.filter((i: any) => i.entity === 'custom_course').map((i: any) => i.id).sort()).toEqual([course.id, courseDraft.id].sort())

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
    const sources = adminTypeRoutes('custom_course').map((r) => `${r.method} ${r.source}`).sort()
    expect(sources).toEqual([
      'DELETE [id].delete.ts', 'GET [id].get.ts', 'GET [id]/revisions/[rev].get.ts', 'GET [id]/revisions/index.get.ts', 'GET _export.get.ts',
      'GET _tree.get.ts', 'GET index.get.ts', 'GET options.get.ts', 'PATCH [id].patch.ts', 'POST _move.post.ts', 'POST _order.post.ts', 'POST index.post.ts',
    ].sort())
    const content = join(repoRoot, 'packages/cms/server/api/content')
    for (const f of ['[entity]/index.get.ts', '[entity]/[slug].get.ts', '_tree/[entity].get.ts', '_global/[name].get.ts']) expect(readdirSync(content, { recursive: true }), f).toContain(f)
  })

  it('A\'s types are 404 on B in every admin and content route, called as B\'s own administrator', async () => {
    const { failures, calls } = await sweep(t.b, adminB, ['custom_course', 'custom_event'])
    expect(failures).toEqual([])
    expect(calls).toBeGreaterThan(30)
  })

  it('B\'s type is 404 on A in every admin and content route, called as A\'s own administrator', async () => {
    const { failures, calls } = await sweep(t.a, adminA, ['custom_recipe'])
    expect(failures).toEqual([])
    expect(calls).toBeGreaterThan(15)
  })

  it('the same routes answer for the types a site has (so the 404 above is the model\'s, not the route\'s)', async () => {
    for (const [site, admin, own] of [[t.a, adminA, 'custom_course'], [t.b, adminB, 'custom_recipe']] as const) {
      expect((await admin.get(`/api/cms/${own}`)).status, `${site.id} list`).toBe(200)
      expect((await admin.get(`/api/cms/${own}/options`)).status, `${site.id} options`).toBe(200)
      expect((await admin.get(`/api/cms/${own}/${UUID_NOWHERE}`)).status, `${site.id} one`).toBe(404) // an entry that is not there: 404 for another reason
      expect((await get(site, `/api/content/${own}`)).status, `${site.id} content`).toBe(200)
    }
  })

  it('B\'s graph, generated types, API description, search and sitemap name nothing of A\'s, and the other way round', async () => {
    const namesOf = (g: any[]) => g.map((e) => e.name as string)
    expect(namesOf(await graph(adminB))).not.toEqual(expect.arrayContaining(['custom_course']))
    expect(namesOf(await graph(adminB)).filter((n) => n.startsWith('custom_'))).toEqual(['custom_recipe'])
    expect(namesOf(await graph(adminA)).filter((n) => n.startsWith('custom_')).sort()).toEqual(['custom_course', 'custom_event'])

    const typesA = (await get(t.a, '/api/content-types.ts')).text
    const typesB = (await get(t.b, '/api/content-types.ts')).text
    expect(typesB).toMatch(/\bCustomRecipe\b/)
    expect(typesB).not.toMatch(/CustomCourse|CustomEvent|custom_course|custom_event|teacher/)
    expect(typesA).not.toMatch(/CustomRecipe|custom_recipe|minutes/)

    const apiA = JSON.stringify((await get(t.a, '/api/openapi.json')).body)
    const apiB = JSON.stringify((await get(t.b, '/api/openapi.json')).body)
    expect(apiB).toContain('custom_recipe')
    expect(apiB).not.toMatch(/custom_course|custom_event|CustomCourse|CustomEvent/)
    expect(apiA).not.toMatch(/custom_recipe|CustomRecipe/)

    // Search: each site's word is found at home and never on the other.
    await until('B\'s search to find the recipe', async () => (await get(t.b, `/api/content/_search?q=${WORD.b}`)).body?.items ?? [], (items: any[]) => items.length > 0, 10_000)
    expect((await get(t.b, `/api/content/_search?q=${WORD.b}`)).body.items.map((i: any) => [i.entity, i.path])).toEqual([['custom_recipe', `/recepty/${recipe.slug}`]])
    expect((await adminB.get(`/api/cms/_search?q=${WORD.b}`)).body.items.map((i: any) => [i.entity, i.id])).toEqual([['custom_recipe', recipe.id]])
    expect((await get(t.a, `/api/content/_search?q=${WORD.b}`)).body.items).toEqual([])
    expect((await adminA.get(`/api/cms/_search?q=${WORD.b}`)).body.items).toEqual([])
    expect((await get(t.b, `/api/content/_search?q=${WORD.a}`)).body.items).toEqual([])
    expect((await adminB.get(`/api/cms/_search?q=${WORD.a}`)).body.items).toEqual([])
    expect((await get(t.a, `/api/content/_search?q=${WORD.b}&entity=custom_recipe`)).body.items).toEqual([])
    const entities = async (site: TenantSite) => (await siteQuery(site, 'select distinct entity from cms_search order by entity')).map((r) => r.entity as string)
    expect((await entities(t.b)).filter((e) => e.startsWith('custom_'))).toEqual(['custom_recipe'])
    expect((await entities(t.a)).filter((e) => e.startsWith('custom_'))).toEqual(['custom_course'])

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
    const x = (all: string[]) => all.filter((n) => n.startsWith('custom_'))
    const a = x(await tablesOf(t.a))
    const b = x(await tablesOf(t.b))
    expect(a.length).toBeGreaterThan(0)
    expect(b.length).toBeGreaterThan(0)
    for (const name of a) expect(name, `A's table ${name}`).toMatch(/^custom_(course|event)(_|$)/)
    for (const name of b) expect(name, `B's table ${name}`).toMatch(/^custom_recipe(_|$)/)
    expect(a).toEqual(expect.arrayContaining(['custom_course', 'custom_event']))
    expect(b).toContain('custom_recipe')

    const docsOf = async (site: TenantSite) => (await siteQuery(site, 'select version, doc from cms_model order by version')).map((r) => ({ version: r.version as number, types: (r.doc.types as any[]).map((x) => x.name as string) }))
    const docsA = await docsOf(t.a)
    const docsB = await docsOf(t.b)
    expect(docsB.map((d) => d.version)).toEqual([1, 2])
    for (const d of docsB) expect(d.types).toEqual(['custom_recipe'])
    for (const d of docsA) for (const name of d.types) expect(name).toMatch(/^custom_(course|event)$/)
    expect(docsA.at(-1)!.types).toEqual(['custom_course', 'custom_event'])
    // The design's own tables are the same on both: nothing of the other site's came in.
    expect(await columnsOf(t.b, 'custom_recipe')).toEqual(expect.arrayContaining(['id', 'title', 'slug', 'status', 'minutes']))
    expect(await columnsOf(t.b, 'custom_recipe')).not.toContain('teacher')
    expect(await columnsOf(t.a, 'custom_course')).toEqual(expect.arrayContaining(['id', 'title', 'slug', 'status', 'level', 'teacher']))
    expect(await columnsOf(t.a, 'custom_course')).not.toContain('minutes')
    expect(await siteQuery(t.b, `select 1 from information_schema.tables where table_name = 'custom_course'`)).toEqual([])
  })
})

describe('a change on one site leaves the other alone', () => {
  it('keeps B\'s instance when A changes (a request to B and to A in between), while A has a new one', async () => {
    expect((await get(t.b, '/api/content/custom_recipe')).status).toBe(200)
    expect((await get(t.a, '/api/content/custom_course')).status).toBe(200)
    const before = { a: await seen(t.ipUrl, 'site-a'), b: await seen(t.ipUrl, 'site-b') }
    expect(before.a.loaded).toBe(true)
    expect(before.b.loaded).toBe(true)

    const started = performance.now()
    await mustChange(adminA, [{ op: 'field.add', type: 'custom_event', field: textField('place') }])
    console.info(`[timing] a structure change on A while B is loaded: ${(performance.now() - started).toFixed(0)} ms (version read and change)`)
    // B answers during and after it, from the instance it had.
    expect((await get(t.b, '/api/content/custom_recipe')).status).toBe(200)
    expect((await adminB.get('/api/cms/custom_recipe')).status).toBe(200)
    const mid = await seen(t.ipUrl, 'site-b')
    expect(mid.loads).toBe(before.b.loads)
    expect(mid.loaded).toBe(true)

    // A's next request makes its new instance, with the new field.
    expect(await fieldKeys(adminA, 'custom_event')).toContain('place')
    const after = { a: await seen(t.ipUrl, 'site-a'), b: await seen(t.ipUrl, 'site-b') }
    expect(after.b.loads).toBe(before.b.loads)
    expect(after.a.loads).toBe(before.a.loads + 1)
    expect(after.b.model).toEqual(before.b.model)
    expect(after.a.model!.version).toBe(before.a.model!.version + 1)
    // B's model is as it was.
    expect(await fieldKeys(adminB, 'custom_recipe')).not.toContain('place')
  })
})

describe('a request under way while the structure changes', () => {
  it('ends well with the model it started with, and the next request sees the new model', async () => {
    const db = new pg.Client({ connectionString: t.a.databaseUrl })
    await db.connect()
    let pending: Promise<{ status: number; body: any }> | undefined
    try {
      await db.query('begin')
      await db.query('select id from custom_course where id = $1 for update', [course.id])
      let settled = false
      pending = adminA.patch(`/api/cms/custom_course/${course.id}`, { title: `Kurz ${WORD.a} (změněno)` })
      void pending.then(() => { settled = true }, () => { settled = true })
      await sleep(300)
      expect(settled, 'the update waits for the row the test holds').toBe(false)

      // The structure of ANOTHER type changes while the update waits.
      const res = await change(adminA, [{ op: 'field.add', type: 'custom_event', field: textField('city') }])
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
    expect((await siteQuery(t.a, 'select title from custom_course where id = $1', [course.id]))[0].title).toBe(`Kurz ${WORD.a} (změněno)`)
    await adminA.patch(`/api/cms/custom_course/${course.id}`, { title: `Kurz ${WORD.a}` })
    // The new request is served by the new model.
    expect(await fieldKeys(adminA, 'custom_event')).toContain('city')
    expect((await get(t.a, '/api/content/custom_course/python')).status).toBe(200)
  })

  it('refuses a change of the type itself while its row is locked (busy, within about 2 s), and the site answers normally afterwards', async () => {
    const before = await model(adminA)
    const db = new pg.Client({ connectionString: t.a.databaseUrl })
    await db.connect()
    try {
      await db.query('begin')
      await db.query('select id from custom_course where id = $1 for update', [course.id])
      const started = performance.now()
      const res = await adminA.post('/api/cms/_model', { baseVersion: before.version, ops: [{ op: 'field.add', type: 'custom_course', field: textField('notes') }] })
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
    expect(await columnsOf(t.a, 'custom_course')).not.toContain('notes')
    expect((await get(t.a, '/api/content/custom_course/python')).status).toBe(200)
    expect((await adminA.patch(`/api/cms/custom_course/${course.id}`, { teacher: 'Ada' })).status).toBe(200)
    // And the same change goes through once the lock is gone.
    expect((await change(adminA, [{ op: 'field.add', type: 'custom_course', field: textField('notes') }])).status).toBe(200)
    expect(await columnsOf(t.a, 'custom_course')).toContain('notes')
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
      pending = get({ url: `http://${t.a.host}:${extra.port}` }, '/api/content/custom_course/python')
      void pending.then(() => { settled = true }, () => { settled = true })
      await sleep(500)
      // It neither answers without the types (a 404 for custom_course) nor fails: it waits.
      expect(settled, 'the first request waits for the site\'s own types').toBe(false)
      await db.query('commit')
      const res = await pending
      expect(res.status, JSON.stringify(res.body)).toBe(200)
      expect(res.body.item.teacher).toBe('Ada')
      // B, which has its own types too, is served by the same process.
      expect((await get({ url: `http://${t.b.host}:${extra.port}` }, `/api/content/custom_recipe/${recipe.slug}`)).status).toBe(200)
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
    const res = await adminA.post('/api/cms/_model', { baseVersion: m.version - 1, ops: [{ op: 'type.add', name: 'custom_stale', label: text('Stale') }] })
    expect(res.status, JSON.stringify(res.body)).toBe(409)
    expect(res.body.data).toMatchObject({ code: 'stale-version', version: m.version })
    expect((await model(adminA)).version).toBe(m.version)
    expect(await tablesOf(t.a)).toEqual(tables)
    // A version that was never made is stale too.
    const ahead = await adminA.post('/api/cms/_model', { baseVersion: m.version + 5, ops: [{ op: 'type.add', name: 'custom_stale', label: text('Stale') }] })
    expect(ahead.status).toBe(409)
    expect(ahead.body.data.code).toBe('stale-version')
  })

  it('changes nothing in a dry run', async () => {
    const m = await model(adminA)
    const tables = await tablesOf(t.a)
    const history = (await adminA.get('/api/cms/_model/history')).body.length
    const res = await adminA.post('/api/cms/_model', { baseVersion: m.version, dryRun: true, ops: [
      { op: 'type.add', name: 'custom_ghost', label: text('Ghosts'), page: { prefix: 'duchove' } },
      { op: 'field.add', type: 'custom_course', field: textField('ghostly') },
    ] })
    expect(res.status, JSON.stringify(res.body)).toBe(200)
    expect(res.body.dryRun).toBe(true)
    expect(res.body.statements).toBeGreaterThan(0)
    expect(res.body.doc.types.map((x: any) => x.name)).toContain('custom_ghost')
    const after = await model(adminA)
    expect(after.version).toBe(m.version)
    expect(after.doc.types.map((x: any) => x.name)).not.toContain('custom_ghost')
    expect(await tablesOf(t.a)).toEqual(tables)
    expect(await columnsOf(t.a, 'custom_course')).not.toContain('ghostly')
    expect((await adminA.get('/api/cms/_model/history')).body).toHaveLength(history)
    expect((await get(t.a, '/api/content/custom_ghost')).status).toBe(404)
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
      const res = await adminB.post('/api/cms/_model', { baseVersion: m.version, ops: [{ op: 'type.add', name: 'custom_second', label: text('Second') }] })
      expect(res.status, JSON.stringify(res.body)).toBe(422)
      expect(res.body.data.code).toBe('limit-types')
      expect(res.body.data.op).toBe(0)
      expect(await tablesOf(t.b)).not.toContain('custom_second')
      // A's limit is the default, whatever B's row says.
      expect((await model(adminA)).limits.types).toBe(12)
    }
    finally {
      await t.writeDirectory(t.rows)
    }
    await until('B to use the default limit again', async () => (await adminB.get('/api/cms/_model')).body?.limits, (l: any) => l?.types === 12, 8000)
    const lifted = await change(adminB, [{ op: 'type.add', name: 'custom_second', label: text('Second') }], { dryRun: true })
    expect(lifted.status, JSON.stringify(lifted.body)).toBe(200)
  })

  it('is for administrators only', async () => {
    const editor = siteClient(t.a, 'editor')
    const author = siteClient(t.a, 'author')
    const anonymous = siteClient(t.a)
    const m = await model(adminA)
    const body = { baseVersion: m.version, ops: [{ op: 'type.add', name: 'custom_nope', label: text('Nope') }] }
    for (const path of ['/api/cms/_model', '/api/cms/_model/history', '/api/cms/_model/usage?type=custom_course', '/api/cms/_model/attention']) {
      expect((await editor.get(path)).status, `editor GET ${path}`).toBe(403)
      expect((await author.get(path)).status, `author GET ${path}`).toBe(403)
      expect((await anonymous.get(path)).status, `anonymous GET ${path}`).toBe(401)
    }
    expect((await editor.post('/api/cms/_model', body)).status).toBe(403)
    expect((await author.post('/api/cms/_model', body)).status).toBe(403)
    expect((await anonymous.post('/api/cms/_model', body)).status).toBe(401)
    // An administrator of the other site is not one here.
    expect((await siteClient(t.b, { cookie: t.a.cookies.admin }).get('/api/cms/_model')).status).toBe(401)
    expect(await tablesOf(t.a)).not.toContain('custom_nope')
    expect((await model(adminA)).version).toBe(m.version)
  })

  it('does nothing for a site that has the switch off: no route, no table, no version, and the site serves its type again when it is on', async () => {
    const tables = await tablesOf(t.b)
    const versions = (await siteQuery(t.b, 'select version from cms_model order by version')).map((r) => r.version)
    try {
      await t.writeDirectory([t.rows[0], { ...t.rows[1], config: { ...t.rows[1].config, customTypes: { enabled: false } } }])
      await until('B\'s model to go', async () => (await adminB.get('/api/cms/_model')).status, (s) => s === 404, 8000)
      expect((await adminB.get('/api/cms/_model')).status).toBe(404)
      expect((await adminB.post('/api/cms/_model', { baseVersion: versions.at(-1), ops: [{ op: 'type.add', name: 'custom_off', label: text('Off') }] })).status).toBe(404)
      expect((await adminB.get('/api/cms/_model/history')).status).toBe(404)
      expect((await adminB.get('/api/cms/_model/usage?type=custom_recipe')).status).toBe(404)
      expect((await adminB.get('/api/cms/_model/attention')).status).toBe(404)
      // The website's list of types is there for every site, and empty here; the block picker does not offer the blocks of a type.
      expect((await get(t.b, '/api/content/_types')).body).toEqual({ types: [] })
      const sectionsOff = ((await graph(adminB)).find((e) => e.name === 'page').fields as any[]).find((x) => x.key === 'sections')
      expect(Object.keys(sectionsOff.meta.blocks)).not.toContain('custom_entries')
      // The menu has no row for it, and is the menu of a site without the feature.
      const menuOff = (await adminB.get('/api/cms/_menu')).body
      expect(menuKeys(menuOff)).not.toContain('@model')
      expect(menuOff.settings.slice(-3)).toEqual(['@team', '@privacy', '@about'])
      expect((await adminB.get('/api/cms/custom_recipe')).status).toBe(404)
      expect((await get(t.b, '/api/content/custom_recipe')).status).toBe(404)
      expect((await get(t.b, '/api/content/custom_recipe/polevka')).status).toBe(404)
      expect((await graph(adminB)).map((e) => e.name)).not.toContain('custom_recipe')
      expect((await get(t.b, '/api/content-types.ts')).text).not.toMatch(/CustomRecipe/)
      // A is not touched.
      expect((await adminA.get('/api/cms/_model')).status).toBe(200)
      expect((await get(t.a, '/api/content/custom_course')).status).toBe(200)
      expect(await tablesOf(t.b)).toEqual(tables)
      expect((await siteQuery(t.b, 'select version from cms_model order by version')).map((r) => r.version)).toEqual(versions)
    }
    finally {
      await t.writeDirectory(t.rows)
    }
    await until('B to serve its type again', async () => (await get(t.b, '/api/content/custom_recipe')).status, (s) => s === 200, 8000)
    expect((await adminB.get('/api/cms/_model')).status).toBe(200)
    expect((await get(t.b, '/api/content/custom_recipe/polevka')).body.item.title).toBe(`Polévka ${WORD.b}`)
    expect((await adminB.get('/api/cms/custom_recipe')).status).toBe(200)
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
    expect(first.ops[0]).toMatchObject({ op: 'type.add', name: 'custom_course' })
    // B's history is B's own.
    const b = (await adminB.get('/api/cms/_model/history')).body
    expect(b.map((h: any) => h.version)).toEqual([2, 1])
    expect(JSON.stringify(b)).not.toContain('custom_course')
    expect(b[0].ops[0]).toMatchObject({ op: 'field.add', type: 'custom_recipe' })
  })
})

describe('what the function refuses', () => {
  it('lets nothing reach the database that part 1 refuses: the tables, the columns and the version stay as they were', async () => {
    const m = await model(adminA)
    const tables = await tablesOf(t.a)
    const columns = { course: await columnsOf(t.a, 'custom_course'), event: await columnsOf(t.a, 'custom_event'), post: await columnsOf(t.a, 'post'), users: await columnsOf(t.a, 'cms_users') }
    const refusals: [string, unknown[], string?][] = [
      ['a changed kind', [{ op: 'field.update', type: 'custom_course', key: 'teacher', kind: 'number' }], 'not-changeable'],
      ['a changed field type', [{ op: 'field.update', type: 'custom_course', key: 'teacher', fieldType: 'number' }], 'not-changeable'],
      ['a changed target', [{ op: 'field.update', type: 'custom_course', key: 'author', to: 'post' }], 'not-changeable'],
      ['a renamed type', [{ op: 'type.update', type: 'custom_course', name: 'custom_class' }], 'not-changeable'],
      ['a changed publish', [{ op: 'type.update', type: 'custom_course', publish: false }], 'not-changeable'],
      ['pages switched off', [{ op: 'type.update', type: 'custom_course', page: null }], 'not-changeable'],
      ['a changed address', [{ op: 'type.update', type: 'custom_course', page: { prefix: 'classes' } }], 'not-changeable'],
      ['a name of the design', [{ op: 'type.add', name: 'post', label: text('Posts') }]],
      ['a name without the prefix', [{ op: 'type.add', name: 'courses', label: text('Courses') }], 'invalid-name'],
      ['a name that is a statement', [{ op: 'type.add', name: 'custom_a"; drop table post; --', label: text('Drop') }], 'invalid-name'],
      ['a name of a table of tinyzoo', [{ op: 'type.add', name: 'cms_users', label: text('Users') }], 'invalid-name'],
      ['a name taken', [{ op: 'type.add', name: 'custom_course', label: text('Again') }], 'name-taken'],
      ['an address taken', [{ op: 'type.add', name: 'custom_other', label: text('Other'), page: { prefix: 'kurzy' } }], 'prefix-taken'],
      ['deleting for good a type that is not removed', [{ op: 'purge', types: ['custom_course'] }], 'not-removed'],
      ['deleting for good a field that is not removed', [{ op: 'purge', fields: [{ type: 'custom_course', key: 'teacher' }] }], 'not-removed'],
      ['an unknown operation', [{ op: 'drop.table', type: 'post' }], 'invalid-op'],
      ['a type of the design', [{ op: 'field.add', type: 'post', field: textField('extra') }]],
      ['a type of the design removed', [{ op: 'type.remove', type: 'post' }]],
      ['a field of the design removed', [{ op: 'field.remove', type: 'post', key: 'title' }]],
      ['a field that is made by tinyzoo', [{ op: 'field.remove', type: 'custom_course', key: 'slug' }], 'system-field'],
      ['the title removed', [{ op: 'field.remove', type: 'custom_course', key: 'title' }], 'title-field'],
      ['a required field with entries', [{ op: 'field.add', type: 'custom_course', field: textField('must', { required: true }) }], 'needs-optional'],
      ['a field made required with entries missing', [{ op: 'field.update', type: 'custom_course', key: 'notes', required: true }], 'has-missing-values'],
      ['a field twice', [{ op: 'field.add', type: 'custom_course', field: textField('teacher') }]],
      ['a relation to a type that is not there', [{ op: 'field.add', type: 'custom_course', field: { key: 'friend', type: 'relation', to: 'custom_nowhere', label: text('Friend') } }]],
      ['a good change followed by a bad one', [{ op: 'field.add', type: 'custom_course', field: textField('half') }, { op: 'field.update', type: 'custom_course', key: 'teacher', kind: 'number' }], 'not-changeable'],
    ]
    for (const [what, ops, code] of refusals) {
      const res = await adminA.post('/api/cms/_model', { baseVersion: m.version, ops })
      expect(res.status, `${what}: ${JSON.stringify(res.body)}`).toBe(422)
      if (code) expect(res.body.data.code, what).toBe(code)
    }
    // A request that is not an operation at all.
    for (const body of [{ baseVersion: m.version, ops: [] }, { baseVersion: m.version, ops: ['drop table post'] }, { baseVersion: 'x', ops: [] }, { ops: [{ op: 'type.remove', type: 'custom_course' }] }, { baseVersion: m.version, ops: [{ op: 'type.remove', type: 'custom_course' }], extra: 1 }]) {
      const res = await adminA.post('/api/cms/_model', body)
      expect([400, 422], JSON.stringify(body)).toContain(res.status)
    }

    expect((await model(adminA)).version).toBe(m.version)
    expect(await tablesOf(t.a)).toEqual(tables)
    expect(await columnsOf(t.a, 'custom_course')).toEqual(columns.course)
    expect(await columnsOf(t.a, 'custom_event')).toEqual(columns.event)
    expect(await columnsOf(t.a, 'post')).toEqual(columns.post)
    expect(await columnsOf(t.a, 'cms_users')).toEqual(columns.users)
    expect((await siteQuery(t.a, 'select count(*)::int n from cms_model'))[0].n).toBe(m.version)
    // The site serves as before.
    expect((await get(t.a, '/api/content/custom_course/python')).body.item.teacher).toBe('Ada')
  })
})

describe('hiding and restoring', () => {
  it('hides a field from the graph, the content API and the generated types while its column keeps the values, and restore brings them back', async () => {
    const hid = await change(adminA, [{ op: 'field.remove', type: 'custom_course', key: 'level' }])
    expect(hid.status, JSON.stringify(hid.body)).toBe(200)
    try {
      expect(await fieldKeys(adminA, 'custom_course')).not.toContain('level')
      const item = (await get(t.a, '/api/content/custom_course/python')).body.item
      expect(item).not.toHaveProperty('level')
      expect(item.teacher).toBe('Ada')
      expect(/export interface CustomCourse \{[^]*?\n\}/.exec((await get(t.a, '/api/content-types.ts')).text)?.[0]).not.toContain('level')
      expect(JSON.stringify((await get(t.a, '/api/openapi.json')).body.components.schemas.CustomCourse)).not.toContain('level')
      // The column and its value are in the database; the model says it is removed.
      expect((await siteQuery(t.a, `select level from custom_course where slug = 'python'`))[0].level).toBe('beginner')
      const m = await model(adminA)
      expect(m.doc.types.find((x: any) => x.name === 'custom_course').fields.find((f: any) => f.key === 'level').removedAt).toBeTruthy()
      // A write that no longer knows the field leaves its value alone, and the field cannot be sent.
      expect((await adminA.patch(`/api/cms/custom_course/${course.id}`, { teacher: 'Ada' })).status).toBe(200)
      expect((await siteQuery(t.a, `select level from custom_course where slug = 'python'`))[0].level).toBe('beginner')
      // Its name is still taken.
      expect((await change(adminA, [{ op: 'field.add', type: 'custom_course', field: textField('level') }])).status).toBe(422)
    }
    finally {
      const back = await change(adminA, [{ op: 'field.restore', type: 'custom_course', key: 'level' }])
      expect(back.status, JSON.stringify(back.body)).toBe(200)
    }
    expect(await fieldKeys(adminA, 'custom_course')).toContain('level')
    expect((await get(t.a, '/api/content/custom_course/python')).body.item.level).toBe('beginner')
    expect((await adminA.get(`/api/cms/custom_course/${course.id}`)).body.row.level).toBe('beginner')
    expect(/export interface CustomCourse \{[^]*?\n\}/.exec((await get(t.a, '/api/content-types.ts')).text)?.[0]).toContain('level')
  })

  it('lets a new entry be saved without a required text field that is hidden, and brings it back optional when entries lack it', async () => {
    const hid = await change(adminA, [{ op: 'field.remove', type: 'custom_course', key: 'teacher' }])
    expect(hid.status, JSON.stringify(hid.body)).toBe(200)
    let extra: string | undefined
    try {
      const made = await adminA.post('/api/cms/custom_course', { title: 'Bez učitele', slug: 'bez-ucitele', status: 'draft' })
      expect(made.status, JSON.stringify(made.body)).toBe(201)
      extra = made.body.row.id
      expect((await siteQuery(t.a, 'select teacher from custom_course where id = $1', [extra]))[0].teacher).toBeNull()
      expect((await siteQuery(t.a, `select teacher from custom_course where slug = 'python'`))[0].teacher).toBe('Ada')
    }
    finally {
      const back = await change(adminA, [{ op: 'field.restore', type: 'custom_course', key: 'teacher' }])
      expect(back.status, JSON.stringify(back.body)).toBe(200)
      expect(back.body.notes.map((n: any) => n.code)).toContain('restored-optional')
    }
    const teacher = (await graphEntity(adminA, 'custom_course')).fields.find((f: any) => f.key === 'teacher')
    expect(teacher.required).toBeFalsy()
    expect((await get(t.a, '/api/content/custom_course/python')).body.item.teacher).toBe('Ada')
    // Clean up: the entry without a teacher goes, and the field can be required again.
    expect((await adminA.delete(`/api/cms/custom_course/${extra}`)).status).toBe(200)
    expect((await change(adminA, [{ op: 'field.update', type: 'custom_course', key: 'teacher', required: true }])).status).toBe(200)
    expect((await adminA.post('/api/cms/custom_course', { title: 'Zase bez', slug: 'zase-bez' })).status).toBe(422)
  })

  it('does not remove a type that another type\'s field points at, and says which field', async () => {
    await mustChange(adminA, [
      { op: 'type.add', name: 'custom_lesson', label: text('Lessons'), labelSingular: text('Lesson') },
      { op: 'field.add', type: 'custom_lesson', field: { key: 'course', type: 'relation', to: 'custom_course', label: text('Course') } },
    ])
    const m = await model(adminA)
    const res = await adminA.post('/api/cms/_model', { baseVersion: m.version, ops: [{ op: 'type.remove', type: 'custom_course' }] })
    expect(res.status, JSON.stringify(res.body)).toBe(422)
    expect(res.body.data.code).toBe('points-at-type')
    expect(res.body.data.details.fields).toEqual([{ type: 'custom_lesson', key: 'course' }])
    expect(res.body.data.op).toBe(0)
    expect(res.body.data.message).toContain('course')
    expect((await model(adminA)).version).toBe(m.version)
    expect((await get(t.a, '/api/content/custom_course/python')).status).toBe(200)
    // The lesson itself can point at a course.
    const lesson = await adminA.post('/api/cms/custom_lesson', { title: 'První hodina', course: course.id })
    expect(lesson.status, JSON.stringify(lesson.body)).toBe(201)
    expect((await adminA.delete(`/api/cms/custom_lesson/${lesson.body.row.id}`)).status).toBe(200)
  })

  it('does not remove a type that content links to, names the entry that links, and removes it once the link is gone', async () => {
    await mustChange(adminA, [{ op: 'type.add', name: 'custom_note', label: text('Notes'), labelSingular: text('Note') }])
    const note = await adminA.post('/api/cms/custom_note', { title: 'Poznámka' })
    expect(note.status, JSON.stringify(note.body)).toBe(201)
    const link = (id: string) => ({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Viz poznámku', marks: [{ type: 'link', attrs: { href: `cms:custom_note/${id}` } }] }] }] })
    const linker = await createAuthor(adminA, { name: 'Autor s odkazem', bio: link(note.body.row.id) })
    expect(JSON.stringify((await adminA.get(`/api/cms/author/${linker.id}`)).body.row.bio)).toContain(`cms:custom_note/${note.body.row.id}`)

    const usage = await adminA.get('/api/cms/_model/usage?type=custom_note')
    expect(usage.status).toBe(200)
    expect(usage.body.places).toEqual([expect.objectContaining({ entity: 'author', id: linker.id, title: 'Autor s odkazem', field: 'bio' })])

    const m = await model(adminA)
    const res = await adminA.post('/api/cms/_model', { baseVersion: m.version, ops: [{ op: 'type.remove', type: 'custom_note' }] })
    expect(res.status, JSON.stringify(res.body)).toBe(409)
    expect(res.body.data.code).toBe('in-use')
    expect(res.body.data.places).toEqual([expect.objectContaining({ entity: 'author', id: linker.id, field: 'bio', admin: `/admin/author/${linker.id}` })])
    expect((await model(adminA)).version).toBe(m.version)
    expect((await get(t.a, '/api/content/custom_course')).status).toBe(200)

    // Without the link the type can go (and comes back).
    expect((await adminA.patch(`/api/cms/author/${linker.id}`, { bio: doc('Bez odkazu') })).status).toBe(200)
    expect((await adminA.get('/api/cms/_model/usage?type=custom_note')).body.places).toEqual([])
    expect((await change(adminA, [{ op: 'type.remove', type: 'custom_note' }])).status).toBe(200)
    expect((await adminA.get('/api/cms/custom_note')).status).toBe(404)
    expect((await graph(adminA)).map((e) => e.name)).not.toContain('custom_note')
    expect((await siteQuery(t.a, 'select title from custom_note')).map((r) => r.title)).toEqual(['Poznámka'])
    expect((await change(adminA, [{ op: 'type.restore', type: 'custom_note' }])).status).toBe(200)
    expect((await adminA.get('/api/cms/custom_note')).body.rows.map((r: any) => r.title)).toEqual(['Poznámka'])
  })
})

describe('blocks that show a type of the site', () => {
  // custom_entries and custom_chosen are blocks of the playground's pages; their `source` is a binding, kept as data in the page's `sections`.
  const pages: { client: Client; id: string }[] = []
  let page: { id: string; slug: string }
  let bPage: { id: string; slug: string }
  const LIST = { id: 'blk-list', type: 'custom_entries', heading: 'Our courses', text: '', layout: 'cards', source: { type: 'custom_course', show: { image: 'cover', text: 'perex' }, order: { by: 'startsAt', dir: 'asc' }, limit: 3 } }
  const CHOSEN = { id: 'blk-chosen', type: 'custom_chosen', heading: '', text: '', layout: 'rows', source: { type: 'custom_course', entries: [] as string[] } }
  const EVENTS = { id: 'blk-events', type: 'custom_entries', heading: 'Events', text: '', layout: 'cards', source: { type: 'custom_event', limit: 2 } }
  const ordinary = { id: 'blk-text', type: 'text', heading: 'Hello' }

  async function makePage(client: Client, slug: string, sections: unknown[]) {
    const res = await client.post('/api/cms/page', { title: `Stránka ${slug}`, slug, status: 'published', sections })
    if (res.status !== 201) throw new Error(`page ${slug}: ${res.status} ${JSON.stringify(res.body)}`)
    pages.push({ client, id: res.body.row.id })
    return res.body.row as { id: string; slug: string }
  }
  const sectionsOf = async (c: Client, id: string) => (await c.get(`/api/cms/page/${id}`)).body.row.sections as any[]
  /** What is stored on the entry's own row (the default language). */
  const storedSections = async (site: TenantSite, id: string) => (await siteQuery(site, 'select sections from page where id = $1', [id]))[0]!.sections as any[]
  const placeOf = (p: any) => ({ entity: p.entity, id: p.id, title: p.title, field: p.field, admin: p.admin, block: p.block && { id: p.block.id, type: p.block.type, heading: p.block.heading } })

  beforeAll(async () => {
    await mustChange(adminA, [
      { op: 'field.add', type: 'custom_course', field: { key: 'startsAt', type: 'datetime', label: text('Starts at') } },
      { op: 'field.add', type: 'custom_course', field: { key: 'perex', type: 'text', long: true, label: text('Perex') } },
    ])
    CHOSEN.source.entries = [course.id, courseDraft.id]
  }, 30_000)

  afterAll(async () => {
    for (const p of pages) await p.client.delete(`/api/cms/page/${p.id}`).catch(() => {})
  })

  it('keeps the bindings of a page as they were sent, and refuses a binding of the wrong shape', async () => {
    page = await makePage(adminA, 'kurzy-na-webu', [LIST, CHOSEN, ordinary])
    const stored = await storedSections(t.a, page.id)
    expect(stored.map((b) => [b.id, b.type, b.source])).toEqual([[LIST.id, LIST.type, LIST.source], [CHOSEN.id, CHOSEN.type, CHOSEN.source], [ordinary.id, ordinary.type, undefined]])
    // The website gets them as data: it is the block that draws them.
    const served = (await get(t.a, `/api/content/page/${page.slug}`)).body.item
    expect(served.sections.map((b: any) => b.source)).toEqual([LIST.source, CHOSEN.source, undefined])
    expect((await sectionsOf(adminA, page.id)).map((b) => b.id)).toEqual(['blk-list', 'blk-chosen', 'blk-text'])

    const bad = (source: unknown) => adminA.post('/api/cms/page', { title: 'Zlá', slug: `zla-${Math.random().toString(36).slice(2, 8)}`, sections: [{ ...LIST, id: 'bad', source }] })
    expect((await bad({ type: 'custom_course', show: { image: 'cover', colour: 'red' } })).status).toBe(422)
    expect((await bad({ type: 'custom_course', whatever: true })).status).toBe(422)
    expect((await bad({ type: 'course' })).status).toBe(422)
    expect((await bad({ type: 'custom_course', limit: 49 })).status).toBe(422)
    const thirteen = Array.from({ length: 13 }, (_, i) => `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`)
    expect((await bad({ type: 'custom_course', entries: thirteen })).status).toBe(422)
    const twelve = await bad({ type: 'custom_course', entries: thirteen.slice(0, 12) })
    expect(twelve.status, JSON.stringify(twelve.body)).toBe(201)
    await adminA.delete(`/api/cms/page/${twelve.body.row.id}`)
    expect((await bad({ type: 'custom_course', entries: ['not-an-id'] })).status).toBe(422)
    // The ones that were refused are not there.
    expect((await siteQuery(t.a, `select slug from page where slug like 'zla-%'`))).toEqual([])
  })

  it('says where a type and its fields are shown, in a language of the page too', async () => {
    const field = async (key: string) => (await adminA.get(`/api/cms/_model/usage?type=custom_course&field=${key}`)).body
    for (const key of ['cover', 'perex', 'startsAt']) {
      const res = await adminA.get(`/api/cms/_model/usage?type=custom_course&field=${key}`)
      expect(res.status, key).toBe(200)
      expect(Object.keys(res.body)).toEqual(['places', 'values'])
      expect(res.body.values === null || Number.isInteger(res.body.values), key).toBe(true)
      expect(res.body.places.map(placeOf), key).toEqual([{ entity: 'page', id: page.id, title: `Stránka ${page.slug}`, field: 'sections', admin: `/admin/page/${page.id}`, block: { id: 'blk-list', type: 'custom_entries', heading: 'Our courses' } }])
      expect(res.body.places[0].locale).toBeNull()
      expect(res.body.places[0].block.label).toEqual(expect.objectContaining({ en: 'Entries' }))
    }
    // A field no block uses has no place; the chosen entries show nothing of their own.
    expect((await field('teacher')).places).toEqual([])
    expect((await field('level')).places).toEqual([])

    // Without a field: the blocks that show the type, and how many entries use each field.
    const all = await adminA.get('/api/cms/_model/usage?type=custom_course')
    expect(all.status).toBe(200)
    expect(all.body.places.map(placeOf)).toEqual([
      { entity: 'page', id: page.id, title: `Stránka ${page.slug}`, field: 'sections', admin: `/admin/page/${page.id}`, block: { id: 'blk-list', type: 'custom_entries', heading: 'Our courses' } },
      { entity: 'page', id: page.id, title: `Stránka ${page.slug}`, field: 'sections', admin: `/admin/page/${page.id}`, block: { id: 'blk-chosen', type: 'custom_chosen', heading: null } },
    ])
    expect(all.body.fields).toEqual({ cover: 1, perex: 1, startsAt: 1 })
    // The number of entries of the type, and of the entries holding a value of a field.
    expect(all.body.entries).toBe((await siteQuery(t.a, 'select count(*)::int n from custom_course'))[0].n)
    expect((await field('teacher')).values).toBe((await siteQuery(t.a, 'select count(*)::int n from custom_course where teacher is not null'))[0].n)
    expect((await field('teacher')).values).toBeGreaterThan(0)

    // A translation is read too: its block is listed with its language, and the entry is counted once.
    await siteQuery(t.a, `insert into page_locales (parent_id, locale, sections) values ($1, 'en', $2::jsonb)`, [page.id, JSON.stringify([{ id: 'blk-en', type: 'custom_chosen', heading: 'Chosen', layout: 'rows', source: { type: 'custom_course', show: { label: 'level', more: ['perex'] }, entries: [course.id] } }])])
    try {
      const level = (await field('level')).places
      expect(level.map((p: any) => [p.id, p.locale, p.block.id])).toEqual([[page.id, 'en', 'blk-en']])
      expect(level[0].title).toBe(`Stránka ${page.slug}`)
      const again = (await adminA.get('/api/cms/_model/usage?type=custom_course')).body
      expect(again.fields).toEqual({ cover: 1, perex: 1, startsAt: 1, level: 1 })
    }
    finally {
      await siteQuery(t.a, `delete from page_locales where parent_id = $1`, [page.id])
    }
    expect((await field('level')).places).toEqual([])
    // Nobody else's: B's type has no blocks, and a field that does not exist is not found.
    expect((await adminA.get('/api/cms/_model/usage?type=custom_course&field=nope')).status).toBe(404)
    expect((await adminA.get('/api/cms/_model/usage?type=custom_recipe')).status).toBe(404)
  })

  it('refuses to hide what a block shows or orders by, names the page and the block, and allows it once the block no longer uses it', async () => {
    await mustChange(adminA, [{ op: 'field.add', type: 'custom_course', field: textField('scratch') }])
    const m = await model(adminA)
    const refuse = async (op: unknown) => {
      const res = await adminA.post('/api/cms/_model', { baseVersion: m.version, ops: [op] })
      expect(res.status, JSON.stringify(res.body)).toBe(409)
      expect(res.body.data.code).toBe('in-use')
      expect(res.body.data.op).toBe(0)
      return res.body.data
    }
    const named = { entity: 'page', id: page.id, title: `Stránka ${page.slug}`, field: 'sections', admin: `/admin/page/${page.id}`, block: { id: 'blk-list', type: 'custom_entries', heading: 'Our courses' } }
    // A field a block shows, and the one it orders by (the order is not shown anywhere).
    for (const key of ['perex', 'cover', 'startsAt']) {
      const data = await refuse({ op: 'field.remove', type: 'custom_course', key })
      expect(data.places.map(placeOf), key).toEqual([named])
      expect(data.message).toMatch(/shown or used to order a list/)
    }
    expect((await model(adminA)).version).toBe(m.version)
    expect(await fieldKeys(adminA, 'custom_course')).toEqual(expect.arrayContaining(['perex', 'cover', 'startsAt']))

    // A field no block uses can be hidden.
    expect((await change(adminA, [{ op: 'field.remove', type: 'custom_course', key: 'scratch' }])).status).toBe(200)
    expect((await change(adminA, [{ op: 'field.restore', type: 'custom_course', key: 'scratch' }])).status).toBe(200)

    // A type with a block of its own is refused, and goes once the block is gone.
    await adminA.patch(`/api/cms/page/${page.id}`, { sections: [LIST, CHOSEN, EVENTS, ordinary] })
    const ev = await adminA.post('/api/cms/_model', { baseVersion: (await model(adminA)).version, ops: [{ op: 'type.remove', type: 'custom_event' }] })
    expect(ev.status, JSON.stringify(ev.body)).toBe(409)
    expect(ev.body.data.code).toBe('in-use')
    expect(ev.body.data.message).toMatch(/blocks on pages show its entries/)
    expect(ev.body.data.places.map(placeOf)).toEqual([{ ...named, block: { id: 'blk-events', type: 'custom_entries', heading: 'Events' } }])
    await adminA.patch(`/api/cms/page/${page.id}`, { sections: [LIST, CHOSEN, ordinary] })
    expect((await change(adminA, [{ op: 'type.remove', type: 'custom_event' }])).status).toBe(200)
    try {
      expect((await get(t.a, '/api/content/_types')).body.types.map((x: any) => x.name)).not.toContain('custom_event')
    }
    finally {
      expect((await change(adminA, [{ op: 'type.restore', type: 'custom_event' }])).status).toBe(200)
    }
    expect((await get(t.a, '/api/content/_types')).body.types.map((x: any) => x.name)).toContain('custom_event')

    // Changed so that it does not use the fields, the block lets them go.
    const calm = { ...LIST, source: { type: 'custom_course', show: { image: 'cover' }, order: { by: 'level', dir: 'desc' } } }
    expect((await adminA.patch(`/api/cms/page/${page.id}`, { sections: [calm, CHOSEN, ordinary] })).status).toBe(200)
    const hid = await change(adminA, [{ op: 'field.remove', type: 'custom_course', key: 'perex' }, { op: 'field.remove', type: 'custom_course', key: 'startsAt' }])
    expect(hid.status, JSON.stringify(hid.body)).toBe(200)
    expect((await change(adminA, [{ op: 'field.remove', type: 'custom_course', key: 'cover' }])).status).toBe(409)
    // Removed from the page, the last one goes too; all come back.
    expect((await adminA.patch(`/api/cms/page/${page.id}`, { sections: [CHOSEN, ordinary] })).status).toBe(200)
    expect((await change(adminA, [{ op: 'field.remove', type: 'custom_course', key: 'cover' }])).status).toBe(200)
    const back = await change(adminA, [{ op: 'field.restore', type: 'custom_course', key: 'perex' }, { op: 'field.restore', type: 'custom_course', key: 'startsAt' }, { op: 'field.restore', type: 'custom_course', key: 'cover' }])
    expect(back.status, JSON.stringify(back.body)).toBe(200)
    expect((await adminA.patch(`/api/cms/page/${page.id}`, { sections: [LIST, CHOSEN, ordinary] })).status).toBe(200)
  })

  it('lists on `attention` the blocks that name a type or a field the site does not have, and the page still answers', async () => {
    expect((await adminB.get('/api/cms/_model/attention')).body).toEqual({ places: [] })
    expect((await adminA.get('/api/cms/_model/attention')).body).toEqual({ places: [] })
    const good = { id: 'b-good', type: 'custom_entries', heading: 'Recipes', layout: 'cards', source: { type: 'custom_recipe', show: { more: ['minutes', 'createdAt'] }, order: { by: 'minutes', dir: 'asc' } } }
    const noField = { id: 'b-field', type: 'custom_entries', heading: 'Slow', layout: 'cards', source: { type: 'custom_recipe', show: { text: 'calories' }, order: { by: 'minutes', dir: 'asc' } } }
    const noType = { id: 'b-type', type: 'custom_chosen', heading: '', layout: 'rows', source: { type: 'custom_nothing', entries: [] } }
    const b = bPage = await makePage(adminB, 'recepty-na-webu', [good])
    // Broken behind the admin's back: a field was hidden, a type taken away.
    await siteQuery(t.b, 'update page set sections = $1::jsonb where id = $2', [JSON.stringify([good, noField, noType]), b.id])

    const res = await adminB.get('/api/cms/_model/attention')
    expect(res.status).toBe(200)
    expect(res.headers.get('cache-control')).toBe('no-store')
    expect(res.body.places.map((p: any) => ({ ...placeOf(p), locale: p.locale, missing: p.missing }))).toEqual([
      { entity: 'page', id: b.id, title: `Stránka ${b.slug}`, field: 'sections', admin: `/admin/page/${b.id}`, locale: null, block: { id: 'b-field', type: 'custom_entries', heading: 'Slow' }, missing: { fields: ['calories'] } },
      { entity: 'page', id: b.id, title: `Stránka ${b.slug}`, field: 'sections', admin: `/admin/page/${b.id}`, locale: null, block: { id: 'b-type', type: 'custom_chosen', heading: null }, missing: { type: 'custom_nothing' } },
    ])
    expect(res.body.places[1].block.label).toEqual(expect.objectContaining({ en: 'Chosen entries' }))
    // The page is served as it is stored.
    const served = await get(t.b, `/api/content/page/${b.slug}`)
    expect(served.status).toBe(200)
    expect(served.body.item.sections.map((s: any) => s.id)).toEqual(['b-good', 'b-field', 'b-type'])
    // A's list has nothing of B's.
    expect((await adminA.get('/api/cms/_model/attention')).body).toEqual({ places: [] })
  })

  it('names a type of the other site as missing, and gives nothing of one site to the other', async () => {
    const foreign = { id: 'b-foreign', type: 'custom_entries', heading: 'Recipes', layout: 'cards', source: { type: 'custom_recipe', show: { more: ['minutes'] } } }
    const a = await makePage(adminA, 'cizi-recepty', [foreign])
    // Only the shape of a binding is checked on saving, so it is accepted and delivered as data.
    const served = await get(t.a, `/api/content/page/${a.slug}`)
    expect(served.status).toBe(200)
    expect(served.body.item.sections[0].source).toEqual(foreign.source)

    const attention = (await adminA.get('/api/cms/_model/attention')).body
    expect(attention.places.map((p: any) => [p.id, p.block.id, p.missing])).toEqual([[a.id, 'b-foreign', { type: 'custom_recipe' }]])
    // B names none of A's: not the page, not the type, not A's field names.
    const ofB = JSON.stringify((await adminB.get('/api/cms/_model/attention')).body)
    expect(ofB).not.toContain(a.id)
    expect(ofB).not.toMatch(/custom_course|perex|startsAt|cizi-recepty/)
    // Each site's usage walk reads its own pages: B's blocks of its type are B's, and none of them is A's page.
    expect((await adminB.get('/api/cms/_model/usage?type=custom_recipe')).body.places.map((p: any) => p.id)).toEqual([bPage.id, bPage.id])
    expect((await adminA.get('/api/cms/_model/usage?type=custom_course')).body.places.map((p: any) => p.id)).not.toContain(a.id)
  })

  it('offers the two blocks to the editor of a site with a type of its own, and to no other', async () => {
    const offered = async (c: Client) => {
      const sections = ((await graph(c)).find((e) => e.name === 'page')?.fields ?? []).find((x: any) => x.key === 'sections')
      return Object.keys(sections?.meta?.blocks ?? {})
    }
    const withBlocks = ['hero', 'text', 'custom_entries', 'custom_chosen']
    expect(await offered(adminA)).toEqual(expect.arrayContaining(withBlocks))
    expect(await offered(adminB)).toEqual(expect.arrayContaining(withBlocks))
    // Offered to an editor of A too: the graph is shaped per person, not per role of the feature.
    expect(await offered(siteClient(t.a, 'editor'))).toEqual(expect.arrayContaining(withBlocks))

    // A site that has no type of its own does not offer them, the others do.
    const { row, site: c } = await t.makeThirdSite()
    await t.writeDirectory([...t.rows, row])
    try {
      await until('site C to be ready', () => tenantGet(c.url, '/api/health/ready'), (r) => r.status === 200 && r.body?.migrations === 'done')
      const made = await tenantPost(c.url, '/api/cms/_auth/setup', { name: 'Cecil', email: 'cecil@test.local', password: 'correct horse battery', token: c.setupToken })
      expect(made.status).toBe(201)
      const adminC = siteClient(c, { cookie: made.cookie })
      const keys = await offered(adminC)
      expect(keys).toEqual(expect.arrayContaining(['hero', 'text']))
      expect(keys).not.toContain('custom_entries')
      expect(keys).not.toContain('custom_chosen')
      // It can still save a page: ordinary blocks, and a block of these two kinds that was stored elsewhere.
      const ok = await adminC.post('/api/cms/page', { title: 'C', slug: 'c-home', sections: [ordinary] })
      expect(ok.status, JSON.stringify(ok.body)).toBe(201)
      const kept = await adminC.patch(`/api/cms/page/${ok.body.row.id}`, { sections: [ordinary, LIST] })
      expect(kept.status, JSON.stringify(kept.body)).toBe(200)
      expect((await adminC.patch(`/api/cms/page/${ok.body.row.id}`, { title: 'C again', sections: (await sectionsOf(adminC, ok.body.row.id)) })).status).toBe(200)
      expect((await sectionsOf(adminC, ok.body.row.id)).map((x) => x.id)).toEqual(['blk-text', 'blk-list'])
      // The block stored there names a type the site does not have, and the site says so.
      expect((await adminC.get('/api/cms/_model/attention')).body.places.map((p: any) => [p.block.id, p.missing])).toEqual([['blk-list', { type: 'custom_course' }]])
      // The others still offer them.
      expect(await offered(adminA)).toContain('custom_entries')
    }
    finally {
      await t.writeDirectory(t.rows)
    }
  }, 60_000)

  it('does not offer them on the server without the switch (the single site of this project), and keeps what is stored there', async () => {
    const single = await signIn('admin')
    const sections = (((await single.get('/api/cms/_graph')).body as any[]).find((e) => e.name === 'page').fields as any[]).find((x) => x.key === 'sections')
    expect(Object.keys(sections.meta.blocks)).toEqual(expect.arrayContaining(['hero', 'text']))
    expect(Object.keys(sections.meta.blocks)).not.toContain('custom_entries')
    expect(Object.keys(sections.meta.blocks)).not.toContain('custom_chosen')
    const slug = `single-${Math.random().toString(36).slice(2, 8)}`
    const made = await single.post('/api/cms/page', { title: 'Single', slug, sections: [ordinary] })
    expect(made.status, JSON.stringify(made.body)).toBe(201)
    try {
      expect((await single.patch(`/api/cms/page/${made.body.row.id}`, { sections: [ordinary, LIST] })).status).toBe(200)
      expect((await single.patch(`/api/cms/page/${made.body.row.id}`, { title: 'Single again', sections: (await single.get(`/api/cms/page/${made.body.row.id}`)).body.row.sections })).status).toBe(200)
      expect(((await single.get(`/api/cms/page/${made.body.row.id}`)).body.row.sections as any[]).map((x) => x.id)).toEqual(['blk-text', 'blk-list'])
    }
    finally {
      await single.delete(`/api/cms/page/${made.body.row.id}`)
    }
  })

  it('describes the visible types of a site for the website, and the other site\'s not at all', async () => {
    const typesOf = async (site: TenantSite) => (await get(site, '/api/content/_types')).body.types as any[]
    const a = await typesOf(t.a)
    expect(a.map((x) => x.name)).toEqual(expect.arrayContaining(['custom_course', 'custom_event']))
    const c = a.find((x) => x.name === 'custom_course')
    expect(c).toMatchObject({ label: text('Courses'), labelSingular: text('Course'), titleField: 'title', path: '/kurzy/:slug', prefix: 'kurzy', publish: true, page: { image: null, summary: null } })
    const by = Object.fromEntries(c.fields.map((x: any) => [x.key, x]))
    expect(Object.keys(by)).toEqual(expect.arrayContaining(['title', 'level', 'cover', 'author', 'teacher', 'startsAt', 'perex']))
    expect(by.perex).toEqual({ key: 'perex', type: 'text', label: text('Perex'), long: true })
    expect(by.level).toEqual({ key: 'level', type: 'select', label: text('Level'), options: [{ value: 'beginner', label: text('Beginner') }, { value: 'advanced', label: text('Advanced') }] })
    expect(by.author).toMatchObject({ type: 'relation', to: 'author' })
    // B's type is B's.
    expect(JSON.stringify(a)).not.toMatch(/custom_recipe|recepty|minutes/)
    const b = await typesOf(t.b)
    expect(b.map((x) => x.name)).toEqual(['custom_recipe'])
    expect(b[0].path).toBe('/recepty/:slug')
    expect(b[0].fields.map((x: any) => x.key)).toContain('minutes')
    expect(JSON.stringify(b)).not.toMatch(/custom_course|kurzy|teacher/)

    // A hidden field is not in it; a removed choice is, marked.
    const hid = await change(adminA, [{ op: 'field.remove', type: 'custom_course', key: 'scratch' }, { op: 'field.update', type: 'custom_course', key: 'level', removeOptions: ['advanced'] }])
    expect(hid.status, JSON.stringify(hid.body)).toBe(200)
    try {
      const now = (await typesOf(t.a)).find((x) => x.name === 'custom_course')
      expect(now.fields.map((x: any) => x.key)).not.toContain('scratch')
      expect(now.fields.find((x: any) => x.key === 'level').options).toEqual([{ value: 'beginner', label: text('Beginner') }, { value: 'advanced', label: text('Advanced'), removed: true }])
    }
    finally {
      const back = await change(adminA, [{ op: 'field.restore', type: 'custom_course', key: 'scratch' }, { op: 'field.update', type: 'custom_course', key: 'level', restoreOptions: ['advanced'] }])
      expect(back.status, JSON.stringify(back.body)).toBe(200)
    }
    const after = (await typesOf(t.a)).find((x) => x.name === 'custom_course')
    expect(after.fields.map((x: any) => x.key)).toContain('scratch')
    expect(after.fields.find((x: any) => x.key === 'level').options.every((o: any) => !o.removed)).toBe(true)

    // The single site has none, and it is a route of the public content API (no sign-in).
    const single = await new Client().get('/api/content/_types')
    expect(single.status).toBe(200)
    expect(single.body).toEqual({ types: [] })
    expect((await get({ url: t.a.url }, '/api/content/_types')).headers.get('cache-control')).toMatch(/max-age/)
  })
})

/** A purge of what the ops name, by hand (an administrator's request), against the version it reads. */
const purgeBy = async (c: Client, what: { types?: string[]; fields?: { type: string; key: string }[] }) => change(c, [{ op: 'purge', ...what }])

/** Wait until the thing may be deleted by hand (the wait after its removal has passed). */
const waitDeleteWait = (hiddenAt: number) => sleep(Math.max(0, DELETE_WAIT_MS + 300 - (performance.now() - hiddenAt)))

describe('deleting what was removed', () => {
  it('has the server delete what was removed empty, keep what held content, and keep what got content after it was hidden', async () => {
    await mustChange(adminA, [
      { op: 'field.add', type: 'custom_course', field: textField('tmpEmpty') },
      { op: 'field.add', type: 'custom_course', field: textField('tmpFull') },
      { op: 'field.add', type: 'custom_course', field: textField('tmpRace') },
      { op: 'type.add', name: 'custom_tmp', label: text('Temporary') },
      { op: 'type.add', name: 'custom_keep', label: text('Kept') },
    ])
    expect((await adminA.patch(`/api/cms/custom_course/${course.id}`, { tmpFull: 'keep me' })).status).toBe(200)
    const kept = await adminA.post('/api/cms/custom_keep', { title: 'Zůstane' })
    expect(kept.status, JSON.stringify(kept.body)).toBe(201)
    expect(await columnsOf(t.a, 'custom_course')).toEqual(expect.arrayContaining(['tmp_empty', 'tmp_full', 'tmp_race']))

    const hid = await change(adminA, [
      { op: 'field.remove', type: 'custom_course', key: 'tmpEmpty' },
      { op: 'field.remove', type: 'custom_course', key: 'tmpFull' },
      { op: 'field.remove', type: 'custom_course', key: 'tmpRace' },
      { op: 'type.remove', type: 'custom_tmp' },
      { op: 'type.remove', type: 'custom_keep' },
    ])
    expect(hid.status, JSON.stringify(hid.body)).toBe(200)
    const hiddenAt = performance.now()
    const fieldsOf = (m: any, type: string) => Object.fromEntries(m.doc.types.find((x: any) => x.name === type).fields.map((f: any) => [f.key, f]))
    let m = await model(adminA)
    expect(fieldsOf(m, 'custom_course').tmpEmpty.removedEmpty).toBe(true)
    expect(fieldsOf(m, 'custom_course').tmpRace.removedEmpty).toBe(true)
    expect(fieldsOf(m, 'custom_course').tmpFull.removedEmpty).toBe(false)
    expect(m.doc.types.find((x: any) => x.name === 'custom_keep').removedEmpty).toBe(false)
    // A request of the old model writes to the column after it was hidden (the API cannot: the field is hidden).
    await siteQuery(t.a, 'update custom_course set tmp_race = $1 where id = $2', ['late', course.id])

    // (a) What was removed empty goes after the short hour, the table and the column with it.
    await until('the empty removed column and type to be deleted', async () => { await adminA.get('/api/cms/_model'); return [await columnsOf(t.a, 'custom_course'), await tablesOf(t.a)] as const }, ([cols, tables]) => !cols.includes('tmp_empty') && !tables.includes('custom_tmp'), PURGE_EMPTY_MS + 8000)
    const emptyGoneAfter = performance.now() - hiddenAt
    expect(emptyGoneAfter).toBeGreaterThanOrEqual(PURGE_EMPTY_MS - 500)

    // (b) and (e) What held content, and what got content after the hiding, stays: well after the hour.
    const stayUntil = hiddenAt + 2 * PURGE_EMPTY_MS + 1500
    while (performance.now() < stayUntil) { await adminA.get('/api/cms/_model'); await sleep(250) }
    expect(await columnsOf(t.a, 'custom_course')).toEqual(expect.arrayContaining(['tmp_full', 'tmp_race']))
    expect(await tablesOf(t.a)).toContain('custom_keep')
    m = await model(adminA)
    expect(fieldsOf(m, 'custom_course').tmpFull.removedAt).toBeTruthy()
    expect(fieldsOf(m, 'custom_course').tmpRace.removedAt).toBeTruthy()
    expect(fieldsOf(m, 'custom_course').tmpRace.removedEmpty).toBe(false)
    expect(fieldsOf(m, 'custom_course')).not.toHaveProperty('tmpEmpty')
    expect(m.doc.types.map((x: any) => x.name)).not.toContain('custom_tmp')
    expect(m.doc.types.find((x: any) => x.name === 'custom_keep').removedAt).toBeTruthy()
    console.info(`[timing] the server's deletion (test knob ${PURGE_EMPTY_MS} ms): the empty field and type went after ${emptyGoneAfter.toFixed(0)} ms; what held content was still there after ${(performance.now() - hiddenAt).toFixed(0)} ms`)

    // It is not deleted later either: another look after the sweep ran again, then restore with the content.
    await sleep(1500)
    await adminA.get('/api/cms/_model')
    expect(await columnsOf(t.a, 'custom_course')).toEqual(expect.arrayContaining(['tmp_full', 'tmp_race']))
    const back = await change(adminA, [{ op: 'field.restore', type: 'custom_course', key: 'tmpFull' }, { op: 'field.restore', type: 'custom_course', key: 'tmpRace' }, { op: 'type.restore', type: 'custom_keep' }])
    expect(back.status, JSON.stringify(back.body)).toBe(200)
    const row = (await adminA.get(`/api/cms/custom_course/${course.id}`)).body.row
    expect(row.tmpFull).toBe('keep me')
    expect(row.tmpRace).toBe('late')
    expect((await adminA.get('/api/cms/custom_keep')).body.rows.map((r: any) => r.title)).toEqual(['Zůstane'])
    // Clean up: hide them again (they are deleted by hand in the next test's way, or stay hidden).
    const again = await change(adminA, [{ op: 'field.remove', type: 'custom_course', key: 'tmpFull' }, { op: 'field.remove', type: 'custom_course', key: 'tmpRace' }, { op: 'type.remove', type: 'custom_keep' }])
    expect(again.status, JSON.stringify(again.body)).toBe(200)
    const goAt = performance.now()
    await waitDeleteWait(goAt)
    const gone = await purgeBy(adminA, { types: ['custom_keep'], fields: [{ type: 'custom_course', key: 'tmpFull' }, { type: 'custom_course', key: 'tmpRace' }] })
    expect(gone.status, JSON.stringify(gone.body)).toBe(200)
    // The sweep is the server's own: B was not touched by it.
    expect((await model(adminB)).doc.types[0].fields.every((f: any) => !f.removedAt)).toBe(true)
  }, 90_000)

  it('has an administrator delete a removed type and a removed field for good, with what the system kept of them, and frees the names', async () => {
    const WORD_FIELD = 'zebrofantnik'
    const WORD_TYPE = 'quasarvortek'
    await mustChange(adminA, [
      { op: 'type.add', name: 'custom_doomed', label: text('Doomed') },
      { op: 'field.add', type: 'custom_doomed', field: textField('note') },
      { op: 'field.add', type: 'custom_course', field: textField('doomedText') },
    ])
    // Entries through the API, so revisions are written.
    const one = await adminA.post('/api/cms/custom_doomed', { title: `Jeden ${WORD_TYPE}`, note: 'první poznámka' })
    const two = await adminA.post('/api/cms/custom_doomed', { title: 'Dva', note: `druhá ${WORD_TYPE}` })
    expect(one.status, JSON.stringify(one.body)).toBe(201)
    expect(two.status, JSON.stringify(two.body)).toBe(201)
    expect((await adminA.patch(`/api/cms/custom_doomed/${one.body.row.id}`, { note: 'změněná poznámka' })).status).toBe(200)
    expect((await adminA.patch(`/api/cms/custom_course/${course.id}`, { doomedText: 'prvni verze' })).status).toBe(200)
    expect((await adminA.patch(`/api/cms/custom_course/${course.id}`, { doomedText: `druha verze ${WORD_FIELD}` })).status).toBe(200)
    // Collab documents of the type's entries (as a browser's editing session leaves them), and a neighbour that is not the type's.
    const epoch = '11111111-1111-4111-8111-111111111111'
    for (const name of [`custom_doomed/${one.body.row.id}`, `custom_doomed/${one.body.row.id}/en`, `custom_doomed/${one.body.row.id}~unsaved`, `custom_doomed/${two.body.row.id}~by`, `custom_doomedx/${one.body.row.id}`, `customXdoomed/${one.body.row.id}`]) {
      await siteQuery(t.a, `insert into cms_collab (name, epoch, state) values ($1, $2, '')`, [name, epoch])
    }

    const count = async (text: string, params: unknown[] = []) => Number((await siteQuery(t.a, text, params))[0].n)
    const revisionsOf = (type: string) => count('select count(*)::int n from cms_revisions where entity = $1', [type])
    const withKey = () => count(`select count(*)::int n from cms_revisions where entity = 'custom_course' and (jsonb_exists(data, 'doomedText') or jsonb_exists(changed, 'doomedText'))`)
    const searchRows = (type: string) => count('select count(*)::int n from cms_search where entity = $1', [type])
    const courseHasWord = () => count(`select count(*)::int n from cms_search where entity = 'custom_course' and (body || ' ' || extra) ilike $1`, [`%${WORD_FIELD}%`])
    // Before: there is something to delete.
    expect(await revisionsOf('custom_doomed')).toBeGreaterThanOrEqual(3)
    expect(await withKey()).toBeGreaterThanOrEqual(2)
    const courseRevisions = await revisionsOf('custom_course')
    await until('the entries to be searchable', async () => [await searchRows('custom_doomed'), await courseHasWord()], ([a, b]) => a! >= 2 && b! >= 1)
    expect(await count(`select count(*)::int n from cms_collab where name like 'custom%doomed%'`)).toBe(6)

    // The number before deleting.
    const typeUsage = await adminA.get('/api/cms/_model/usage?type=custom_doomed')
    expect(typeUsage.status, JSON.stringify(typeUsage.body)).toBe(200)
    expect(typeUsage.body).toMatchObject({ places: [], entries: 2 })
    const fieldUsage = await adminA.get('/api/cms/_model/usage?type=custom_course&field=doomedText')
    expect(fieldUsage.body).toEqual({ places: [], values: 1 })

    const before = { b: await model(adminB), bTables: await tablesOf(t.b), bSeen: await seen(t.ipUrl, 'site-b') }
    const hid = await change(adminA, [{ op: 'type.remove', type: 'custom_doomed' }, { op: 'field.remove', type: 'custom_course', key: 'doomedText' }])
    expect(hid.status, JSON.stringify(hid.body)).toBe(200)
    const hiddenAt = performance.now()
    // The number is there for what is removed, too.
    expect((await adminA.get('/api/cms/_model/usage?type=custom_doomed')).body.entries).toBe(2)
    expect((await adminA.get('/api/cms/_model/usage?type=custom_course&field=doomedText')).body.values).toBe(1)

    // (d) Too soon: nothing is deleted.
    const soon = await purgeBy(adminA, { types: ['custom_doomed'], fields: [{ type: 'custom_course', key: 'doomedText' }] })
    expect(soon.status, JSON.stringify(soon.body)).toBe(422)
    expect(soon.body.data.code).toBe('too-soon')
    expect(soon.body.data.details.msLeft).toBeGreaterThan(0)
    expect(soon.body.data.details.msLeft).toBeLessThanOrEqual(DELETE_WAIT_MS)
    expect(await tablesOf(t.a)).toContain('custom_doomed')
    expect(await columnsOf(t.a, 'custom_course')).toContain('doomed_text')

    // (f) An editor may not (nothing is deleted either).
    await waitDeleteWait(hiddenAt)
    const mine = await model(adminA)
    const refused = await siteClient(t.a, 'editor').post('/api/cms/_model', { baseVersion: mine.version, ops: [{ op: 'purge', types: ['custom_doomed'] }] })
    expect(refused.status, JSON.stringify(refused.body)).toBe(403)
    expect(await tablesOf(t.a)).toContain('custom_doomed')

    // (c) An administrator deletes both for good.
    const deleted = await purgeBy(adminA, { types: ['custom_doomed'], fields: [{ type: 'custom_course', key: 'doomedText' }] })
    expect(deleted.status, JSON.stringify(deleted.body)).toBe(200)
    expect(await tablesOf(t.a)).not.toContain('custom_doomed')
    expect(await columnsOf(t.a, 'custom_course')).not.toContain('doomed_text')
    const after = await model(adminA)
    expect(after.doc.types.map((x: any) => x.name)).not.toContain('custom_doomed')
    expect(after.doc.types.find((x: any) => x.name === 'custom_course').fields.map((f: any) => f.key)).not.toContain('doomedText')
    // What the system kept of them is gone: revisions, collab documents, search rows.
    expect(await revisionsOf('custom_doomed')).toBe(0)
    expect(await withKey()).toBe(0)
    expect(await revisionsOf('custom_course')).toBe(courseRevisions)
    expect(await count(`select count(*)::int n from cms_revisions where entity = 'custom_course' and jsonb_exists(data, 'teacher')`)).toBeGreaterThan(0)
    expect(await count(`select count(*)::int n from cms_collab where name like 'custom%doomed%'`)).toBe(2)
    expect((await siteQuery(t.a, `select name from cms_collab where name like 'custom%doomed%'`)).map((r) => r.name as string).sort()).toEqual([`custom_doomedx/${one.body.row.id}`, `customXdoomed/${one.body.row.id}`].sort())
    expect(await searchRows('custom_doomed')).toBe(0)
    // The search index of the site is rebuilt by its next instance, without the deleted field's text.
    await until('the search index to be rebuilt without the field', async () => { await adminA.get('/api/cms/_model'); return [await courseHasWord(), await count(`select count(*)::int n from cms_state where key = 'search.index'`)] }, ([word, state]) => word === 0 && state === 1, 10_000)
    expect(await searchRows('custom_course')).toBeGreaterThan(0)

    // B was not touched.
    expect((await model(adminB)).version).toBe(before.b.version)
    expect(await tablesOf(t.b)).toEqual(before.bTables)
    expect((await seen(t.ipUrl, 'site-b')).loads).toBe(before.bSeen.loads)
    expect((await seen(t.ipUrl, 'site-b')).model).toEqual(before.bSeen.model)

    // The names are free: a type and a field of the same names are made, empty.
    expect((await change(adminA, [{ op: 'type.add', name: 'custom_doomed', label: text('Doomed') }, { op: 'field.add', type: 'custom_course', field: textField('doomedText') }])).status).toBe(200)
    expect(await tablesOf(t.a)).toContain('custom_doomed')
    expect((await siteQuery(t.a, 'select count(*)::int n from custom_doomed'))[0].n).toBe(0)
    expect((await siteQuery(t.a, 'select count(*)::int n from custom_course where doomed_text is not null'))[0].n).toBe(0)
    expect((await adminA.get(`/api/cms/custom_course/${course.id}`)).body.row.doomedText ?? null).toBeNull()
    // The usage route is for administrators.
    expect((await siteClient(t.a, 'editor').get('/api/cms/_model/usage?type=custom_doomed')).status).toBe(403)
    expect((await siteClient(t.a).get('/api/cms/_model/usage?type=custom_doomed')).status).toBe(401)
    console.info(`[timing] deletion by hand: allowed ${DELETE_WAIT_MS} ms after the removal (test knob); the purge itself took ${changeMs.at(-1)!.toFixed(0)} ms`)
  }, 90_000)

  it('takes a deleted rich-text field out of the shared-editing working copies, and keeps what was typed in the other fields', async () => {
    const GONE = 'plameniakovec'
    const KEPT = 'tucnakovina'
    const TYPED = 'lenochodnik'
    await mustChange(adminA, [
      { op: 'type.add', name: 'custom_memo', label: text('Memo') },
      { op: 'field.add', type: 'custom_memo', field: { key: 'keepText', type: 'richtext', label: text('Keep') } },
      { op: 'field.add', type: 'custom_memo', field: { key: 'goneText', type: 'richtext', label: text('Gone') } },
    ])
    const one = await adminA.post('/api/cms/custom_memo', { title: 'Both', keepText: doc(`saved ${KEPT}`), goneText: doc(`saved ${GONE}`) })
    const two = await adminA.post('/api/cms/custom_memo', { title: 'One', keepText: doc('only this') })
    expect(one.status, JSON.stringify(one.body)).toBe(201)
    expect(two.status, JSON.stringify(two.body)).toBe(201)
    const session = (id: string) => adminA.get<any>(`/api/cms/_collab/session?entity=custom_memo&id=${id}`)
    const s1 = await session(one.body.row.id)
    const s2 = await session(two.body.row.id)
    expect(s1.status, JSON.stringify(s1.body)).toBe(200)
    expect([...s1.body.fields].sort()).toEqual(['goneText', 'keepText'])
    const stored = async (name: string) => (await siteQuery(t.a, 'select epoch, state from cms_collab where name = $1', [name]))[0] as { epoch: string; state: string } | undefined
    const bytes = (state: string) => Buffer.from(state, 'base64')

    // Someone types into both fields and leaves without saving: the working copy is ahead of the entry.
    const tab = new Collaborator(adminA, s1.body)
    await tab.synced()
    tab.type(`typed ${TYPED}`, 'keepText')
    tab.type(`typed too ${GONE}`, 'goneText')
    await until('the typing to be stored', async () => bytes((await stored(s1.body.name))!.state), (b) => b.includes(TYPED) && b.includes(`typed too ${GONE}`), 20_000)
    tab.close()
    // Left-over text waiting aside, as a closed tab leaves it: one row with both fields, one with the deleted field only.
    const note = (values: Record<string, unknown>) => JSON.stringify({ by: 'Someone', at: new Date().toISOString(), values })
    await siteQuery(t.a, `insert into cms_collab (name, epoch, state) values ($1, gen_random_uuid(), $2), ($3, gen_random_uuid(), $4)`, [
      `${s1.body.name}~unsaved`, note({ keepText: doc(`aside ${KEPT}`), goneText: doc(`aside ${GONE}`) }),
      `${s2.body.name}~unsaved`, note({ goneText: doc(`aside ${GONE}`) }),
    ])
    const before2 = await stored(s2.body.name)

    const hid = await change(adminA, [{ op: 'field.remove', type: 'custom_memo', key: 'goneText' }])
    expect(hid.status, JSON.stringify(hid.body)).toBe(200)
    await waitDeleteWait(performance.now())
    // Removed only: the working copy still holds it (the content is kept).
    expect(bytes((await stored(s1.body.name))!.state).includes(GONE)).toBe(true)
    const deleted = await purgeBy(adminA, { fields: [{ type: 'custom_memo', key: 'goneText' }] })
    expect(deleted.status, JSON.stringify(deleted.body)).toBe(200)

    // No working copy of the type holds the field's text any more, as stored and inside the documents.
    const rows = await siteQuery(t.a, `select name, state from cms_collab where left(name, 12) = 'custom_memo/'`)
    for (const r of rows) {
      expect(String(r.state).includes(GONE), `${r.name} as stored`).toBe(false)
      if (!String(r.name).includes('~')) expect(bytes(r.state).includes(GONE), `${r.name} inside the document`).toBe(false)
    }
    // The document that held it is a new history, with the other field as it was typed.
    const after1 = (await stored(s1.body.name))!
    expect(after1.epoch).not.toBe(s1.body.epoch)
    expect(bytes(after1.state).includes(TYPED)).toBe(true)
    expect(bytes(after1.state).includes(KEPT)).toBe(true)
    // The one that never held it was not touched.
    expect(await stored(s2.body.name)).toEqual(before2)
    // The left-over text lost the field; a row with nothing else is gone.
    expect(Object.keys(JSON.parse((await stored(`${s1.body.name}~unsaved`))!.state).values)).toEqual(['keepText'])
    expect(await stored(`${s2.body.name}~unsaved`)).toBeUndefined()
    // A browser that holds the old history is refused, and the next one to open the entry is offered what was typed.
    const old = new Collaborator(adminA, s1.body)
    await expect(old.synced()).rejects.toThrow(/refused/)
    old.close()
    const again = await session(one.body.row.id)
    expect(again.status, JSON.stringify(again.body)).toBe(200)
    expect(again.body.fields).toEqual(['keepText'])
    expect(JSON.stringify(again.body.unsaved?.values?.keepText ?? null)).toContain(TYPED)
    expect(Object.keys(again.body.unsaved.values)).toEqual(['keepText'])
    const fresh = new Collaborator(adminA, again.body)
    await fresh.synced()
    expect(fresh.text('keepText')).toContain(KEPT)
    expect([...fresh.doc.share.keys()]).not.toContain('goneText')
    fresh.close()
    await mustChange(adminA, [{ op: 'type.remove', type: 'custom_memo' }])
  }, 90_000)

  it('refuses to delete a type while a field of another type points at it, and says which', async () => {
    await mustChange(adminA, [
      { op: 'type.add', name: 'custom_target', label: text('Target') },
      { op: 'type.add', name: 'custom_pointer', label: text('Pointer') },
      { op: 'field.add', type: 'custom_pointer', field: { key: 'target', type: 'relation', to: 'custom_target', label: text('Target') } },
    ])
    await mustChange(adminA, [{ op: 'field.remove', type: 'custom_pointer', key: 'target' }, { op: 'type.remove', type: 'custom_target' }])
    await sleep(DELETE_WAIT_MS + 300)
    const blocked = await purgeBy(adminA, { types: ['custom_target'] })
    expect(blocked.status, JSON.stringify(blocked.body)).toBe(422)
    expect(blocked.body.data.code).toBe('points-at-type')
    expect((await purgeBy(adminA, { types: ['custom_target'], fields: [{ type: 'custom_pointer', key: 'target' }] })).status).toBe(200)
    expect(await tablesOf(t.a)).not.toContain('custom_target')
    await mustChange(adminA, [{ op: 'type.remove', type: 'custom_pointer' }])
    await sleep(DELETE_WAIT_MS + 300)
    expect((await purgeBy(adminA, { types: ['custom_pointer'] })).status).toBe(200)
  }, 60_000)
})

describe('timings', () => {
  it('measures how long a change and the first request after it take (printed)', async () => {
    const changes: number[] = []
    const firsts: number[] = []
    for (let n = 1; n <= 5; n++) {
      const m = await model(adminA)
      const started = performance.now()
      const res = await adminA.post('/api/cms/_model', { baseVersion: m.version, ops: [{ op: 'field.add', type: 'custom_event', field: textField(`sample${n}`) }] })
      changes.push(performance.now() - started)
      expect(res.status, JSON.stringify(res.body)).toBe(200)
      const first = performance.now()
      expect((await adminA.get('/api/cms/custom_event')).status).toBe(200)
      firsts.push(performance.now() - first)
      expect(await fieldKeys(adminA, 'custom_event')).toContain(`sample${n}`)
    }
    const line = (xs: number[]) => `${xs.map((x) => x.toFixed(0)).join(', ')} ms (median ${[...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)]!.toFixed(0)} ms)`
    console.info(`[timing] structure change over HTTP, 5 samples (a field added): ${line(changes)}`)
    console.info(`[timing] first request after a change (the admin list of the type, which makes the new instance): ${line(firsts)}`)
    const warm = performance.now()
    await adminA.get('/api/cms/custom_event')
    console.info(`[timing] the same request once the instance is warm: ${(performance.now() - warm).toFixed(0)} ms`)
  })
})

describe('the model stays over an idle unload, a restart and a second process', () => {
  it('serves the types again after the site is unloaded for being idle, and in a process started afterwards', async () => {
    const one = await t.startInstance({ CMS_TEST_TENANCY_IDLE_MS: '1500' })
    const ip = `http://127.0.0.1:${one.port}`
    const siteOn = (site: TenantSite, port: number): TenantSite => ({ ...site, url: `http://${site.host}:${port}` })
    const clientOne = siteClient(siteOn(t.a, one.port), 'admin')
    const keys = async (c: Client) => (await fieldKeys(c, 'custom_course')).slice().sort()
    const expected = (await fieldKeys(adminA, 'custom_course')).slice().sort()
    expect(expected).toEqual(expect.arrayContaining(['title', 'slug', 'status', 'level', 'cover', 'author', 'teacher']))

    expect(await keys(clientOne)).toEqual(expected)
    expect((await get(siteOn(t.a, one.port), '/api/content/custom_course/python')).status).toBe(200)
    expect((await seen(ip, 'site-a')).loaded).toBe(true)
    const loads = (await seen(ip, 'site-a')).loads

    // Quiet for the idle time: A is unloaded (looking at the list does not load it).
    await until('A to be unloaded on the extra process', () => seen(ip, 'site-a'), (s) => s.loaded === false, 10_000)
    expect((await seen(ip, 'site-a')).model).toBeNull()

    // The next request makes it again, with the same types.
    expect(await keys(clientOne)).toEqual(expected)
    const item = await get(siteOn(t.a, one.port), '/api/content/custom_course/python')
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
    expect((await get(siteOn(t.a, two.port), '/api/content/custom_course/python')).body.item.teacher).toBe('Ada')
    expect((await get(siteOn(t.b, two.port), '/api/content/custom_recipe/polevka')).status).toBe(200)
    expect((await get(siteOn(t.b, two.port), '/api/content/custom_course')).status).toBe(404)
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
      expect(await fieldKeys(a2, 'custom_event')).not.toContain('fromOne')
      expect((await b2.get('/api/cms/custom_recipe')).status).toBe(200)
      const before = { a: await seen(ip, 'site-a'), b: await seen(ip, 'site-b') }
      expect(before.a.loaded).toBe(true)
      expect(before.b.loaded).toBe(true)

      // A change on instance one is served by instance two within about a second.
      const first = await change(adminA, [{ op: 'field.add', type: 'custom_event', field: textField('fromOne') }])
      expect(first.status, JSON.stringify(first.body)).toBe(200)
      const madeAt = performance.now()
      await until('instance two to serve the change', () => fieldKeys(a2, 'custom_event'), (keys: string[]) => keys.includes('fromOne'), 1500)
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
      const second = await a2.post('/api/cms/_model', { baseVersion: known.body.version, ops: [{ op: 'field.add', type: 'custom_event', field: textField('fromTwo') }] })
      expect(second.status, JSON.stringify(second.body)).toBe(200)
      expect(second.body.version).toBe(known.body.version + 1)
      await until('instance one to serve the second change', () => fieldKeys(adminA, 'custom_event'), (keys: string[]) => keys.includes('fromTwo'), 1500)
      expect(await fieldKeys(adminA, 'custom_event')).toEqual(expect.arrayContaining(['fromOne', 'fromTwo']))
      expect((await model(adminA)).version).toBe(second.body.version)
      // B was left alone on both instances.
      expect((await seen(ip, 'site-b')).loads).toBe(before.b.loads)
      expect((await seen(t.ipUrl, 'site-b')).model).toEqual(before.b.model)
      expect(await fieldKeys(adminB, 'custom_recipe')).not.toContain('fromTwo')
    }
    finally {
      await two.server.stop()
    }
    expectNoSiteErrors(two)
  }, 60_000)

  it('serves a deletion by hand made on one instance as gone on the other within about a second', async () => {
    const two = await t.startInstance()
    await two.server.waitForLog(/\[cms\] shared store: redis/, 15_000)
    const siteOn = (site: TenantSite): TenantSite => ({ ...site, url: `http://${site.host}:${two.port}` })
    const a2 = siteClient(siteOn(t.a), 'admin')
    try {
      await mustChange(adminA, [{ op: 'type.add', name: 'custom_twice', label: text('Twice') }, { op: 'field.add', type: 'custom_event', field: textField('twiceGone') }])
      expect((await a2.get('/api/cms/custom_twice')).status).toBe(200)
      expect(await fieldKeys(a2, 'custom_event')).toContain('twiceGone')
      const hid = await change(adminA, [{ op: 'type.remove', type: 'custom_twice' }, { op: 'field.remove', type: 'custom_event', key: 'twiceGone' }])
      expect(hid.status, JSON.stringify(hid.body)).toBe(200)
      const hiddenAt = performance.now()
      const names = async () => { const m = (await a2.get('/api/cms/_model')).body; return { types: m.doc.types.map((x: any) => x.name) as string[], fields: m.doc.types.find((x: any) => x.name === 'custom_event').fields.map((f: any) => f.key) as string[] } }
      expect((await names()).types).toContain('custom_twice')
      await waitDeleteWait(hiddenAt)
      const gone = await purgeBy(adminA, { types: ['custom_twice'], fields: [{ type: 'custom_event', key: 'twiceGone' }] })
      expect(gone.status, JSON.stringify(gone.body)).toBe(200)
      const doneAt = performance.now()
      await until('instance two to see the deletion', names, (n) => !n.types.includes('custom_twice') && !n.fields.includes('twiceGone'), 1500)
      console.info(`[timing] a deletion by hand made on instance one is seen on instance two after ${(performance.now() - doneAt).toFixed(0)} ms`)
      expect((await a2.get('/api/cms/custom_twice')).status).toBe(404)
      expect(await fieldKeys(a2, 'custom_event')).not.toContain('twiceGone')
    }
    finally {
      await two.server.stop()
    }
    expectNoSiteErrors(two)
  }, 60_000)
})
