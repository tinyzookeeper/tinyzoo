import { existsSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, afterEach, describe, expect, it } from 'vitest'
import { buildOpenApiDocument, emitContentTypes } from '../../packages/cms/src/index'
import { customModelConfig, modelFileDoc, writeModelFile, type ModelFile, type ModelFileField } from '../../packages/cms/src/model-file'
import { clientCommand, parseClientArgs } from '../../packages/cms/cli/client'
import * as playground from '../../playground/cms.config'

const L = (cs: string) => ({ cs })
const TITLE: ModelFileField = { key: 'title', type: 'text', label: L('Název'), required: true }
const modelFile = (fields: ModelFileField[] = [TITLE, { key: 'perex', type: 'text', label: L('Perex') }]): ModelFile =>
  ({ format: 1, version: 3, types: [{ name: 'custom_course', label: L('Kurzy'), titleField: 'title', fields }] }) as ModelFile

const dirs: string[] = []
let cwd = ''
afterAll(() => { for (const d of dirs) rmSync(d, { recursive: true, force: true }) })
afterEach(() => { cwd = '' })
const fresh = () => { cwd = mkdtempSync(join(tmpdir(), 'tz-client-cli-')); dirs.push(cwd) }
const put = (name: string, text: string) => writeFileSync(join(cwd, name), text)
const read = (name: string) => readFileSync(join(cwd, name), 'utf8')

async function run(kind: 'client' | 'openapi', argv: string[]) {
  const out: string[] = []
  const err: string[] = []
  let stdout = ''
  const code = await clientCommand(kind, argv, {
    cwd,
    loadConfig: async () => playground,
    log: (l) => out.push(l),
    error: (l) => err.push(l),
    write: (t) => { stdout += t },
  })
  return { code, out, err, stdout }
}

describe('tinyzoo client and openapi without a model file', () => {
  it('writes exactly the content types of the config to stdout', async () => {
    fresh()
    const r = await run('client', ['--stdout'])
    expect(r.code).toBe(0)
    expect(r.stdout).toBe(emitContentTypes(playground))
  })
  it('writes exactly the OpenAPI document of the config to stdout', async () => {
    fresh()
    const r = await run('openapi', ['--stdout'])
    expect(r.code).toBe(0)
    expect(r.stdout).toBe(JSON.stringify(buildOpenApiDocument(playground, { title: 'Content API' }), null, 2) + '\n')
  })
  it('writes cms-content.ts byte for byte like the frozen contract', async () => {
    fresh()
    const r = await run('client', [])
    expect(r.code).toBe(0)
    expect(read('cms-content.ts')).toBe(readFileSync(join(__dirname, '../contracts/client-types.playground.ts'), 'utf8'))
    expect(r.out[0]).not.toContain('cms.model.json')
  })
  it('writes openapi.json byte for byte like the frozen contract', async () => {
    fresh()
    await run('openapi', [])
    expect(read('openapi.json')).toBe(readFileSync(join(__dirname, '../contracts/openapi.playground.json'), 'utf8'))
  })
})

describe('tinyzoo client with a model file', () => {
  const expected = (file: ModelFile) => emitContentTypes(customModelConfig(playground, modelFileDoc(file)).config)

  it('adds the custom type, as the config with the file laid over it, and names the file', async () => {
    fresh()
    put('cms.model.json', writeModelFile(modelFile()))
    const r = await run('client', ['--stdout'])
    expect(r.code).toBe(0)
    expect(r.stdout).toContain('CustomCourse')
    expect(r.stdout).toBe(expected(modelFile()))
    const written = await run('client', [])
    expect(written.out[0]).toContain('(with 1 type of cms.model.json)')
  })
  it('gives the unchanged output with --no-model', async () => {
    fresh()
    put('cms.model.json', writeModelFile(modelFile()))
    const r = await run('client', ['--stdout', '--no-model'])
    expect(r.stdout).toBe(emitContentTypes(playground))
  })
  it('reads the file named by --model', async () => {
    fresh()
    put('other.json', writeModelFile(modelFile()))
    const r = await run('client', ['--stdout', '--model', 'other.json'])
    expect(r.code).toBe(0)
    expect(r.stdout).toBe(expected(modelFile()))
    const written = await run('client', ['--model=other.json'])
    expect(written.out[0]).toContain('other.json')
  })
  it('exits 1 when the file named by --model is missing', async () => {
    fresh()
    const r = await run('client', ['--stdout', '--model', 'missing.json'])
    expect(r.code).toBe(1)
    expect(r.err[0]).toContain('missing.json')
    expect(r.stdout).toBe('')
  })
  it('exits 1 for a model file that does not read', async () => {
    fresh()
    put('cms.model.json', '{ nope')
    const r = await run('client', [])
    expect(r.code).toBe(1)
    expect(r.err[0]).toContain('does not read')
    expect(existsSync(join(cwd, 'cms-content.ts'))).toBe(false)
  })
  it('exits 1, prints the problems and writes nothing when the types do not build', async () => {
    fresh()
    put('cms.model.json', writeModelFile(modelFile([TITLE, { key: 'cat', type: 'relation', label: L('Kategorie'), to: 'nothing_here' } as ModelFileField])))
    const r = await run('client', [])
    expect(r.code).toBe(1)
    expect(r.err[0]).toContain('do not build over cms.config.ts')
    expect(r.err.length).toBeGreaterThan(1)
    expect(existsSync(join(cwd, 'cms-content.ts'))).toBe(false)
    const open = await run('openapi', [])
    expect(open.code).toBe(1)
    expect(existsSync(join(cwd, 'openapi.json'))).toBe(false)
  })
  it('puts the custom type into the OpenAPI document too', async () => {
    fresh()
    put('cms.model.json', writeModelFile(modelFile()))
    const r = await run('openapi', ['--stdout'])
    expect(r.stdout).toBe(JSON.stringify(buildOpenApiDocument(customModelConfig(playground, modelFileDoc(modelFile())).config, { title: 'Content API' }), null, 2) + '\n')
  })
})

describe('tinyzoo client --check', () => {
  it('exits 1 and says to run tinyzoo client when the file is missing', async () => {
    fresh()
    const r = await run('client', ['--check'])
    expect(r.code).toBe(1)
    expect(r.err[0]).toContain('tinyzoo client')
    expect(r.err[0]).toContain('no such file')
    expect(existsSync(join(cwd, 'cms-content.ts'))).toBe(false)
  })
  it('exits 0 and writes nothing when the file is the same', async () => {
    fresh()
    await run('client', [])
    const before = statSync(join(cwd, 'cms-content.ts')).mtimeMs
    const r = await run('client', ['--check'])
    expect(r.code).toBe(0)
    expect(statSync(join(cwd, 'cms-content.ts')).mtimeMs).toBe(before)
    expect(read('cms-content.ts')).toBe(emitContentTypes(playground))
  })
  it('exits 1 and leaves the file as it was when it differs', async () => {
    fresh()
    put('cms-content.ts', '// old\n')
    const r = await run('client', ['--check'])
    expect(r.code).toBe(1)
    expect(read('cms-content.ts')).toBe('// old\n')
  })
  it('checks the output given as a positional', async () => {
    fresh()
    await run('client', ['gen/types.ts'])
    expect((await run('client', ['gen/types.ts', '--check'])).code).toBe(0)
    expect((await run('client', ['--check'])).code).toBe(1)
    expect((await run('client', ['--check', 'gen/types.ts'])).code).toBe(0)
  })
  it('notices a model file that changed the expected output', async () => {
    fresh()
    await run('client', [])
    put('cms.model.json', writeModelFile(modelFile()))
    expect((await run('client', ['--check'])).code).toBe(1)
  })
})

describe('parseClientArgs', () => {
  it('reads --model x and --model=x', () => {
    expect(parseClientArgs(['--model', 'x.json']).model).toBe('x.json')
    expect(parseClientArgs(['--model=y.json']).model).toBe('y.json')
  })
  it('takes the first positional as the output and ignores the rest', () => {
    expect(parseClientArgs(['a.ts', 'b.ts']).out).toBe('a.ts')
  })
  it('ignores unknown flags', () => {
    expect(parseClientArgs(['--whatever', 'a.ts', '-x'])).toEqual({ out: 'a.ts', stdout: false, check: false, noModel: false })
  })
  it('throws for --model without a value', () => {
    expect(() => parseClientArgs(['--model'])).toThrow('--model needs a file')
    expect(() => parseClientArgs(['--model', '--stdout'])).toThrow('--model needs a file')
  })
  it('exits 2 from the command for --model without a value', async () => {
    fresh()
    const r = await run('client', ['--model'])
    expect(r.code).toBe(2)
  })
})
