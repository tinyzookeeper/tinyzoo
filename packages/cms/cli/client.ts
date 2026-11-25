/**
 * `tinyzoo client [out]` and `tinyzoo openapi [out]`: the typed client and the OpenAPI document of
 * the content API, from what `cms.config.ts` exports.
 *
 * When the folder has a model file (`cms.model.json`, or `--model <file>`), the site's own types
 * in it are laid over the config (`customModelConfig`), so the output holds them too
 * (docs/model-file-plan.md, section 5). `--no-model` ignores the file. Without a file the output
 * is what it always was, byte for byte.
 *
 * `tinyzoo client --check` writes nothing: exit 1 when the file on disk is not what the command
 * would write.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { shownPath } from './model'
import { buildOpenApiDocument, customModelConfig, emitContentTypes, MODEL_FILE_NAME, ModelProblem, modelFileDoc, parseModelFile } from '../src/index'

export interface ClientIo {
  cwd: string
  /** What `cms.config.ts` exports. */
  loadConfig: () => Promise<Record<string, any>>
  log?: (line: string) => void
  error?: (line: string) => void
  /** Where `--stdout` writes. */
  write?: (text: string) => void
}

/** The arguments: the output path, `--stdout`, `--check`, `--model <file>`, `--no-model`. Other flags are ignored, as they always were. */
export function parseClientArgs(argv: string[]): { out?: string; stdout: boolean; check: boolean; model?: string; noModel: boolean } {
  const parsed: ReturnType<typeof parseClientArgs> = { stdout: false, check: false, noModel: false }
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!
    if (arg === '--stdout') parsed.stdout = true
    else if (arg === '--check') parsed.check = true
    else if (arg === '--no-model') parsed.noModel = true
    else if (arg === '--model') {
      const value = argv[++i]
      if (value === undefined || value.startsWith('-')) throw new Error('--model needs a file')
      parsed.model = value
    }
    else if (arg.startsWith('--model=')) parsed.model = arg.slice('--model='.length)
    else if (!arg.startsWith('-') && parsed.out === undefined) parsed.out = arg
  }
  return parsed
}

/**
 * The config with the model file's types laid over it, or the config itself when there is no
 * file. Null (and the problems printed) when the file does not read or its types do not build.
 */
function withModel(config: Record<string, any>, args: ReturnType<typeof parseClientArgs>, io: Required<Pick<ClientIo, 'cwd' | 'error'>>): { config: Record<string, any>; types: number; file?: string } | null {
  if (args.noModel) return { config, types: 0 }
  const path = resolve(io.cwd, args.model ?? MODEL_FILE_NAME)
  const shown = shownPath(io.cwd, path)
  if (!existsSync(path)) {
    if (args.model) { io.error(`✗ There is no model file ${shown}.`); return null }
    return { config, types: 0 }
  }
  let file
  try { file = parseModelFile(JSON.parse(readFileSync(path, 'utf8'))) }
  catch (err) {
    if (err instanceof ModelProblem || err instanceof SyntaxError) { io.error(`✗ ${shown} does not read: ${err.message}`); return null }
    throw err
  }
  const built = customModelConfig(config, modelFileDoc(file))
  if (built.problems.length) {
    io.error(`✗ The types of ${shown} do not build over cms.config.ts, so nothing was written:`)
    for (const p of built.problems) io.error(`  • ${p.message}`)
    return null
  }
  return { config: built.config, types: file.types.length, file: shown }
}

/** Runs `tinyzoo client` or `tinyzoo openapi`; returns the exit code. */
export async function clientCommand(kind: 'client' | 'openapi', argv: string[], io: ClientIo): Promise<number> {
  const log = io.log ?? ((l: string) => console.log(l))
  const error = io.error ?? ((l: string) => console.error(l))
  const write = io.write ?? ((t: string) => { process.stdout.write(t) })
  let args: ReturnType<typeof parseClientArgs>
  try { args = parseClientArgs(argv) }
  catch (err) { error(`✗ ${(err as Error).message}`); return 2 }

  const built = withModel(await io.loadConfig(), args, { cwd: io.cwd, error })
  if (!built) return 1
  const text = kind === 'client'
    ? emitContentTypes(built.config)
    : JSON.stringify(buildOpenApiDocument(built.config, { title: 'Content API' }), null, 2) + '\n'
  const out = resolve(io.cwd, args.out ?? (kind === 'client' ? 'cms-content.ts' : 'openapi.json'))

  if (args.check) {
    const shown = shownPath(io.cwd, out)
    const same = existsSync(out) && readFileSync(out, 'utf8') === text
    if (same) { log(`✓ ${shown} is up to date.`); return 0 }
    error(`✗ ${shown} is not what \`tinyzoo ${kind}${args.out ? ` ${args.out}` : ''}\` writes now${existsSync(out) ? '' : ' (there is no such file)'}. Run it, and commit the result.`)
    return 1
  }
  if (args.stdout) { write(text); return 0 }
  mkdirSync(dirname(out), { recursive: true })
  writeFileSync(out, text)
  log(`✓ emitted ${out}${built.file ? ` (with ${built.types} ${built.types === 1 ? 'type' : 'types'} of ${built.file})` : ''}`)
  return 0
}
