import { mkdtempSync, readFileSync, rmSync, writeFileSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, afterEach, describe, expect, it } from 'vitest'
import { defineEntity, f } from '../../packages/cms/src/index'
import { MODEL_USAGE, ModelStop, modelCommand, siteAddress, type ModelIo } from '../../packages/cms/cli/model'
import {
  MODEL_FILE_NAME,
  describeModelOps,
  diffModelFile,
  writeModelFile,
  type ModelFile,
  type ModelFileField,
  type ModelFileType,
} from '../../packages/cms/src/model-file'

// The command runs in-process against a fake site: a function that answers by method and path
// and records every call. No server, no database.

const SITE = 'https://kurzy.example'
const L = (cs: string) => ({ cs })

const TITLE: ModelFileField = { key: 'title', type: 'text', label: L('Název'), required: true }
const PEREX: ModelFileField = { key: 'perex', type: 'text', label: L('Perex') }
const LEVEL: ModelFileField = { key: 'level', type: 'select', label: L('Úroveň'), options: [{ value: 'a', label: L('A') }, { value: 'b', label: L('B') }] } as ModelFileField
const PRICE: ModelFileField = { key: 'price', type: 'number', label: L('Cena') } as ModelFileField

const course = (fields: ModelFileField[]): ModelFileType => ({ name: 'custom_course', label: L('Kurzy'), titleField: 'title', fields }) as ModelFileType
const fileOf = (version: number, fields: ModelFileField[] = [TITLE, PEREX, LEVEL], site: string | undefined = SITE): ModelFile =>
  ({ format: 1, ...(site ? { site } : {}), version, types: [course(fields)] })

const json = (status: number, body: unknown): Response => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
/** A refusal as h3's createError sends it. */
const refuse = (status: number, data: Record<string, unknown>, statusMessage = 'Refused'): Response =>
  json(status, { statusCode: status, statusMessage, data })

interface Call { method: string; url: string; path: string; headers: Record<string, string>; body: any }
type Handler = (call: Call, n: number) => Response | Promise<Response>
type Routes = Record<string, Handler>

/** A fake site: routes are "METHOD /path?query". Unknown routes fail the test loudly. */
function fakeFetch(routes: Routes) {
  const calls: Call[] = []
  const seen: Record<string, number> = {}
  const fn = (async (url: any, init: any = {}) => {
    const u = new URL(String(url))
    const method = String(init.method ?? 'GET')
    const path = u.pathname + u.search
    const call: Call = { method, url: String(url), path, headers: { ...(init.headers ?? {}) }, body: init.body ? JSON.parse(init.body) : undefined }
    calls.push(call)
    const key = `${method} ${path}`
    const handler = routes[key]
    if (!handler) throw new Error(`the fake site has no route ${key}`)
    seen[key] = (seen[key] ?? 0) + 1
    return handler(call, seen[key]!)
  }) as unknown as typeof fetch
  return { fn, calls }
}

/** The routes of a site that keeps `files` by version and is at `current`. */
function siteRoutes(files: Record<number, ModelFile>, current: number): Routes {
  const routes: Routes = { 'GET /api/cms/_model/file': () => json(200, files[current]) }
  for (const [v, file] of Object.entries(files)) routes[`GET /api/cms/_model/file?version=${v}`] = () => json(200, file)
  routes['GET /api/cms/_model/file?version=0'] ??= () => refuse(404, { code: 'version-not-kept', message: 'Version 0 is not kept' })
  return routes
}

const dirs: string[] = []
const newDir = (): string => { const d = mkdtempSync(join(tmpdir(), 'tz-model-cli-')); dirs.push(d); return d }
afterAll(() => { for (const d of dirs) rmSync(d, { recursive: true, force: true }) })

let cwd = ''
const localPath = () => join(cwd, MODEL_FILE_NAME)
const putLocal = (file: ModelFile, name = MODEL_FILE_NAME) => writeFileSync(join(cwd, name), writeModelFile(file))
const readLocalText = () => readFileSync(localPath(), 'utf8')

interface Run { code: number; out: string[]; err: string[]; calls: Call[]; all: string }
async function run(argv: string[], routes: Routes = {}, io: Partial<ModelIo> = {}): Promise<Run> {
  const out: string[] = []
  const err: string[] = []
  const site = fakeFetch(routes)
  const code = await modelCommand(argv, {
    cwd,
    env: { TINYZOO_TOKEN: 'tzp_secret' },
    log: (l) => out.push(l),
    error: (l) => err.push(l),
    fetch: site.fn,
    interactive: false,
    confirm: async () => { throw new Error('nobody should be asked') },
    ...io,
  })
  return { code, out, err, calls: site.calls, all: [...out, ...err].join('\n') }
}

afterEach(() => { cwd = '' })
const fresh = () => { cwd = newDir() }

describe('tinyzoo model: arguments', () => {
  it('prints the usage and exits 2 without a subcommand', async () => {
    fresh()
    const r = await run([])
    expect(r.code).toBe(2)
    expect(r.err).toEqual([MODEL_USAGE])
  })
  it('exits 2 for an unknown subcommand and names it', async () => {
    fresh()
    const r = await run(['sync'])
    expect(r.code).toBe(2)
    expect(r.all).toContain('Unknown command "tinyzoo model sync"')
  })
  it('exits 2 for an unknown flag', async () => {
    fresh()
    const r = await run(['pull', '--nope'])
    expect(r.code).toBe(2)
    expect(r.all).toContain('Unknown option --nope')
    expect(r.calls).toEqual([])
  })
  it('exits 2 for a flag that belongs to another subcommand', async () => {
    fresh()
    const r = await run(['pull', '--yes'])
    expect(r.code).toBe(2)
    expect(r.all).toContain('Unknown option --yes')
  })
  it('exits 2 for a stray positional argument', async () => {
    fresh()
    const r = await run(['push', 'extra'])
    expect(r.code).toBe(2)
    expect(r.all).toContain('Unexpected "extra"')
  })
  it('exits 2 for --url without a value', async () => {
    fresh()
    const r = await run(['pull', '--url'])
    expect(r.code).toBe(2)
    expect(r.all).toContain('--url needs a value')
  })
  it('prints the usage and exits 0 for help', async () => {
    fresh()
    for (const word of ['help', '--help', '-h']) {
      const r = await run([word])
      expect(r.code).toBe(0)
      expect(r.out).toEqual([MODEL_USAGE])
    }
  })
})

describe('tinyzoo model: where the address comes from', () => {
  it('lets --url win over TINYZOO_MODEL_URL, and that win over the file', async () => {
    fresh()
    putLocal(fileOf(1, undefined, 'https://file.example'))
    const routes = siteRoutes({ 1: fileOf(1, undefined, 'https://flag.example') }, 1)
    const byFlag = await run(['pull', '--url', 'https://flag.example'], routes, { env: { TINYZOO_TOKEN: 't', TINYZOO_MODEL_URL: 'https://env.example' } })
    expect(byFlag.calls.every((c) => c.url.startsWith('https://flag.example/'))).toBe(true)
    expect(byFlag.calls.length).toBeGreaterThan(0)
    const byEnv = await run(['pull'], { 'GET /api/cms/_model/file': () => json(200, fileOf(1, undefined, 'https://file.example')), 'GET /api/cms/_model/file?version=1': () => json(200, fileOf(1, undefined, 'https://file.example')) }, { env: { TINYZOO_TOKEN: 't', TINYZOO_MODEL_URL: 'https://env.example' } })
    expect(byEnv.calls.every((c) => c.url.startsWith('https://env.example/'))).toBe(true)
  })
  it('takes the address of the local file when nothing else is given, and says so', async () => {
    fresh()
    putLocal(fileOf(1))
    const r = await run(['push'], siteRoutes({ 1: fileOf(1) }, 1))
    expect(r.calls.every((c) => c.url.startsWith(`${SITE}/`))).toBe(true)
    expect(r.out.some((l) => l.includes(`The site: ${SITE}`) && l.includes('from cms.model.json'))).toBe(true)
  })
  it('in CI never takes the address from the file: nothing is sent, and it names the two ways to give one', async () => {
    fresh()
    putLocal(fileOf(1))
    for (const CI of ['true', '1']) {
      const r = await run(['check'], siteRoutes({ 1: fileOf(1) }, 1), { env: { TINYZOO_TOKEN: 'tzp_secret', CI } })
      expect(r.code).toBe(2)
      expect(r.calls).toEqual([])
      expect(r.all).toContain('TINYZOO_MODEL_URL')
      expect(r.all).toContain('--url')
    }
    // With the address given, CI works; and CI=false is not CI.
    const given = await run(['push'], siteRoutes({ 1: fileOf(1) }, 1), { env: { TINYZOO_TOKEN: 'tzp_secret', CI: 'true', TINYZOO_MODEL_URL: SITE } })
    expect(given.code).toBe(0)
    const notCi = await run(['push'], siteRoutes({ 1: fileOf(1) }, 1), { env: { TINYZOO_TOKEN: 'tzp_secret', CI: 'false' } })
    expect(notCi.code).toBe(0)
  })
  it('exits 2 and names --url and TINYZOO_MODEL_URL when there is no address', async () => {
    fresh()
    const r = await run(['pull'])
    expect(r.code).toBe(2)
    expect(r.all).toContain('--url')
    expect(r.all).toContain('TINYZOO_MODEL_URL')
    expect(r.calls).toEqual([])
  })
  it('drops a trailing slash', async () => {
    fresh()
    const r = await run(['pull', '--url', `${SITE}//`], siteRoutes({ 1: fileOf(1) }, 1))
    expect(r.code).toBe(0)
    expect(r.calls[0]!.url).toBe(`${SITE}/api/cms/_model/file`)
  })
  it('exits 2 for an address that is not http or https', async () => {
    fresh()
    for (const bad of ['ftp://x.example', 'kurzy.example', 'file:///etc/passwd']) {
      const r = await run(['pull', '--url', bad])
      expect(r.code, bad).toBe(2)
      expect(r.all).toContain('is not a web address')
    }
  })
  it('siteAddress picks flag, then env, then file, and reports which', () => {
    const file = fileOf(1, undefined, 'https://file.example')
    expect(siteAddress({ url: 'https://flag.example/' }, { TINYZOO_MODEL_URL: 'https://env.example' }, file)).toEqual({ base: 'https://flag.example', from: 'flag' })
    expect(siteAddress({}, { TINYZOO_MODEL_URL: 'https://env.example' }, file)).toEqual({ base: 'https://env.example', from: 'env' })
    expect(siteAddress({}, {}, file)).toEqual({ base: 'https://file.example', from: 'file' })
    expect(() => siteAddress({}, {}, null)).toThrow(ModelStop)
    try { siteAddress({}, {}, fileOf(1, undefined, undefined)) } catch (e) { expect((e as ModelStop).code).toBe(2) }
    try { siteAddress({ url: 'gopher://x' }, {}, null) } catch (e) { expect((e as ModelStop).code).toBe(2) }
  })
})

describe('tinyzoo model: the token', () => {
  it('exits 2 without TINYZOO_TOKEN and fetches nothing', async () => {
    fresh()
    const r = await run(['pull', '--url', SITE], siteRoutes({ 1: fileOf(1) }, 1), { env: {} })
    expect(r.code).toBe(2)
    expect(r.all).toContain('TINYZOO_TOKEN')
    expect(r.calls).toEqual([])
  })
  it('sends the token as a Bearer header and no cookie on every request', async () => {
    fresh()
    putLocal(fileOf(1))
    const r = await run(['push'], siteRoutes({ 1: fileOf(1) }, 1))
    expect(r.calls.length).toBeGreaterThan(0)
    for (const c of r.calls) {
      expect(c.headers.authorization).toBe('Bearer tzp_secret')
      expect(c.headers.cookie).toBeUndefined()
    }
  })
  it('warns when the token would travel over plain http to a public host', async () => {
    fresh()
    const r = await run(['pull', '--url', 'http://kurzy.example'], siteRoutes({ 1: fileOf(1) }, 1))
    expect(r.out.some((l) => l.includes('is not encrypted'))).toBe(true)
    const local = await run(['pull', '--url', 'http://localhost:3000', '--file', 'x.json'], siteRoutes({ 1: fileOf(1) }, 1))
    expect(local.out.some((l) => l.includes('is not encrypted'))).toBe(false)
  })
  it('checks a file offline without an address, a token or a request', async () => {
    fresh()
    putLocal(fileOf(1, undefined, undefined))
    const r = await run(['check', '--offline'], {}, { env: {} })
    expect(r.code).toBe(0)
    expect(r.calls).toEqual([])
    expect(r.out[0]).toContain('1 type')
  })
})

describe('tinyzoo model pull', () => {
  it('writes the file exactly as the site gave it and says how many types', async () => {
    fresh()
    const site = fileOf(4)
    const r = await run(['pull', '--url', SITE], siteRoutes({ 4: site }, 4))
    expect(r.code).toBe(0)
    expect(readLocalText()).toBe(writeModelFile(site))
    expect(r.out[0]).toBe(`✓ Wrote cms.model.json from ${SITE} (version 4): 1 type.`)
  })
  it('says nothing changed when the site is the same', async () => {
    fresh()
    const site = fileOf(4)
    const routes = siteRoutes({ 4: site }, 4)
    await run(['pull', '--url', SITE], routes)
    const second = await run(['pull', '--url', SITE], routes)
    expect(second.code).toBe(0)
    expect(second.out.join('\n')).toContain('nothing changed')
    expect(readLocalText()).toBe(writeModelFile(site))
  })
  it('lists one line per difference when the site changed', async () => {
    fresh()
    const v1 = fileOf(1)
    const v2 = fileOf(2, [TITLE, PEREX, LEVEL, PRICE])
    putLocal(v1)
    const r = await run(['pull'], siteRoutes({ 1: v1, 2: v2 }, 2))
    expect(r.code).toBe(0)
    expect(readLocalText()).toBe(writeModelFile(v2))
    const lines = describeModelOps(diffModelFile(v1, v2).ops)
    expect(lines.length).toBe(1)
    expect(r.out).toContain(`  • ${lines[0]}`)
    expect(r.out.join('\n')).toContain('What changed')
  })
  it('stops with exit 1 and leaves the file when it holds changes the site lacks', async () => {
    fresh()
    const v1 = fileOf(1)
    putLocal(fileOf(1, [TITLE, PEREX, LEVEL, PRICE]))
    const before = readLocalText()
    const r = await run(['pull'], siteRoutes({ 1: v1 }, 1))
    expect(r.code).toBe(1)
    expect(r.all).toMatch(/your file has changes the site does not have/i)
    expect(readLocalText()).toBe(before)
  })
  it('takes the site file with --force even over local changes', async () => {
    fresh()
    const v1 = fileOf(1)
    putLocal(fileOf(1, [TITLE, PRICE]))
    const r = await run(['pull', '--force'], siteRoutes({ 1: v1 }, 1))
    expect(r.code).toBe(0)
    expect(readLocalText()).toBe(writeModelFile(v1))
  })
  it('stops with the same advice when the site no longer keeps the local version', async () => {
    fresh()
    putLocal(fileOf(1))
    const before = readLocalText()
    const routes = siteRoutes({ 5: fileOf(5) }, 5)
    routes['GET /api/cms/_model/file?version=1'] = () => refuse(404, { code: 'version-not-kept', message: 'Version 1 is not kept' })
    const r = await run(['pull'], routes)
    expect(r.code).toBe(1)
    expect(r.all).toContain('no longer keeps version 1')
    expect(r.all).toMatch(/--force/)
    expect(readLocalText()).toBe(before)
  })
  it('writes the address it used into a site file that has none', async () => {
    fresh()
    const r = await run(['pull', '--url', SITE], siteRoutes({ 2: fileOf(2, undefined, undefined) }, 2))
    expect(r.code).toBe(0)
    expect(JSON.parse(readLocalText()).site).toBe(SITE)
  })
  it('refuses to replace the file of another site unless forced', async () => {
    fresh()
    putLocal(fileOf(1, undefined, 'https://other.example'))
    const r = await run(['pull', '--url', SITE], siteRoutes({ 1: fileOf(1) }, 1))
    expect(r.code).toBe(1)
    expect(r.all).toContain('https://other.example')
  })
  it('--types writes the generated types, with the content token and never the access token', async () => {
    fresh()
    const routes = { ...siteRoutes({ 1: fileOf(1) }, 1), 'GET /api/content-types.ts': () => new Response('export type X = 1\n', { status: 200 }) }
    const r = await run(['pull', '--url', SITE, '--types', 'out/types.ts'], routes, { env: { TINYZOO_TOKEN: 'tzp_secret', TINYZOO_CONTENT_TOKEN: 'ck_content' } })
    expect(r.code).toBe(0)
    expect(readFileSync(join(cwd, 'out/types.ts'), 'utf8')).toBe('export type X = 1\n')
    const call = r.calls.find((c) => c.path === '/api/content-types.ts')!
    expect(call.headers['x-api-key']).toBe('ck_content')
    expect(call.headers.authorization).toBeUndefined()
  })
  it('--types sends no x-api-key without a content token, and a 401 asks for one', async () => {
    fresh()
    const routes = { ...siteRoutes({ 1: fileOf(1) }, 1), 'GET /api/content-types.ts': () => refuse(401, { message: 'no' }) }
    const r = await run(['pull', '--url', SITE, '--types', 'types.ts'], routes)
    expect(r.code).toBe(1)
    expect(r.all).toContain('TINYZOO_CONTENT_TOKEN')
    const call = r.calls.find((c) => c.path === '/api/content-types.ts')!
    expect(call.headers['x-api-key']).toBeUndefined()
    expect(call.headers.authorization).toBeUndefined()
    expect(existsSync(join(cwd, 'types.ts'))).toBe(false)
  })
  it('ends with a line about `tinyzoo client` only when cms.config.ts is there', async () => {
    fresh()
    const routes = siteRoutes({ 1: fileOf(1) }, 1)
    const without = await run(['pull', '--url', SITE], routes)
    expect(without.out.join('\n')).not.toContain('tinyzoo client')
    writeFileSync(join(cwd, 'cms.config.ts'), '')
    const withConfig = await run(['pull', '--url', SITE, '--force'], routes)
    expect(withConfig.out.at(-1)).toContain('tinyzoo client')
  })
})

describe('tinyzoo model push', () => {
  const base = fileOf(1)
  const edited = fileOf(1, [TITLE, LEVEL, PRICE]) // perex removed, price added
  const ops = diffModelFile(base, edited).ops
  const plan = { version: 2, doc: {}, notes: [{ code: 'x', message: 'Existing entries get an empty price.', op: 0, type: 'custom_course' }], statements: 3, dryRun: true }
  const pushRoutes = (extra: Routes = {}): Routes => ({
    ...siteRoutes({ 1: base, 2: fileOf(2) }, 2),
    'POST /api/cms/_model': (c) => (c.body.dryRun ? json(200, plan) : json(200, { ...plan, dryRun: false })),
    ...extra,
  })
  const afterFile = fileOf(3, [TITLE, LEVEL, PRICE])
  /** The routes of a site that is at version 3 after the real POST. */
  const sendable = (): Routes => {
    let sent = false
    const r = pushRoutes()
    r['POST /api/cms/_model'] = (c) => { if (!c.body.dryRun) sent = true; return json(200, { ...plan, dryRun: !!c.body.dryRun }) }
    r['GET /api/cms/_model/file'] = () => json(200, sent ? afterFile : fileOf(2))
    return r
  }

  it('exits 1 without a local file', async () => {
    fresh()
    const r = await run(['push', '--url', SITE])
    expect(r.code).toBe(1)
    expect(r.all).toContain('There is no cms.model.json')
  })
  it('says there is nothing to push, sends nothing, and points to pull when the site is ahead', async () => {
    fresh()
    putLocal(base)
    const r = await run(['push'], pushRoutes())
    expect(r.code).toBe(0)
    expect(r.out.join('\n')).toContain('Nothing to push')
    expect(r.out.join('\n')).toContain('`tinyzoo model pull` brings its changes')
    expect(r.calls.some((c) => c.method === 'POST')).toBe(false)
    const same = await run(['push'], siteRoutes({ 1: base }, 1))
    expect(same.out.join('\n')).not.toContain('tinyzoo model pull')
  })
  it('shows the plan with a dry-run POST based on the site\'s current version', async () => {
    fresh()
    putLocal(edited)
    const r = await run(['push', '--dry-run'], pushRoutes())
    expect(r.code).toBe(0)
    const posts = r.calls.filter((c) => c.method === 'POST')
    expect(posts).toHaveLength(1)
    expect(posts[0]!.path).toBe('/api/cms/_model')
    expect(posts[0]!.body).toEqual({ baseVersion: 2, ops, dryRun: true })
    // The exact printed plan.
    expect(r.out.slice(1)).toEqual([
      'Changes for https://kurzy.example (now at version 2):',
      ...describeModelOps(ops).map((l) => `  • ${l}`),
      'The database gets 3 statements.',
      'The site notes:',
      '  • Existing entries get an empty price.',
      'What is hidden keeps its content and can be restored in the admin. Nothing is deleted for good.',
      'Dry run: nothing was sent.',
    ])
    expect(r.out.slice(2, 4)).toEqual([
      '  • hides the field perex of custom_course: it can be restored in the admin',
      '  • adds the field price (Cena) to custom_course: number, after level',
    ])
    expect(readLocalText()).toBe(writeModelFile(edited))
  })
  it('sends for real with --yes and rewrites the file from the site', async () => {
    fresh()
    putLocal(edited)
    const r = await run(['push', '--yes'], sendable())
    expect(r.code).toBe(0)
    const posts = r.calls.filter((c) => c.method === 'POST')
    expect(posts).toHaveLength(2)
    expect(posts[1]!.body).toEqual({ baseVersion: 2, ops })
    expect('dryRun' in posts[1]!.body).toBe(false)
    expect(readLocalText()).toBe(writeModelFile(afterFile))
    expect(r.out.some((l) => l.includes('version 3'))).toBe(true)
  })
  it('exits 2 without a terminal and without --yes, and sends nothing real', async () => {
    fresh()
    putLocal(edited)
    const r = await run(['push'], pushRoutes(), { interactive: false })
    expect(r.code).toBe(2)
    expect(r.all).toContain('--yes')
    expect(r.calls.filter((c) => c.method === 'POST' && !c.body.dryRun)).toEqual([])
  })
  it('asks with the address, and sends nothing when the answer is no', async () => {
    fresh()
    putLocal(edited)
    const asked: string[] = []
    const r = await run(['push'], pushRoutes(), { interactive: true, confirm: async (q) => { asked.push(q); return false } })
    expect(r.code).toBe(1)
    expect(asked).toHaveLength(1)
    expect(asked[0]).toContain(SITE)
    expect(r.calls.filter((c) => c.method === 'POST' && !c.body.dryRun)).toEqual([])
    expect(readLocalText()).toBe(writeModelFile(edited))
  })
  it('sends when the answer is yes', async () => {
    fresh()
    putLocal(edited)
    const r = await run(['push'], sendable(), { interactive: true, confirm: async () => true })
    expect(r.code).toBe(0)
    expect(r.calls.filter((c) => c.method === 'POST' && !c.body.dryRun)).toHaveLength(1)
  })
  it('starts again once after a stale-version answer and then succeeds', async () => {
    fresh()
    putLocal(edited)
    const routes = sendable()
    const real = routes['POST /api/cms/_model']!
    let realCalls = 0
    routes['POST /api/cms/_model'] = (c, n) => (!c.body.dryRun && realCalls++ === 0 ? refuse(409, { code: 'stale-version', message: 'old' }) : real(c, n))
    const r = await run(['push', '--yes'], routes)
    expect(r.code).toBe(0)
    // The base and the current file were read twice.
    expect(r.calls.filter((c) => c.path === '/api/cms/_model/file').length).toBeGreaterThanOrEqual(3)
    expect(r.calls.filter((c) => c.path === '/api/cms/_model/file?version=1')).toHaveLength(2)
  })
  it('exits 1 after two stale-version answers in a row', async () => {
    fresh()
    putLocal(edited)
    const routes = pushRoutes({ 'POST /api/cms/_model': (c) => (c.body.dryRun ? json(200, plan) : refuse(409, { code: 'stale-version', message: 'old' })) })
    const r = await run(['push', '--yes'], routes)
    expect(r.code).toBe(1)
    expect(r.all).toContain('keeps changing')
    expect(r.calls.filter((c) => c.method === 'POST' && !c.body.dryRun)).toHaveLength(2)
    expect(readLocalText()).toBe(writeModelFile(edited))
  })
  it('prints the problem and posts nothing when the change cannot be made', async () => {
    fresh()
    const typeChanged = fileOf(1, [TITLE, PEREX, { key: 'level', type: 'text', label: L('Úroveň') } as ModelFileField])
    putLocal(typeChanged)
    const problems = diffModelFile(base, typeChanged).problems
    expect(problems.length).toBeGreaterThan(0)
    const r = await run(['push', '--yes'], pushRoutes())
    expect(r.code).toBe(1)
    expect(r.all).toContain(problems[0]!.message)
    expect(r.calls.some((c) => c.method === 'POST')).toBe(false)
  })
})

describe('tinyzoo model: what the site refuses', () => {
  const base = fileOf(1)
  const edited = fileOf(1, [TITLE, LEVEL, PRICE])
  /** A push --dry-run whose plan the site refuses with `answer`. */
  async function refused(answer: () => Response): Promise<Run> {
    fresh()
    putLocal(edited)
    const routes: Routes = { ...siteRoutes({ 1: base }, 1), 'POST /api/cms/_model': answer }
    const r = await run(['push', '--dry-run'], routes)
    expect(r.code).toBe(1)
    expect(r.all).not.toMatch(/\n\s+at .*\(/)
    return r
  }

  it('prints an in-use refusal with each place and its full admin address', async () => {
    const r = await refused(() => refuse(409, {
      code: 'in-use', message: 'The field perex is used',
      places: [{ entity: 'custom_course', id: 7, title: 'Salsa', locale: 'cs', field: 'perex', admin: '/admin/custom_course/7' }],
    }))
    expect(r.err[0]).toBe('✗ The field perex is used.')
    expect(r.err[1]).toBe(`  • custom_course "Salsa" (cs), the field perex: ${SITE}/admin/custom_course/7`)
  })
  it('prints a breaks-code refusal with each registration and what it reads', async () => {
    const r = await refused(() => refuse(409, {
      code: 'breaks-code', message: 'Code registered on the site reads this',
      registrations: [{ name: 'web', registeredAt: '2026-11-20T10:30:00.000Z', breaks: [{ type: 'custom_course', field: 'perex', why: 'missing', message: 'the field perex of custom_course' }] }],
    }))
    // The exact printed text.
    expect(r.err).toEqual([
      '✗ Code registered on the site reads this.',
      '  • "web", registered 2026-11-20 10:30 UTC, reads:',
      '      - the field perex of custom_course',
    ])
  })
  it('prints what the site lacks for does-not-fit', async () => {
    const r = await refused(() => refuse(409, { code: 'does-not-fit', message: 'The file does not fit', breaks: [{ message: 'the type custom_x' }, { message: 'the field y of custom_course' }] }))
    expect(r.err).toEqual(['✗ The file does not fit.', '  The site lacks:', '  • the type custom_x', '  • the field y of custom_course'])
  })
  it('prints the reasons of not-allowed', async () => {
    const r = await refused(() => refuse(400, { code: 'not-allowed', message: 'Not allowed', reasons: ['Too many types', { message: 'The plan has no room' }] }))
    expect(r.err).toEqual(['✗ Not allowed.', '  • Too many types', '  • The plan has no room'])
  })
  it('names the refused operation of a 422', async () => {
    const r = await refused(() => refuse(422, { code: 'invalid', message: 'Bad field', op: 0 }))
    const expected = describeModelOps(diffModelFile(base, edited).ops.slice(0, 1))[0]
    expect(r.err).toContain(`  The change it refused: ${expected}`)
  })
  it('tells about the token for a 401 and for token-cannot-model', async () => {
    const a = await refused(() => refuse(401, { message: 'Unauthorized' }))
    expect(a.err[0]).toContain('access token with the right "Content types", made by an administrator: admin, your account, Access tokens')
    const b = await refused(() => refuse(403, { code: 'token-cannot-model', message: 'no' }))
    expect(b.err[0]).toContain('access token with the right "Content types", made by an administrator: admin, your account, Access tokens')
  })
  it('says the site has no own content types for a plain 404', async () => {
    const r = await refused(() => refuse(404, { message: 'Not found' }))
    expect(r.err[0]).toContain('does not have its own content types switched on')
  })
  it('says the site does not answer when the connection is refused', async () => {
    fresh()
    putLocal(edited)
    const r = await run(['push', '--dry-run'], {}, { fetch: (async () => { throw new TypeError('fetch failed', { cause: { code: 'ECONNREFUSED' } }) }) as unknown as typeof fetch })
    expect(r.code).toBe(1)
    expect(r.all).toContain('does not answer (ECONNREFUSED)')
  })
  it('does not follow a redirect and names where it points', async () => {
    fresh()
    putLocal(edited)
    const r = await run(['push', '--dry-run'], {
      'GET /api/cms/_model/file?version=1': () => new Response(null, { status: 302, headers: { location: 'https://elsewhere.example/api/cms/_model/file' } }),
      'GET /api/cms/_model/file': () => json(200, fileOf(1)),
    })
    expect(r.code).toBe(1)
    expect(r.all).toContain('https://elsewhere.example/api/cms/_model/file')
  })
})

describe('tinyzoo model check', () => {
  const tiny = () => defineEntity('category', { label: 'Categories', titleField: 'name', fields: { name: f.text({ required: true }) }, content: { public: true } })
  const withRelation = (to: string) => fileOf(1, [TITLE, { key: 'cat', type: 'relation', label: L('Kategorie'), to } as ModelFileField])
  const fitsRoute = (body: unknown): Routes => ({ 'POST /api/cms/_model/fit': () => json(200, body) })

  it('exits 1 for a file that does not read', async () => {
    fresh()
    writeFileSync(localPath(), '{ nope')
    const bad = await run(['check', '--offline'])
    expect(bad.code).toBe(1)
    expect(bad.all).toContain('not valid JSON')
    writeFileSync(localPath(), JSON.stringify({ format: 1, version: 1, types: 'x' }))
    const worse = await run(['check', '--offline'])
    expect(worse.code).toBe(1)
    expect(worse.all).toContain('does not read')
  })
  it('exits 1 with the mapper\'s problem when a relation points to a missing collection', async () => {
    fresh()
    putLocal(withRelation('nothing'))
    writeFileSync(join(cwd, 'cms.config.ts'), '')
    const r = await run(['check', '--url', SITE], {}, { loadConfig: async () => ({ category: tiny() }) })
    expect(r.code).toBe(1)
    expect(r.err[0]).toContain('do not build over cms.config.ts')
    expect(r.err.length).toBeGreaterThan(1)
    expect(r.calls).toEqual([])
  })
  it('passes a relation to a collection the design has', async () => {
    fresh()
    putLocal(withRelation('category'))
    writeFileSync(join(cwd, 'cms.config.ts'), '')
    const r = await run(['check', '--offline'], {}, { loadConfig: async () => ({ category: tiny() }) })
    expect(r.code).toBe(0)
    expect(r.out[0]).toContain('types build over cms.config.ts')
  })
  it('exits 0 when the file fits and is the same', async () => {
    fresh()
    putLocal(fileOf(2))
    const r = await run(['check'], { ...siteRoutes({ 2: fileOf(2) }, 2), ...fitsRoute({ version: 2, fits: true, breaks: [] }) })
    expect(r.code).toBe(0)
    expect(r.out.join('\n')).toContain('is the same as its model')
    expect(r.calls.find((c) => c.path === '/api/cms/_model/fit')!.body).toEqual({ file: fileOf(2) })
  })
  const ahead = (): Routes => ({ ...siteRoutes({ 3: fileOf(3, [TITLE, PEREX, LEVEL, PRICE]) }, 3), ...fitsRoute({ version: 3, fits: true, breaks: [] }) })
  it('exits 0 and lists the difference when the site has more', async () => {
    fresh()
    putLocal(fileOf(2))
    const r = await run(['check'], ahead())
    expect(r.code).toBe(0)
    expect(r.out).toContain('  • adds the field price (Cena) to custom_course: number, after level')
    expect(r.out.at(-1)).toContain('tinyzoo model pull')
  })
  it('exits 1 with --strict when the site has more', async () => {
    fresh()
    putLocal(fileOf(2))
    const r = await run(['check', '--strict'], ahead())
    expect(r.code).toBe(1)
    expect(r.err.join('\n')).toContain('--strict')
  })
  it('exits 1 and prints each break when the file does not fit', async () => {
    fresh()
    putLocal(fileOf(2))
    const r = await run(['check'], { ...siteRoutes({ 2: fileOf(2) }, 2), ...fitsRoute({ version: 2, fits: false, breaks: [{ type: 'custom_course', why: 'missing', message: 'the type custom_course' }, { type: 'custom_x', field: 'y', why: 'missing', message: 'the field y of custom_x' }] }) })
    expect(r.code).toBe(1)
    expect(r.err).toContain('  • the type custom_course')
    expect(r.err).toContain('  • the field y of custom_x')
  })
})

describe('tinyzoo model register', () => {
  const ok = (): Response => json(200, { ok: true })
  it('puts the file to the default name web', async () => {
    fresh()
    putLocal(fileOf(2))
    const r = await run(['register'], { 'PUT /api/cms/_model/code/web': ok })
    expect(r.code).toBe(0)
    expect(r.calls).toHaveLength(1)
    expect(r.calls[0]!.body).toEqual({ file: fileOf(2) })
    expect(r.out.join('\n')).toContain('Registered cms.model.json as "web"')
  })
  it('uses --name for the path', async () => {
    fresh()
    putLocal(fileOf(2))
    const r = await run(['register', '--name', 'app'], { 'PUT /api/cms/_model/code/app': ok })
    expect(r.code).toBe(0)
    expect(r.calls[0]!.path).toBe('/api/cms/_model/code/app')
  })
  it('prints what the site lacks when the file does not fit', async () => {
    fresh()
    putLocal(fileOf(2))
    const r = await run(['register'], { 'PUT /api/cms/_model/code/web': () => refuse(409, { code: 'does-not-fit', message: 'It does not fit', breaks: [{ message: 'the field perex of custom_course' }] }) })
    expect(r.code).toBe(1)
    expect(r.err).toEqual(['✗ It does not fit.', '  The site lacks:', '  • the field perex of custom_course'])
  })
  it('removes a registration with DELETE, even without a local file', async () => {
    fresh()
    const r = await run(['register', '--remove', '--url', SITE], { 'DELETE /api/cms/_model/code/web': ok })
    expect(r.code).toBe(0)
    expect(r.calls[0]!.method).toBe('DELETE')
    expect(r.calls[0]!.body).toBeUndefined()
  })
  it('prints the message of no-registration', async () => {
    fresh()
    const r = await run(['register', '--remove', '--url', SITE, '--name', 'ghost'], { 'DELETE /api/cms/_model/code/ghost': () => refuse(404, { code: 'no-registration', message: 'No code is registered as ghost' }) })
    expect(r.code).toBe(1)
    expect(r.err[0]).toBe('✗ No code is registered as ghost.')
  })
  it('exits 1 without a local file when not removing', async () => {
    fresh()
    const r = await run(['register', '--url', SITE])
    expect(r.code).toBe(1)
    expect(r.calls).toEqual([])
  })
})
