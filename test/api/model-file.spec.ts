import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { Client } from '../helpers/api'
import { diffModelFile, type ModelFile } from '../../packages/cms/src/index'
import { expectNoSiteErrors, siteClient, siteQuery, startTenants, type Tenants, type TenantSite, until } from '../helpers/tenants'

// The model file and the code that runs against a site's own types (docs/model-file-plan.md,
// sections 6, 7, 10 and 11). Two sites A and B in one process, the feature on for both: site A
// makes `custom_course` and `custom_event`, site B makes `custom_recipe`.
//
// What is proven: the site gives its model file as it is now and as it was at an older version
// (an unknown version is 404, version 0 is the empty model, removed things are left out); a push
// as the CLI does it (file, diff, change) reaches the site, also when the owner changed the site
// in between; a registered file makes a change that would take away what it reads refuse (also as
// a dry run), while additions pass, and the refusal is lifted by removing the registration; a file
// the site does not fit is not stored (no table is made); a registration that already does not fit
// blocks nothing it did not make worse; the routes take an access token with the right "Content
// types" of a person who is an administrator now, and nobody else; a token never purges, never
// reaches the session-only routes, and its changes are named in the history and the audit log; a
// registration of one site means nothing to the other; a site with the feature off answers 404 on
// every new route and makes no table; a registration made on one instance refuses a change on the
// other; and a registration costs a change little.
//
// The describes build on each other in order (the premise first, then the file, the push, the
// fit, the registrations, the tokens, the history, the isolation, the switch off, two instances,
// the timing). Every describe puts back what it registers or changes in the roles.
let t: Tenants
let adminA: Client
let adminB: Client
let editorA: Client

/** Short wait the server knows for deleting a removed thing for good (the test knob), and a purge-empty timer that never fires here. */
const DELETE_WAIT_MS = 1500
const PURGE_EMPTY_MS = 600_000

const text = (label: string) => ({ en: label })
const textField = (key: string, extra: Record<string, unknown> = {}) => ({ key, type: 'text', label: text(key), ...extra })
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

const tablesOf = async (site: Pick<TenantSite, 'databaseUrl'>) => (await siteQuery(site, `select table_name from information_schema.tables where table_schema = 'public' and table_type = 'BASE TABLE' order by table_name`)).map((r) => r.table_name as string)
const codeTableOf = async (site: Pick<TenantSite, 'databaseUrl'>) => (await siteQuery(site, `select to_regclass('public.cms_model_code') as t`))[0].t as string | null

/** The current version and document of a site's model. */
async function model(c: Client): Promise<any> {
  const res = await c.get('/api/cms/_model')
  if (res.status !== 200) throw new Error(`GET /api/cms/_model: ${res.status} ${JSON.stringify(res.body)}`)
  return res.body
}

/** Change a site's structure against its current version (a change of the server's own between read and write is tried again). */
async function change(c: Client, ops: unknown[], extra: Record<string, unknown> = {}) {
  for (let round = 0; ; round++) {
    const m = await model(c)
    const res = await c.post('/api/cms/_model', { baseVersion: m.version, ops, ...extra })
    if (res.status === 409 && res.body?.data?.code === 'stale-version' && round < 4) continue
    return res
  }
}

async function mustChange(c: Client, ops: unknown[]) {
  const res = await change(c, ops)
  if (res.status !== 200) throw new Error(`change ${JSON.stringify(ops).slice(0, 300)}: ${res.status} ${JSON.stringify(res.body)}`)
  return res.body
}

const code = (res: { body: any }): string | undefined => res.body?.data?.code

/** A request with a token and no cookie, from an address of its own. */
function bearer(site: { url: string }, token: string, method: string, path: string, json?: unknown) {
  return new Client(site.url).request(method, path, { json, headers: { authorization: `Bearer ${token}` } })
}

/** The model file of a site now, through a session. */
async function fileOf(c: Client, version?: number): Promise<ModelFile> {
  const res = await c.get(`/api/cms/_model/file${version === undefined ? '' : `?version=${version}`}`)
  if (res.status !== 200) throw new Error(`GET file: ${res.status} ${JSON.stringify(res.body)}`)
  return res.body
}

/** A file that reads one type of the site as it is now. */
async function fileOfType(c: Client, name: string): Promise<ModelFile> {
  const file = await fileOf(c)
  return { ...file, types: file.types.filter((x) => x.name === name) }
}

const fieldKeysOf = (file: ModelFile, type: string): string[] => file.types.find((x) => x.name === type)?.fields.map((f) => f.key) ?? []

async function makeToken(c: Client, rights: Record<string, unknown>, name = 'model file test') {
  const res = await c.post('/api/cms/_auth/tokens', { name, rights: { write: false, publish: false, delete: false, media: false, entities: null, ...rights }, expiresInDays: null })
  if (res.status !== 201) throw new Error(`token: ${res.status} ${JSON.stringify(res.body)}`)
  return res.body as { token: { id: string; rights: Record<string, unknown> }; value: string }
}

/** Version and file of the premise's first step, for the older-version test. */
let thenFile: ModelFile
let adminId: string

beforeAll(async () => {
  t = await startTenants('modelfile', {
    NUXT_CMS_CUSTOM_TYPES: 'on',
    CMS_TEST_MODEL_PURGE_EMPTY_MS: String(PURGE_EMPTY_MS),
    CMS_TEST_MODEL_DELETE_WAIT_MS: String(DELETE_WAIT_MS),
  })
  adminA = siteClient(t.a, 'admin')
  adminB = siteClient(t.b, 'admin')
  editorA = siteClient(t.a, 'editor')
  adminId = t.a.users.admin
}, 240_000)

afterAll(async () => {
  try { expectNoSiteErrors(t) }
  finally { await t?.stop() }
})

describe('the premise', () => {
  it('site A makes custom_course and custom_event, site B makes custom_recipe', async () => {
    await mustChange(adminA, [{ op: 'type.add', name: 'custom_course', label: text('Courses'), labelSingular: text('Course'), page: { prefix: 'kurzy' }, publish: true }])
    thenFile = await fileOf(adminA)
    await mustChange(adminA, [
      { op: 'field.add', type: 'custom_course', field: textField('perex', { label: text('Perex') }) },
      { op: 'field.add', type: 'custom_course', field: { key: 'level', type: 'select', label: text('Level'), options: [{ value: 'beginner', label: text('Beginner') }, { value: 'advanced', label: text('Advanced') }] } },
      { op: 'field.add', type: 'custom_course', field: { key: 'price', type: 'number', label: text('Price') } },
      { op: 'field.add', type: 'custom_course', field: { key: 'startsAt', type: 'datetime', label: text('Starts at') } },
      { op: 'field.add', type: 'custom_course', field: { key: 'teacher', type: 'text', required: true, label: text('Teacher') } },
    ])
    await mustChange(adminA, [{ op: 'type.add', name: 'custom_event', label: text('Events'), labelSingular: text('Event'), page: { prefix: 'akce' }, publish: true }])
    await mustChange(adminA, [{ op: 'field.add', type: 'custom_event', field: textField('note') }])
    await mustChange(adminB, [{ op: 'type.add', name: 'custom_recipe', label: text('Recipes'), labelSingular: text('Recipe'), page: { prefix: 'recepty' }, publish: true }])
    expect(fieldKeysOf(await fileOf(adminA), 'custom_course')).toEqual(expect.arrayContaining(['perex', 'level', 'price', 'startsAt', 'teacher']))
  })
})

describe('the model file route', () => {
  it('gives the site\'s file: format 1, the site\'s address, the current version and its types', async () => {
    const m = await model(adminA)
    const res = await adminA.get('/api/cms/_model/file')
    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({ format: 1, site: t.a.url, version: m.version })
    expect(res.body.types.map((x: any) => x.name).sort()).toEqual(['custom_course', 'custom_event'])
    const course = res.body.types.find((x: any) => x.name === 'custom_course')
    expect(course.fields.map((f: any) => f.key)).toEqual(expect.arrayContaining(['perex', 'level', 'price', 'startsAt', 'teacher']))
    expect(course.fields.find((f: any) => f.key === 'teacher').required).toBe(true)
    expect(course.fields.find((f: any) => f.key === 'level').options.map((o: any) => o.value)).toEqual(['beginner', 'advanced'])
    // B's file is B's.
    const b = await adminB.get('/api/cms/_model/file')
    expect(b.body.types.map((x: any) => x.name)).toEqual(['custom_recipe'])
    expect(b.body.site).toBe(t.b.url)
  })

  it('gives an older version as it was, the empty model for version 0, and 404 for a version not kept', async () => {
    const now = await fileOf(adminA)
    const then = await fileOf(adminA, thenFile.version)
    expect(then).toEqual(thenFile)
    expect(then.version).toBeLessThan(now.version)
    expect(fieldKeysOf(then, 'custom_course')).not.toContain('perex')
    // The current version asked for by number is the current file.
    expect(await fileOf(adminA, now.version)).toEqual(now)
    const zero = await adminA.get('/api/cms/_model/file?version=0')
    expect(zero.status).toBe(200)
    expect(zero.body).toEqual({ format: 1, site: t.a.url, version: 0, types: [] })
    const future = await adminA.get(`/api/cms/_model/file?version=${now.version + 5}`)
    expect(future.status).toBe(404)
    expect(code(future)).toBe('version-not-kept')
    expect((await adminA.get('/api/cms/_model/file?version=abc')).status).toBe(422)
  })

  it('leaves out a removed field and a removed type', async () => {
    await mustChange(adminA, [{ op: 'type.add', name: 'custom_temp', label: text('Temp') }])
    await mustChange(adminA, [{ op: 'field.add', type: 'custom_temp', field: textField('gone') }, { op: 'field.add', type: 'custom_event', field: textField('scrap') }])
    let file = await fileOf(adminA)
    expect(fieldKeysOf(file, 'custom_temp')).toContain('gone')
    expect(fieldKeysOf(file, 'custom_event')).toContain('scrap')
    await mustChange(adminA, [{ op: 'field.remove', type: 'custom_temp', key: 'gone' }, { op: 'field.remove', type: 'custom_event', key: 'scrap' }])
    file = await fileOf(adminA)
    expect(fieldKeysOf(file, 'custom_temp')).not.toContain('gone')
    expect(fieldKeysOf(file, 'custom_event')).not.toContain('scrap')
    await mustChange(adminA, [{ op: 'type.remove', type: 'custom_temp' }])
    file = await fileOf(adminA)
    expect(file.types.map((x) => x.name)).not.toContain('custom_temp')
    // Version before the removal still has it.
    expect((await fileOf(adminA, file.version - 1)).types.map((x) => x.name)).toContain('custom_temp')
  })
})

describe('a push as the CLI does it', () => {
  it('reads the file, changes it locally, sends the difference against its version, and the site has the changes', async () => {
    const base = await fileOf(adminA)
    const next: ModelFile = structuredClone(base)
    const course = next.types.find((x) => x.name === 'custom_course')!
    course.fields.push({ key: 'seats', type: 'number', label: text('Seats') } as any)
    ;(course.fields.find((f) => f.key === 'price') as any).label = text('Price (CZK)')
    const diff = diffModelFile(base, next)
    expect(diff.problems).toEqual([])
    expect(diff.ops.length).toBeGreaterThan(0)
    const res = await adminA.post('/api/cms/_model', { baseVersion: base.version, ops: diff.ops })
    expect(res.status, JSON.stringify(res.body)).toBe(200)
    const after = await fileOf(adminA)
    expect(fieldKeysOf(after, 'custom_course')).toContain('seats')
    expect((after.types.find((x) => x.name === 'custom_course')!.fields.find((f) => f.key === 'price') as any).label).toEqual(text('Price (CZK)'))
  })

  it('keeps the owner\'s change made in between: the difference is against the base, sent against the current version', async () => {
    const base = await fileOf(adminA)
    // The developer works from `base` locally.
    const local: ModelFile = structuredClone(base)
    local.types.find((x) => x.name === 'custom_course')!.fields.push({ key: 'online', type: 'boolean', label: text('Online') } as any)
    // The owner changes the site meanwhile.
    await mustChange(adminA, [{ op: 'field.add', type: 'custom_course', field: textField('room') }])
    // The CLI: ask for the base by its version, diff base to local, send against the current version.
    const baseAgain = await fileOf(adminA, base.version)
    const current = await fileOf(adminA)
    expect(current.version).toBeGreaterThan(base.version)
    const diff = diffModelFile(baseAgain, local)
    expect(diff.problems).toEqual([])
    const res = await adminA.post('/api/cms/_model', { baseVersion: current.version, ops: diff.ops })
    expect(res.status, JSON.stringify(res.body)).toBe(200)
    const keys = fieldKeysOf(await fileOf(adminA), 'custom_course')
    expect(keys).toEqual(expect.arrayContaining(['online', 'room']))
  })
})

describe('fit, and a file the site does not fit', () => {
  // Runs before anything is registered on A: A has no table of registrations yet.
  it('says whether a file fits, changes nothing, and refuses a bad file', async () => {
    expect(await codeTableOf(t.a)).toBeNull()
    const file = await fileOf(adminA)
    const fits = await adminA.post('/api/cms/_model/fit', { file })
    expect(fits.status).toBe(200)
    expect(fits.body).toEqual({ version: file.version, fits: true, breaks: [] })
    const wrong = structuredClone(file)
    wrong.types.find((x) => x.name === 'custom_course')!.fields.push({ key: 'nope', type: 'text', label: text('Nope') } as any)
    const misfit = await adminA.post('/api/cms/_model/fit', { file: wrong })
    expect(misfit.status).toBe(200)
    expect(misfit.body.fits).toBe(false)
    expect(misfit.body.breaks).toEqual([expect.objectContaining({ type: 'custom_course', field: 'nope' })])
    const bad = await adminA.post('/api/cms/_model/fit', { file: { format: 7, types: 'x' } })
    expect(bad.status).toBe(422)
    expect(code(bad)).toBe('invalid-file')
    expect(await codeTableOf(t.a)).toBeNull()
  })

  it('refuses to register a file that reads what the site lacks (409 does-not-fit), stores nothing and makes no table', async () => {
    const wrong = await fileOf(adminA)
    wrong.types.find((x) => x.name === 'custom_course')!.fields.push({ key: 'nope', type: 'text', label: text('Nope') } as any)
    const res = await adminA.put('/api/cms/_model/code/web', { file: wrong })
    expect(res.status).toBe(409)
    expect(code(res)).toBe('does-not-fit')
    expect(res.body.data.breaks).toEqual([expect.objectContaining({ type: 'custom_course', field: 'nope' })])
    expect(typeof res.body.data.version).toBe('number')
    expect(await codeTableOf(t.a)).toBeNull()
    expect((await adminA.get('/api/cms/_model/code')).body).toEqual({ registrations: [] })
    // A name that is not a name, a file that is not a file and a name that is not there.
    const badName = await adminA.put('/api/cms/_model/code/Bad_Name', { file: await fileOf(adminA) })
    expect(badName.status).toBe(422)
    expect(code(badName)).toBe('invalid-name')
    const badFile = await adminA.put('/api/cms/_model/code/web', { file: { format: 9 } })
    expect(badFile.status).toBe(422)
    expect(code(badFile)).toBe('invalid-file')
    const none = await adminA.delete('/api/cms/_model/code/web')
    expect(none.status).toBe(404)
    expect(code(none)).toBe('no-registration')
    expect(await codeTableOf(t.a)).toBeNull()
  })
})

describe('a registration refuses what takes away what it reads', () => {
  it('registers a file, lists it with nothing broken, and replaces a name that exists', async () => {
    const file = await fileOfType(adminA, 'custom_course')
    const reg = await adminA.put('/api/cms/_model/code/web', { file })
    expect(reg.status, JSON.stringify(reg.body)).toBe(200)
    expect(reg.body).toMatchObject({ name: 'web', source: 'session', by: { id: adminId }, version: file.version, types: 1, breaks: [] })
    const list = await adminA.get('/api/cms/_model/code')
    expect(list.body.registrations.map((r: any) => r.name)).toEqual(['web'])
    expect(list.body.registrations[0].breaks).toEqual([])
    const again = await adminA.put('/api/cms/_model/code/web', { file })
    expect(again.status).toBe(200)
    expect(again.body.registeredAt).toBe(reg.body.registeredAt)
    expect((await adminA.get('/api/cms/_model/code')).body.registrations).toHaveLength(1)
  })

  it('refuses removing a field it reads, also as a dry run, naming the registration', async () => {
    const before = (await model(adminA)).version
    const ops = [{ op: 'field.remove', type: 'custom_course', key: 'perex' }]
    for (const extra of [{}, { dryRun: true }]) {
      const res = await change(adminA, ops, extra)
      expect(res.status, JSON.stringify(res.body)).toBe(409)
      expect(code(res)).toBe('breaks-code')
      expect(res.body.data.registrations).toHaveLength(1)
      const [reg] = res.body.data.registrations
      expect(reg).toMatchObject({ name: 'web', source: 'session' })
      expect(reg.breaks).toEqual([expect.objectContaining({ type: 'custom_course', field: 'perex', why: 'field-removed' })])
    }
    expect((await model(adminA)).version).toBe(before)
  })

  it('refuses removing the type, and required to optional on a field it reads as required', async () => {
    const gone = await change(adminA, [{ op: 'type.remove', type: 'custom_course' }])
    expect(gone.status, JSON.stringify(gone.body)).toBe(409)
    expect(code(gone)).toBe('breaks-code')
    expect(gone.body.data.registrations[0].breaks).toEqual(expect.arrayContaining([expect.objectContaining({ type: 'custom_course', why: 'type-removed' })]))
    const loose = await change(adminA, [{ op: 'field.update', type: 'custom_course', key: 'teacher', required: false }])
    expect(loose.status, JSON.stringify(loose.body)).toBe(409)
    expect(code(loose)).toBe('breaks-code')
    expect(loose.body.data.registrations[0].breaks).toEqual([expect.objectContaining({ type: 'custom_course', field: 'teacher', why: 'may-be-empty' })])
  })

  it('lets a new field, a new type, a new choice and a new label pass', async () => {
    await mustChange(adminA, [{ op: 'field.add', type: 'custom_course', field: textField('extra1') }])
    await mustChange(adminA, [{ op: 'type.add', name: 'custom_extra', label: text('Extras') }])
    await mustChange(adminA, [{ op: 'field.update', type: 'custom_course', key: 'level', addOptions: [{ value: 'expert', label: text('Expert') }] }])
    await mustChange(adminA, [{ op: 'field.update', type: 'custom_course', key: 'price', label: text('Cost') }, { op: 'type.update', type: 'custom_course', label: text('Courses (all)') }])
    const level = (await fileOf(adminA)).types.find((x) => x.name === 'custom_course')!.fields.find((f) => f.key === 'level') as any
    expect(level.options.map((o: any) => o.value)).toContain('expert')
  })

  it('lifts the refusal when the registration is removed', async () => {
    const del = await adminA.delete('/api/cms/_model/code/web')
    expect(del.status).toBe(200)
    expect(del.body).toEqual({ removed: 'web' })
    expect((await adminA.get('/api/cms/_model/code')).body).toEqual({ registrations: [] })
    await mustChange(adminA, [{ op: 'field.remove', type: 'custom_course', key: 'perex' }])
    expect(fieldKeysOf(await fileOf(adminA), 'custom_course')).not.toContain('perex')
  })

  it('does not let a registration that already does not fit block what it did not make worse', async () => {
    const reg = await adminA.put('/api/cms/_model/code/stale', { file: await fileOfType(adminA, 'custom_course') })
    expect(reg.status, JSON.stringify(reg.body)).toBe(200)
    // The stored file now reads a field the site does not have.
    const file = await fileOfType(adminA, 'custom_course')
    file.types[0]!.fields.push({ key: 'ghost', type: 'text', label: text('Ghost') } as any)
    await siteQuery(t.a, `update cms_model_code set file = $1::jsonb where name = 'stale'`, [JSON.stringify(file)])
    try {
      const list = (await adminA.get('/api/cms/_model/code')).body.registrations.find((r: any) => r.name === 'stale')
      expect(list.breaks.length).toBeGreaterThan(0)
      expect(list.breaks).toEqual([expect.objectContaining({ type: 'custom_course', field: 'ghost' })])
      // Unrelated changes pass, and so does one that makes nothing worse.
      await mustChange(adminA, [{ op: 'field.add', type: 'custom_event', field: textField('unrelated') }])
      await mustChange(adminA, [{ op: 'field.update', type: 'custom_course', key: 'price', label: text('Price again') }])
      // Taking away something it still reads is refused, and names only that, not the ghost.
      const worse = await change(adminA, [{ op: 'field.remove', type: 'custom_course', key: 'level' }])
      expect(worse.status, JSON.stringify(worse.body)).toBe(409)
      expect(code(worse)).toBe('breaks-code')
      expect(worse.body.data.registrations[0].breaks).toEqual([expect.objectContaining({ type: 'custom_course', field: 'level', why: 'field-removed' })])
    }
    finally {
      expect((await adminA.delete('/api/cms/_model/code/stale')).status).toBe(200)
    }
  })

  it('keeps at most ten registrations a site', async () => {
    const file = await fileOfType(adminA, 'custom_event')
    try {
      for (let i = 0; i < 10; i++) expect((await adminA.put(`/api/cms/_model/code/many-${i}`, { file })).status).toBe(200)
      const over = await adminA.put('/api/cms/_model/code/many-10', { file })
      expect(over.status).toBe(422)
      expect(code(over)).toBe('limit-code')
      // A name that exists is still replaced.
      expect((await adminA.put('/api/cms/_model/code/many-0', { file })).status).toBe(200)
    }
    finally {
      for (let i = 0; i < 10; i++) await adminA.delete(`/api/cms/_model/code/many-${i}`)
    }
    expect((await adminA.get('/api/cms/_model/code')).body.registrations).toEqual([])
  })
})

describe('who may call the routes', () => {
  let withRight: { token: { id: string; rights: Record<string, unknown> }; value: string }
  let without: { token: { id: string; rights: Record<string, unknown> }; value: string }
  let editorToken: { token: { id: string; rights: Record<string, unknown> }; value: string }

  beforeAll(async () => {
    withRight = await makeToken(adminA, { model: true }, 'model right')
    without = await makeToken(adminA, { model: false }, 'no model right')
    editorToken = await makeToken(editorA, { model: true }, 'editor asks for the model right')
  })

  const calls = (site: { url: string }, token: string, file: ModelFile) => ({
    file: () => bearer(site, token, 'GET', '/api/cms/_model/file'),
    fit: () => bearer(site, token, 'POST', '/api/cms/_model/fit', { file }),
    change: () => bearer(site, token, 'POST', '/api/cms/_model', { baseVersion: file.version, ops: [{ op: 'type.update', type: 'custom_event', label: text('Events') }], dryRun: true }),
    list: () => bearer(site, token, 'GET', '/api/cms/_model/code'),
    put: () => bearer(site, token, 'PUT', '/api/cms/_model/code/tok', { file }),
    delete: () => bearer(site, token, 'DELETE', '/api/cms/_model/code/tok'),
  })

  it('an administrator\'s token with the right reads the file, fits, changes, lists, registers and removes', async () => {
    expect(withRight.token.rights.model).toBe(true)
    const file = await fileOfType(adminA, 'custom_event')
    const c = calls(t.a, withRight.value, file)
    const got = await c.file()
    expect(got.status, JSON.stringify(got.body)).toBe(200)
    expect(got.body.version).toBe((await model(adminA)).version)
    expect((await c.fit()).body).toMatchObject({ fits: true })
    expect((await c.change()).status).toBe(200)
    const put = await c.put()
    expect(put.status, JSON.stringify(put.body)).toBe(200)
    expect(put.body).toMatchObject({ name: 'tok', source: 'token', by: { id: adminId } })
    expect((await c.list()).body.registrations.map((r: any) => r.name)).toEqual(['tok'])
    expect((await c.delete()).body).toEqual({ removed: 'tok' })
  })

  it('a token without the right is refused on every route', async () => {
    const file = await fileOf(adminA)
    const c = calls(t.a, without.value, file)
    for (const [name, call] of Object.entries(c)) {
      const res = await call()
      expect(res.status, name).toBe(403)
      expect(code(res), name).toBe('token-cannot-model')
    }
  })

  it('an editor\'s token asked with the right comes back without it and is refused', async () => {
    expect(editorToken.token.rights.model).toBeUndefined()
    expect('model' in editorToken.token.rights).toBe(false)
    const file = await fileOf(adminA)
    for (const [name, call] of Object.entries(calls(t.a, editorToken.value, file))) {
      expect((await call()).status, name).toBe(403)
    }
  })

  it('a token whose person stopped being an administrator is refused, and works again when they are one again', async () => {
    const own = await makeToken(adminA, { model: true }, 'will be demoted')
    expect((await bearer(t.a, own.value, 'GET', '/api/cms/_model/file')).status).toBe(200)
    const file = await fileOf(adminA)
    const [{ role }] = await siteQuery(t.a, 'select role from cms_users where id = $1', [adminId])
    try {
      await siteQuery(t.a, `update cms_users set role = 'editor' where id = $1`, [adminId])
      for (const [name, call] of Object.entries(calls(t.a, own.value, file))) {
        expect((await call()).status, name).toBe(403)
      }
    }
    finally {
      await siteQuery(t.a, 'update cms_users set role = $2 where id = $1', [adminId, role])
    }
    expect((await bearer(t.a, own.value, 'GET', '/api/cms/_model/file')).status).toBe(200)
  })

  it('a token of site A is not known on site B, and an unknown token is 401', async () => {
    expect((await bearer(t.b, withRight.value, 'GET', '/api/cms/_model/file')).status).toBe(401)
    expect((await bearer(t.a, 'tzp_notatokenatall0000000000000000000000', 'GET', '/api/cms/_model/file')).status).toBe(401)
  })

  it('a token with the right is refused on the routes that read the session alone, exactly as before', async () => {
    for (const path of ['/api/cms/post', '/api/cms/_users', '/api/cms/_model/usage?type=custom_course', '/api/cms/_model', '/api/cms/_model/history']) {
      const res = await bearer(t.a, withRight.value, 'GET', path)
      expect(res.status, path).toBe(401)
    }
    const post = await bearer(t.a, withRight.value, 'POST', '/api/cms/_model', { baseVersion: (await model(adminA)).version, ops: [{ op: 'type.update', type: 'custom_event', label: text('Events') }] })
    expect(post.status).toBe(200)
  })

  it('a token cannot purge, even a purge that is valid when a person does it', async () => {
    await mustChange(adminA, [{ op: 'field.add', type: 'custom_event', field: textField('toPurge') }])
    await mustChange(adminA, [{ op: 'field.remove', type: 'custom_event', key: 'toPurge' }])
    await sleep(DELETE_WAIT_MS + 300)
    const ops = [{ op: 'purge', fields: [{ type: 'custom_event', key: 'toPurge' }] }]
    const version = (await model(adminA)).version
    const res = await bearer(t.a, withRight.value, 'POST', '/api/cms/_model', { baseVersion: version, ops })
    expect(res.status).toBe(403)
    expect(code(res)).toBe('token-cannot-purge')
    // The same purge by a person is valid.
    const person = await change(adminA, ops)
    expect(person.status, JSON.stringify(person.body)).toBe(200)
  })
})

describe('history and audit of what a token does', () => {
  it('names the person in the history, and the token in the audit log', async () => {
    const own = await makeToken(adminA, { model: true }, 'for the audit')
    const version = (await model(adminA)).version
    const res = await bearer(t.a, own.value, 'POST', '/api/cms/_model', { baseVersion: version, ops: [{ op: 'field.add', type: 'custom_event', field: textField('viaToken') }] })
    expect(res.status, JSON.stringify(res.body)).toBe(200)
    expect((await siteQuery(t.a, 'select user_id from cms_model where version = $1', [res.body.version]))[0].user_id).toBe(adminId)
    const history = (await adminA.get('/api/cms/_model/history')).body
    expect(history.find((h: any) => h.version === res.body.version).by).toMatchObject({ id: adminId })
    const [row] = await siteQuery(t.a, `select user_id, meta from cms_audit where action = 'model.change' and meta->>'tokenId' = $1`, [own.token.id])
    expect(row.user_id).toBe(adminId)
    expect(row.meta.via).toBe('token')
    expect(row.meta.tokenId).toBe(own.token.id)

    // Registering and removing: the person, and the token when it was one.
    const file = await fileOfType(adminA, 'custom_event')
    expect((await bearer(t.a, own.value, 'PUT', '/api/cms/_model/code/audited', { file })).status).toBe(200)
    expect((await bearer(t.a, own.value, 'DELETE', '/api/cms/_model/code/audited')).status).toBe(200)
    const rows = await siteQuery(t.a, `select action, user_id, meta from cms_audit where action in ('model.code.register', 'model.code.remove') and meta->>'name' = 'audited' order by created_at, action`)
    expect(rows.map((r) => r.action).sort()).toEqual(['model.code.register', 'model.code.remove'])
    for (const r of rows) {
      expect(r.user_id).toBe(adminId)
      expect(r.meta.tokenId).toBe(own.token.id)
      expect(r.meta.via).toBe('token')
    }
    const registered = rows.find((r) => r.action === 'model.code.register')
    expect(registered.meta).toMatchObject({ name: 'audited', source: 'token', misfits: 0 })

    // A person signed in: the person, no token.
    expect((await adminA.put('/api/cms/_model/code/by-hand', { file })).status).toBe(200)
    expect((await adminA.delete('/api/cms/_model/code/by-hand')).status).toBe(200)
    const hand = await siteQuery(t.a, `select user_id, meta from cms_audit where action = 'model.code.register' and meta->>'name' = 'by-hand'`)
    expect(hand[0].user_id).toBe(adminId)
    expect(hand[0].meta.tokenId).toBeUndefined()
    expect(hand[0].meta.source).toBe('session')
  })
})

describe('the two sites do not see each other\'s code', () => {
  // Runs last of the describes that register on A; B never registers.
  it('a registration on A refuses nothing on B, is not in B\'s list, and B has no table of registrations', async () => {
    const file = await fileOfType(adminA, 'custom_event')
    expect((await adminA.put('/api/cms/_model/code/iso', { file })).status).toBe(200)
    try {
      await mustChange(adminB, [{ op: 'field.add', type: 'custom_recipe', field: textField('note') }])
      await mustChange(adminB, [{ op: 'field.remove', type: 'custom_recipe', key: 'note' }])
      expect((await adminB.get('/api/cms/_model/code')).body).toEqual({ registrations: [] })
      expect((await adminA.get('/api/cms/_model/code')).body.registrations.map((r: any) => r.name)).toEqual(['iso'])
      expect(await codeTableOf(t.b)).toBeNull()
      expect(await tablesOf(t.b)).not.toContain('cms_model_code')
    }
    finally {
      await adminA.delete('/api/cms/_model/code/iso')
    }
  })
})

describe('a site with the feature off', () => {
  it('answers 404 on every new route, for a session and for a token made while it was on, and makes no table', async () => {
    const tok = await makeToken(adminB, { model: true }, 'made while on')
    expect(tok.token.rights.model).toBe(true)
    const file = await fileOf(adminB)
    const all = (c: (m: string, p: string, j?: unknown) => Promise<{ status: number }>) => [
      c('GET', '/api/cms/_model/file'),
      c('POST', '/api/cms/_model/fit', { file }),
      c('GET', '/api/cms/_model/code'),
      c('PUT', '/api/cms/_model/code/x', { file }),
      c('DELETE', '/api/cms/_model/code/x'),
    ]
    try {
      await t.writeDirectory([t.rows[0], { ...t.rows[1], config: { ...t.rows[1].config, customTypes: { enabled: false } } }])
      await until('B\'s model to go', async () => (await adminB.get('/api/cms/_model')).status, (s) => s === 404, 8000)
      const session = await Promise.all(all((m, p, j) => adminB.request(m, p, { json: j })))
      expect(session.map((r) => r.status)).toEqual([404, 404, 404, 404, 404])
      const viaToken = await Promise.all(all((m, p, j) => bearer(t.b, tok.value, m, p, j)))
      expect(viaToken.map((r) => r.status)).toEqual([404, 404, 404, 404, 404])
      expect(await codeTableOf(t.b)).toBeNull()
    }
    finally {
      await t.writeDirectory(t.rows)
    }
    await until('B to have its model again', async () => (await adminB.get('/api/cms/_model')).status, (s) => s === 200, 8000)
    expect((await adminB.get('/api/cms/_model/file')).status).toBe(200)
    expect(await codeTableOf(t.b)).toBeNull()
  })
})

describe.skipIf(!process.env.TEST_REDIS_URL)('two instances of one app', () => {
  it('a registration made on one instance refuses a change made on the other', async () => {
    const two = await t.startInstance()
    await two.server.waitForLog(/\[cms\] shared store: redis/, 15_000)
    const siteOn: TenantSite = { ...t.a, url: `http://${t.a.host}:${two.port}` }
    const a2 = siteClient(siteOn, 'admin')
    try {
      const file = await fileOfType(adminA, 'custom_course')
      const reg = await a2.put('/api/cms/_model/code/second', { file })
      expect(reg.status, JSON.stringify(reg.body)).toBe(200)
      const refused = await change(adminA, [{ op: 'field.remove', type: 'custom_course', key: 'seats' }])
      expect(refused.status, JSON.stringify(refused.body)).toBe(409)
      expect(code(refused)).toBe('breaks-code')
      expect(refused.body.data.registrations[0].name).toBe('second')
      expect((await adminA.get('/api/cms/_model/code')).body.registrations.map((r: any) => r.name)).toEqual(['second'])
      expect((await a2.delete('/api/cms/_model/code/second')).status).toBe(200)
      await mustChange(adminA, [{ op: 'field.remove', type: 'custom_course', key: 'seats' }])
    }
    finally {
      await two.server.stop()
    }
    expectNoSiteErrors(two)
  }, 60_000)
})

describe('what a registration costs a change', () => {
  it('compares 20 changes with no registration against 20 with one in place', async () => {
    const median = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)]!
    const run = async (tag: string) => {
      const ms: number[] = []
      for (let i = 0; i < 20; i++) {
        const m = await model(adminA)
        const started = performance.now()
        const res = await adminA.post('/api/cms/_model', { baseVersion: m.version, ops: [{ op: 'type.update', type: 'custom_event', label: text(`Events ${tag} ${i % 2}`) }] })
        expect(res.status, JSON.stringify(res.body)).toBe(200)
        ms.push(performance.now() - started)
      }
      return median(ms)
    }
    expect((await adminA.get('/api/cms/_model/code')).body.registrations).toEqual([])
    const without = await run('without')
    expect((await adminA.put('/api/cms/_model/code/timing', { file: await fileOfType(adminA, 'custom_event') })).status).toBe(200)
    let withOne: number
    try { withOne = await run('with') }
    finally { await adminA.delete('/api/cms/_model/code/timing') }
    console.info(`[timing] a change of structure over HTTP, median of 20: ${without.toFixed(0)} ms with no registration, ${withOne.toFixed(0)} ms with one registration`)
    expect(Number.isFinite(without)).toBe(true)
    expect(Number.isFinite(withOne)).toBe(true)
  })
})
