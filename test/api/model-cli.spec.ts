import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import * as playground from '../../playground/cms.config'
import { clientCommand } from '../../packages/cms/cli/client'
import { modelCommand } from '../../packages/cms/cli/model'
import { describeModelOps, diffModelFile, writeModelFile, type ModelFile } from '../../packages/cms/src/index'
import { Client } from '../helpers/api'
import { expectNoSiteErrors, siteClient, startTenants, type Tenants } from '../helpers/tenants'

// The CLI commands `tinyzoo model pull | push | check | register` against a real server, and the
// types the site builds from the model file (docs/model-file-plan.md, sections 4, 5, 6 and 13).
// Site A has the feature on and a type `custom_course`. Site B has it on too.
//
// What is proven: `pull` writes the file as the site gives it, says nothing changed the second
// time, and stops when the file has changes the site does not have (until `--force`). `push
// --dry-run` prints the plan and sends nothing. `push --yes` sends the change and rewrites the
// file from the site. A push after the owner changed the site keeps both changes, and says what
// the owner changed. A push with no `--yes` and no terminal sends nothing (exit 2). `register`
// puts the file on the site; then the owner cannot remove a field the file reads (409), and a
// push that drops it is refused with the registration named. `check` passes, tells about what
// the site has more (and fails with `--strict`), fails on a file that does not fit, and runs
// offline with no token. `register --remove` lifts the refusal. A token without the right, an
// unknown token, no token, and a token of another site end in the right exit code and message.
// At the end: the types `tinyzoo client` builds from the pulled file are the same text as the
// types the site serves itself, so code written against the file is code written against the site.
//
// The describes build on each other in order and share one folder until the token tests.
// Every registration is removed again at the end.
let t: Tenants
let adminA: Client
let withRight: string
let without: string

const DELETE_WAIT_MS = 1500
const PURGE_EMPTY_MS = 600_000
const text = (label: string) => ({ en: label })
const textField = (key: string, extra: Record<string, unknown> = {}) => ({ key, type: 'text', label: text(key), ...extra })

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

async function fileOf(c: Client): Promise<ModelFile> {
  const res = await c.get('/api/cms/_model/file')
  if (res.status !== 200) throw new Error(`GET file: ${res.status} ${JSON.stringify(res.body)}`)
  return res.body
}

async function makeToken(c: Client, rights: Record<string, unknown>, name: string) {
  const res = await c.post('/api/cms/_auth/tokens', { name, rights: { write: false, publish: false, delete: false, media: false, entities: null, ...rights }, expiresInDays: null })
  if (res.status !== 201) throw new Error(`token: ${res.status} ${JSON.stringify(res.body)}`)
  return res.body as { value: string }
}

const fieldKeysOf = (file: ModelFile, type: string): string[] => file.types.find((x) => x.name === type)?.fields.map((f) => f.key) ?? []

// Folders: one per describe group, all removed at the end.
const folders: string[] = []
const folder = () => { const dir = mkdtempSync(join(tmpdir(), 'model-cli-')); folders.push(dir); return dir }

/** Runs the model command in-process with the real fetch; returns the exit code and what it printed. */
async function cli(argv: string[], opts: { cwd: string; env?: Record<string, string | undefined>; token?: string }) {
  const out: string[] = []
  const err: string[] = []
  const code = await modelCommand(argv, {
    cwd: opts.cwd,
    env: { TINYZOO_TOKEN: opts.token ?? withRight, ...opts.env },
    log: (l) => out.push(l),
    error: (l) => err.push(l),
    interactive: false,
  })
  return { code, out, err, all: [...out, ...err].join('\n') }
}

const pathIn = (cwd: string) => join(cwd, 'cms.model.json')
const readFile = (cwd: string) => readFileSync(pathIn(cwd), 'utf8')
const readModel = (cwd: string): ModelFile => JSON.parse(readFile(cwd))
/** Edits the local file with `fn` and writes it back as the CLI does. */
function edit(cwd: string, fn: (file: ModelFile) => void) {
  const file = readModel(cwd)
  fn(file)
  writeFileSync(pathIn(cwd), writeModelFile(file))
}
const courseOf = (file: ModelFile) => file.types.find((x) => x.name === 'custom_course')!

/** A short unified-style diff: the first lines that differ. */
function firstDifferences(a: string, b: string, limit = 12): string {
  const x = a.split('\n')
  const y = b.split('\n')
  const lines: string[] = []
  for (let i = 0; i < Math.max(x.length, y.length) && lines.length < limit * 2; i++) {
    if (x[i] !== y[i]) lines.push(`@@ line ${i + 1}`, `- ${x[i] ?? '(missing)'}`, `+ ${y[i] ?? '(missing)'}`)
  }
  return lines.join('\n')
}

let mainDir: string | undefined
const main = (): string => (mainDir ??= folder())

beforeAll(async () => {
  t = await startTenants('modelcli', {
    NUXT_CMS_CUSTOM_TYPES: 'on',
    CMS_TEST_MODEL_PURGE_EMPTY_MS: String(PURGE_EMPTY_MS),
    CMS_TEST_MODEL_DELETE_WAIT_MS: String(DELETE_WAIT_MS),
  })
  adminA = siteClient(t.a, 'admin')
  await mustChange(adminA, [{ op: 'type.add', name: 'custom_course', label: text('Courses'), labelSingular: text('Course'), page: { prefix: 'kurzy' }, publish: true }])
  await mustChange(adminA, [
    { op: 'field.add', type: 'custom_course', field: textField('perex', { label: text('Perex') }) },
    { op: 'field.add', type: 'custom_course', field: { key: 'level', type: 'select', label: text('Level'), options: [{ value: 'beginner', label: text('Beginner') }, { value: 'advanced', label: text('Advanced') }] } },
    { op: 'field.add', type: 'custom_course', field: { key: 'teacher', type: 'text', required: true, label: text('Teacher') } },
  ])
  withRight = (await makeToken(adminA, { model: true }, 'cli with the right')).value
  without = (await makeToken(adminA, { model: false }, 'cli without the right')).value
}, 240_000)

afterAll(async () => {
  try {
    // Put back what the tests registered, so nothing is left on the site.
    if (adminA) await adminA.delete('/api/cms/_model/code/web')
    expectNoSiteErrors(t)
  }
  finally {
    await t?.stop()
    for (const dir of folders) rmSync(dir, { recursive: true, force: true })
  }
})

describe('pull', () => {
  it('writes cms.model.json as the site gives it, and a second pull says nothing changed', async () => {
    const cwd = main()
    const first = await cli(['pull', '--url', t.a.url], { cwd })
    expect(first.code, first.all).toBe(0)
    const site = await fileOf(adminA)
    expect(readFile(cwd)).toBe(writeModelFile(site))
    expect(first.all).toMatch(/Wrote cms\.model\.json/)

    const before = readFile(cwd)
    // The address now comes from the file.
    const second = await cli(['pull'], { cwd })
    expect(second.code, second.all).toBe(0)
    expect(second.all).toMatch(/nothing changed/)
    expect(readFile(cwd)).toBe(before)
  })

  it('stops when the file has changes the site does not have, and --force takes the site\'s file', async () => {
    const cwd = main()
    const site = writeModelFile(await fileOf(adminA))
    edit(cwd, (f) => { courseOf(f).fields.push({ key: 'localonly', type: 'text', label: text('Local only') } as any) })
    const edited = readFile(cwd)
    expect(edited).not.toBe(site)

    const refused = await cli(['pull'], { cwd })
    expect(refused.code, refused.all).toBe(1)
    expect(refused.err.join('\n')).toMatch(/your file has changes the site does not have/i)
    expect(refused.all).toContain('localonly')
    expect(readFile(cwd)).toBe(edited)

    const forced = await cli(['pull', '--force'], { cwd })
    expect(forced.code, forced.all).toBe(0)
    expect(readFile(cwd)).toBe(site)
  })
})

describe('push', () => {
  /** The local file as the site had it before the edit of the next tests. */
  let pulledVersion: number

  it('--dry-run prints the plan and changes nothing, on the site or in the file', async () => {
    const cwd = main()
    pulledVersion = readModel(cwd).version
    edit(cwd, (f) => {
      courseOf(f).fields.push({ key: 'seats', type: 'number', label: text('Seats') } as any)
      ;(courseOf(f).fields.find((x) => x.key === 'perex') as any).label = text('Summary')
    })
    const local = readModel(cwd)
    const baseFile = (await adminA.get(`/api/cms/_model/file?version=${pulledVersion}`)).body as ModelFile
    const plan = describeModelOps(diffModelFile(baseFile, local).ops)
    expect(plan.length).toBeGreaterThanOrEqual(2)
    const localText = readFile(cwd)
    const versionBefore = (await model(adminA)).version
    const fileBefore = writeModelFile(await fileOf(adminA))

    const res = await cli(['push', '--dry-run'], { cwd })
    expect(res.code, res.all).toBe(0)
    for (const line of plan) expect(res.out.some((l) => l.includes(line)), `${line}\n${res.all}`).toBe(true)
    expect(res.all).toMatch(/Dry run: nothing was sent/)

    expect((await model(adminA)).version).toBe(versionBefore)
    expect(writeModelFile(await fileOf(adminA))).toBe(fileBefore)
    expect(readFile(cwd)).toBe(localText)
  })

  it('--yes sends the change, and the local file is then the site\'s file at its new version', async () => {
    const cwd = main()
    const before = (await model(adminA)).version
    const res = await cli(['push', '--yes'], { cwd })
    expect(res.code, res.all).toBe(0)
    const site = await fileOf(adminA)
    expect(site.version).toBeGreaterThan(before)
    expect(fieldKeysOf(site, 'custom_course')).toContain('seats')
    expect((courseOf(site).fields.find((x) => x.key === 'perex') as any).label).toEqual(text('Summary'))
    expect(readFile(cwd)).toBe(writeModelFile(site))
    expect(readModel(cwd).version).toBe(site.version)
  })

  it('keeps the owner\'s change made in between, and says what the owner changed', async () => {
    const cwd = main()
    const pulled = await cli(['pull'], { cwd })
    expect(pulled.code, pulled.all).toBe(0)
    // The owner adds X on the site; the developer adds Y in the file.
    await mustChange(adminA, [{ op: 'field.add', type: 'custom_course', field: textField('ownerx') }])
    edit(cwd, (f) => { courseOf(f).fields.push({ key: 'devy', type: 'text', label: text('Devy') } as any) })

    const res = await cli(['push', '--yes'], { cwd })
    expect(res.code, res.all).toBe(0)
    const site = await fileOf(adminA)
    expect(fieldKeysOf(site, 'custom_course')).toEqual(expect.arrayContaining(['ownerx', 'devy']))
    expect(readFile(cwd)).toBe(writeModelFile(site))
    expect(fieldKeysOf(readModel(cwd), 'custom_course')).toEqual(expect.arrayContaining(['ownerx', 'devy']))
    // The note about the site names X as added, and does not say Y was added (it is the developer's own).
    const note = res.out.slice(res.out.findIndex((l) => /changed on the site since you pulled/.test(l)))
    expect(note.length, res.all).toBeGreaterThan(1)
    expect(note.join('\n')).toContain('ownerx')
    expect(note.join('\n')).not.toContain('adds the field devy')
  })

  it('without --yes and without a terminal exits 2 and sends nothing', async () => {
    const cwd = main()
    edit(cwd, (f) => { courseOf(f).fields.push({ key: 'neversent', type: 'text', label: text('Never sent') } as any) })
    const versionBefore = (await model(adminA)).version
    const res = await cli(['push'], { cwd })
    expect(res.code, res.all).toBe(2)
    expect(res.err.join('\n')).toMatch(/pass --yes/)
    expect((await model(adminA)).version).toBe(versionBefore)
    expect(fieldKeysOf(await fileOf(adminA), 'custom_course')).not.toContain('neversent')
    // Back to the site's file.
    expect((await cli(['pull', '--force'], { cwd })).code).toBe(0)
  })
})

describe('register', () => {
  it('registers the file as "web", and the site then refuses to take away a field it reads', async () => {
    const cwd = main()
    const res = await cli(['register'], { cwd })
    expect(res.code, res.all).toBe(0)
    expect(res.all).toContain('"web"')
    const list = await adminA.get('/api/cms/_model/code')
    expect(list.body.registrations.map((r: any) => r.name)).toEqual(['web'])

    for (const extra of [{}, { dryRun: true }]) {
      const refused = await change(adminA, [{ op: 'field.remove', type: 'custom_course', key: 'seats' }], extra)
      expect(refused.status, JSON.stringify(refused.body)).toBe(409)
      expect(refused.body.data.code).toBe('breaks-code')
      expect(refused.body.data.registrations[0].name).toBe('web')
    }
  })

  it('a push that drops that field is refused, names the registration and what it reads, and the field stays', async () => {
    const cwd = main()
    const versionBefore = (await model(adminA)).version
    edit(cwd, (f) => { const c = courseOf(f); c.fields = c.fields.filter((x) => x.key !== 'seats') })
    const localText = readFile(cwd)
    const res = await cli(['push', '--yes'], { cwd })
    expect(res.code, res.all).toBe(1)
    // The lines as the real server and the CLI gave them (also in the report of this test).
    expect(res.err.join('\n')).toContain('"web"')
    expect(res.err.join('\n')).toMatch(/reads:/)
    expect(res.err.join('\n')).toContain('seats')
    expect(fieldKeysOf(await fileOf(adminA), 'custom_course')).toContain('seats')
    expect((await model(adminA)).version).toBe(versionBefore)
    expect(readFile(cwd)).toBe(localText)
    expect((await cli(['pull', '--force'], { cwd })).code).toBe(0)
    expect(fieldKeysOf(readModel(cwd), 'custom_course')).toContain('seats')
  })
})

describe('check', () => {
  it('passes when the file fits and is the same as the site\'s model', async () => {
    const res = await cli(['check'], { cwd: main() })
    expect(res.code, res.all).toBe(0)
    expect(res.all).toMatch(/is the same as its model/)
  })

  it('tells what the site has more and names `tinyzoo model pull`; --strict fails on it', async () => {
    const cwd = main()
    await mustChange(adminA, [{ op: 'field.add', type: 'custom_course', field: textField('addedlater') }])
    const lenient = await cli(['check'], { cwd })
    expect(lenient.code, lenient.all).toBe(0)
    expect(lenient.all).toContain('addedlater')
    expect(lenient.all).toContain('tinyzoo model pull')
    const strict = await cli(['check', '--strict'], { cwd })
    expect(strict.code, strict.all).toBe(1)
    expect(strict.all).toContain('addedlater')
    expect((await cli(['pull'], { cwd })).code).toBe(0)
  })

  it('fails with the message when the file has a field, or a type, the site does not have', async () => {
    const cwd = main()
    const good = readFile(cwd)

    edit(cwd, (f) => { courseOf(f).fields.push({ key: 'nosuchfield', type: 'text', label: text('No such') } as any) })
    const field = await cli(['check'], { cwd })
    expect(field.code, field.all).toBe(1)
    expect(field.err.join('\n')).toContain('nosuchfield')

    writeFileSync(pathIn(cwd), good)
    edit(cwd, (f) => { f.types.push({ ...structuredClone(courseOf(f)), name: 'custom_nosuchtype' } as any) })
    const type = await cli(['check'], { cwd })
    expect(type.code, type.all).toBe(1)
    expect(type.err.join('\n')).toContain('custom_nosuchtype')

    writeFileSync(pathIn(cwd), good)
  })

  it('--offline needs no token and no address', async () => {
    const res = await cli(['check', '--offline'], { cwd: main(), env: { TINYZOO_TOKEN: '' } })
    expect(res.code, res.all).toBe(0)
  })
})

describe('register --remove', () => {
  it('removes the registration, and the removal that was refused now passes', async () => {
    const res = await cli(['register', '--remove'], { cwd: main() })
    expect(res.code, res.all).toBe(0)
    expect((await adminA.get('/api/cms/_model/code')).body).toEqual({ registrations: [] })
    const dry = await change(adminA, [{ op: 'field.remove', type: 'custom_course', key: 'seats' }], { dryRun: true })
    expect(dry.status, JSON.stringify(dry.body)).toBe(200)
  })
})

describe('tokens', () => {
  it('a token without the right "Content types" is refused with the way to get one', async () => {
    const cwd = folder()
    const res = await cli(['pull', '--url', t.a.url], { cwd, token: without })
    expect(res.code, res.all).toBe(1)
    expect(res.err.some((l) => l.includes('access token with the right "Content types", made by an administrator: admin, your account, Access tokens'))).toBe(true)
    expect(existsSync(pathIn(cwd))).toBe(false)
  })

  it('an unknown token is not accepted', async () => {
    const res = await cli(['pull', '--url', t.a.url], { cwd: folder(), token: 'tzp_notatokenatall0000000000000000000000' })
    expect(res.code, res.all).toBe(1)
    expect(res.err.join('\n')).toMatch(/did not accept the token/)
  })

  it('no token at all is a wrong use (exit 2)', async () => {
    const res = await cli(['pull', '--url', t.a.url], { cwd: folder(), env: { TINYZOO_TOKEN: '' } })
    expect(res.code, res.all).toBe(2)
    expect(res.err.join('\n')).toMatch(/TINYZOO_TOKEN/)
  })

  it('the token of site A is not accepted by site B', async () => {
    const res = await cli(['pull', '--url', t.b.url], { cwd: folder() })
    expect(res.code, res.all).toBe(1)
    expect(res.err.join('\n')).toMatch(/did not accept the token/)
  })
})

describe('the types the CLI builds from the file are the site\'s own types', () => {
  // Site A runs the playground's own model (the default one: `playground/cms.config.ts`), and
  // the file lays its custom types over that config, so the same config is loaded here.
  it('`client --stdout` over the pulled file is the text of /api/content-types.ts', async () => {
    const cwd = folder()
    const pulled = await cli(['pull', '--url', t.a.url], { cwd })
    expect(pulled.code, pulled.all).toBe(0)

    let built = ''
    const code = await clientCommand('client', ['--stdout'], { cwd, loadConfig: async () => playground, write: (s) => { built += s }, log: () => {}, error: () => {} })
    expect(code).toBe(0)

    const headers: Record<string, string> = t.a.contentToken ? { 'x-api-key': t.a.contentToken } : {}
    const res = await fetch(`${t.a.url}/api/content-types.ts`, { headers })
    expect(res.status).toBe(200)
    const served = await res.text()
    expect(built.length).toBeGreaterThan(0)
    if (built !== served) throw new Error(`the types from the file differ from the site's:\n${firstDifferences(built, served)}`)
    expect(built).toContain('custom_course')

    // The same text is saved by `pull --types`.
    const withTypes = await cli(['pull', '--types', 'types.ts'], { cwd, env: { TINYZOO_CONTENT_TOKEN: t.a.contentToken || undefined } })
    expect(withTypes.code, withTypes.all).toBe(0)
    expect(readFileSync(join(cwd, 'types.ts'), 'utf8')).toBe(served)
  })
})
