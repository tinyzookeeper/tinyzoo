/**
 * `tinyzoo model <pull|push|check|register>` — the model file, `cms.model.json`, and the site it
 * came from (docs/model-file-plan.md, sections 3 and 4).
 *
 *   TINYZOO_TOKEN=tzp_… tinyzoo model pull --url https://kurzy.example
 *
 *   pull       write the file from the site; stops when the file has changes the site does not
 *              have (--force drops them). --types <file> also saves the site's generated types
 *   push       send the changes made to the file since it was pulled; shows the plan and asks
 *              (--yes does not ask, --dry-run only shows it). Then writes the file from the site
 *   check      for CI: the file reads, its types build over cms.config.ts, and the site still
 *              has what it promises. --strict also fails when the site has more. --offline
 *              checks the file alone
 *   register   tell the site that code built from this file runs against it (--name, default
 *              web); a change that takes away what it reads is then refused. --remove undoes it
 *
 * Common to all: the token is $TINYZOO_TOKEN only (an argument would stay in the shell's
 * history), sent as `Authorization: Bearer`. The address is --url, else $TINYZOO_MODEL_URL, else
 * the file's `site`. The file is cms.model.json in this folder, or --file.
 *
 * Exit codes: 0 all is well; 1 something needs a person (a refusal, a file that does not fit);
 * 2 the command was used wrongly (an unknown flag, no address, no token).
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, relative, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import {
  customModelConfig, describeModelOps, diffModelFile, MODEL_FILE_NAME, ModelProblem, modelFileDoc, parseModelFile, writeModelFile,
  type ModelDiffProblem, type ModelFile, type ModelOp,
} from '../src/index'
import { askYesNo } from './generate'
import { parseArgs } from './transfer'

export interface ModelIo {
  /** The folder the command runs in (where cms.model.json and cms.config.ts are). */
  cwd: string
  env: Record<string, string | undefined>
  /** What the command says (standard output). */
  log?: (line: string) => void
  /** Why it stopped (standard error). */
  error?: (line: string) => void
  fetch?: typeof fetch
  /** Whether a person can be asked (a terminal). */
  interactive?: boolean
  confirm?: (question: string) => Promise<boolean>
  /** Loads cms.config.ts (default: imports it). */
  loadConfig?: (path: string) => Promise<Record<string, any>>
}

/** A stop with an exit code and the lines that say why. */
export class ModelStop extends Error {
  constructor(readonly code: 1 | 2, readonly lines: string[]) { super(lines.join('\n')) }
}

const stop = (code: 1 | 2, ...lines: string[]): ModelStop => new ModelStop(code, lines)

const SUBCOMMANDS = ['pull', 'push', 'check', 'register'] as const
type Sub = typeof SUBCOMMANDS[number]

/** The flags each subcommand takes: [with a value, without]. */
const FLAGS: Record<Sub, [string[], string[]]> = {
  pull: [['url', 'file', 'types'], ['force']],
  push: [['url', 'file'], ['dry-run', 'yes']],
  check: [['url', 'file'], ['offline', 'strict']],
  register: [['url', 'file', 'name'], ['remove']],
}

export const MODEL_USAGE = `usage: tinyzoo model <pull|push|check|register> [options]

  pull       write ${MODEL_FILE_NAME} from the site (--force drops changes the site does not have, --types <file> also saves its types)
  push       send what you changed in ${MODEL_FILE_NAME} to the site (--dry-run shows the plan only, --yes does not ask)
  check      the file reads and the site still has what it says (--offline: the file alone, --strict: fail on any difference)
  register   tell the site that code built from the file runs against it (--name <name>, default web; --remove)

  All: --url <address> (else $TINYZOO_MODEL_URL, else the file's site), --file <path> (default ${MODEL_FILE_NAME}).
  The token is $TINYZOO_TOKEN: an access token with the right "Content types".`

const TOKEN_NEEDED = 'It needs an access token with the right "Content types", made by an administrator: admin, your account, Access tokens.'

// ── the site ───────────────────────────────────────────────────────────────────

interface Answer { status: number; body: any; text: string }

/** The data of a refusal: `{ code, message, … }`. */
const dataOf = (a: Answer): Record<string, any> => (a.body && typeof a.body === 'object' && a.body.data && typeof a.body.data === 'object' ? a.body.data : {})
const codeOf = (a: Answer): string | undefined => dataOf(a).code
const messageOf = (a: Answer): string => String(dataOf(a).message ?? a.body?.statusMessage ?? a.body?.message ?? (a.text.slice(0, 200) || `the site answered ${a.status}`))

/** A site's model routes, called with the token and no cookie. */
export class ModelSite {
  constructor(readonly base: string, private readonly token: string | undefined, private readonly fetcher: typeof fetch) {}

  async call(method: string, path: string, json?: unknown, headers: Record<string, string> = {}): Promise<Answer> {
    const h: Record<string, string> = { accept: 'application/json', ...headers }
    if (this.token) h.authorization = `Bearer ${this.token}`
    if (json !== undefined) h['content-type'] = 'application/json'
    let res: Response
    try {
      res = await this.fetcher(this.base + path, {
        method, headers: h, body: json === undefined ? undefined : JSON.stringify(json),
        // A redirect is not followed: the token must not travel to another address.
        redirect: 'manual', signal: AbortSignal.timeout(60_000),
      })
    }
    catch (err) {
      const cause = (err as any)?.cause
      const reason = cause?.code ?? cause?.errors?.[0]?.code ?? cause?.message ?? (err as Error)?.message ?? String(err)
      throw stop(1, `The site at ${this.base} does not answer (${reason}).`)
    }
    const text = await res.text()
    let body: any = null
    try { body = text ? JSON.parse(text) : null }
    catch { /* not JSON */ }
    if (res.status >= 300 && res.status < 400) {
      const to = res.headers.get('location')
      throw stop(1, `The site at ${this.base} sends the request on to ${to ?? 'another address'}. Use that address with --url.`)
    }
    return { status: res.status, body, text }
  }

  /** The site's model file now, or at `version`. Null for 404 `version-not-kept`. */
  async file(version?: number): Promise<ModelFile | null> {
    const a = await this.call('GET', `/api/cms/_model/file${version === undefined ? '' : `?version=${version}`}`)
    if (a.status === 404 && codeOf(a) === 'version-not-kept') return null
    if (a.status !== 200) throw refusal(a, this.base)
    try { return withSite(parseModelFile(a.body), this.base) }
    catch (err) {
      throw stop(1, `The site at ${this.base} gave a model file this tinyzoo cannot read: ${(err as Error).message}. Update tinyzoo.`)
    }
  }
}

/** The file with the address it came from, when the site does not name one (it has no public address set). */
const withSite = (file: ModelFile, base: string): ModelFile => (file.site ? file : { ...file, site: base })

const textOf = (v: unknown): string => {
  if (typeof v === 'string') return v
  if (v && typeof v === 'object') return String((v as any).en ?? Object.values(v)[0] ?? '')
  return ''
}

const when = (iso: unknown): string => {
  const d = new Date(String(iso))
  return Number.isNaN(d.getTime()) ? String(iso) : `${d.toISOString().slice(0, 16).replace('T', ' ')} UTC`
}

/**
 * What a refusal of the site says, as lines a person can act on, and the stop it is. The site's
 * message comes first, then what it names: the places (`in-use`), the registrations
 * (`breaks-code`), what the site lacks (`does-not-fit`), the reasons (`not-allowed`).
 */
export function refusal(a: Answer, base: string, ops: ModelOp[] = []): ModelStop {
  const data = dataOf(a)
  const code = codeOf(a)
  if (a.status === 401) {
    if (/not used on this site/i.test(messageOf(a))) return stop(1, `The site at ${base} does not take access tokens: it signs people in another way, or its tokens are switched off.`)
    return stop(1, `The site at ${base} did not accept the token in TINYZOO_TOKEN. ${TOKEN_NEEDED}`)
  }
  if (a.status === 403) {
    if (code === 'token-cannot-model') return stop(1, `The token in TINYZOO_TOKEN cannot read or change the content types. ${TOKEN_NEEDED}`)
    if (code === 'token-cannot-purge') return stop(1, messageOf(a))
    return stop(1, `The person of the token in TINYZOO_TOKEN is not an administrator of the site at ${base} now. ${TOKEN_NEEDED}`)
  }
  if (a.status === 404 && code !== 'no-registration' && code !== 'version-not-kept') {
    return stop(1, `The site at ${base} does not have its own content types switched on (or it is not a tinyzoo site).`)
  }
  const lines = [`${messageOf(a)}.`.replace(/\.\.$/, '.')]
  if (code === 'in-use' && Array.isArray(data.places)) {
    for (const p of data.places) {
      const where = p.block ? `the block "${p.block.heading || textOf(p.block.label) || p.block.type}"` : p.field ? `the field ${p.field}` : ''
      lines.push(`  • ${p.entity} "${p.title || p.id}"${p.locale ? ` (${p.locale})` : ''}${where ? `, ${where}` : ''}: ${base}${p.admin}`)
    }
  }
  if (code === 'breaks-code' && Array.isArray(data.registrations)) {
    for (const r of data.registrations) {
      const updated = r.updatedAt && r.updatedAt !== r.registeredAt ? `, updated ${when(r.updatedAt)}` : ''
      lines.push(`  • "${r.name}", registered ${when(r.registeredAt)}${updated}, reads:`)
      for (const b of r.breaks ?? []) lines.push(`      - ${b.message}`)
    }
  }
  if (code === 'does-not-fit' && Array.isArray(data.breaks)) {
    lines.push('  The site lacks:')
    for (const b of data.breaks) lines.push(`  • ${b.message}`)
  }
  if (code === 'not-allowed' && Array.isArray(data.reasons)) for (const r of data.reasons) lines.push(`  • ${typeof r === 'string' ? r : r?.message ?? JSON.stringify(r)}`)
  if (a.status === 422 && typeof data.op === 'number' && ops[data.op]) lines.push(`  The change it refused: ${describeModelOps([ops[data.op]!])[0]}`)
  if (a.status >= 500 && code !== 'busy') lines.push(`  (the site answered ${a.status})`)
  return stop(1, ...lines)
}

// ── the command ────────────────────────────────────────────────────────────────

interface Context {
  sub: Sub
  args: ReturnType<typeof parseArgs>
  io: Required<Pick<ModelIo, 'cwd' | 'env' | 'log' | 'error'>> & ModelIo
  /** The model file's path and how to name it. */
  path: string
  shown: string
  hasConfig: boolean
}

/** The local file, or null when there is none. A file that does not read stops. */
function readLocal(ctx: Context): ModelFile | null {
  if (!existsSync(ctx.path)) return null
  let value: unknown
  try { value = JSON.parse(readFileSync(ctx.path, 'utf8')) }
  catch (err) { throw stop(1, `${ctx.shown} is not valid JSON: ${(err as Error).message}`) }
  try { return parseModelFile(value) }
  catch (err) {
    if (err instanceof ModelProblem) throw stop(1, `${ctx.shown} does not read: ${err.message}`)
    throw err
  }
}

function writeLocal(ctx: Context, file: ModelFile): void {
  mkdirSync(dirname(ctx.path), { recursive: true })
  writeFileSync(ctx.path, writeModelFile(file))
}

/** The site's address: --url, else $TINYZOO_MODEL_URL, else the file's `site`. */
export function siteAddress(values: Record<string, string>, env: Record<string, string | undefined>, file: ModelFile | null): { base: string; from: 'flag' | 'env' | 'file' } {
  const given = values.url ? { raw: values.url, from: 'flag' as const } : env.TINYZOO_MODEL_URL ? { raw: env.TINYZOO_MODEL_URL, from: 'env' as const } : file?.site ? { raw: file.site, from: 'file' as const } : null
  if (!given) throw stop(2, 'Which site? Pass --url https://your-site.example, or set TINYZOO_MODEL_URL.')
  const base = given.raw.trim().replace(/\/+$/, '')
  let url: URL
  try { url = new URL(base) }
  catch { throw stop(2, `"${given.raw}" is not a web address. Pass --url https://your-site.example.`) }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') throw stop(2, `"${given.raw}" is not a web address. Pass --url https://your-site.example.`)
  return { base, from: given.from }
}

const isLocal = (hostname: string): boolean => {
  const h = hostname.toLowerCase().replace(/^\[|\]$/g, '')
  return h === 'localhost' || h.endsWith('.localhost') || h === '127.0.0.1' || h === '::1'
}

/** The site, with the token. No token stops (2). */
function connect(ctx: Context, file: ModelFile | null): ModelSite {
  const { base, from } = siteAddress(ctx.args.values, ctx.io.env, file)
  const token = ctx.io.env.TINYZOO_TOKEN?.trim()
  if (!token) throw stop(2, `Set TINYZOO_TOKEN to an access token of the site. ${TOKEN_NEEDED}`)
  if (new URL(base).protocol === 'http:' && !isLocal(new URL(base).hostname)) {
    ctx.io.log(`! ${base} is not encrypted: the token travels in the clear. Use https:// for a site on the internet.`)
  }
  if (from === 'file') ctx.io.log(`· The site: ${base} (from ${ctx.shown}; --url or TINYZOO_MODEL_URL names another).`)
  return new ModelSite(base, token, ctx.io.fetch ?? fetch)
}

const plural = (n: number, one: string, many: string): string => `${n} ${n === 1 ? one : many}`

/** A problem of a difference, as a line. */
const problemLine = (p: ModelDiffProblem): string => `  • ${p.type ?? ''}${p.field ? `.${p.field}` : ''}: ${p.message}`

/** What changed from one file to the next, one line per difference. */
function changeLines(from: ModelFile, to: ModelFile): string[] {
  const d = diffModelFile(from, to)
  if (d.problems.length) {
    // The site made something anew in another form (removed, then added with the same name).
    return d.problems.map((p) => `  • ${p.field ? `the field ${p.field} of ${p.type}` : `the type ${p.type}`} is different on the site: it was made anew`)
  }
  return describeModelOps(d.ops).map((l) => `  • ${l}`)
}

/** The hint at the end, for an app with cms.config.ts. */
function clientHint(ctx: Context): void {
  if (ctx.hasConfig) ctx.io.log('Run `tinyzoo client` to update the generated types.')
}

/** The local file belongs to another site than the one asked. */
function otherSite(ctx: Context, local: ModelFile, now: ModelFile): boolean {
  return !!local.site && !!now.site && local.site !== now.site
}

async function pull(ctx: Context): Promise<number> {
  const force = ctx.args.flags.has('force')
  let local: ModelFile | null = null
  try { local = readLocal(ctx) }
  catch (err) { if (!force) throw err }
  const site = connect(ctx, local)
  const now = await site.file() as ModelFile

  if (local && !force) {
    if (otherSite(ctx, local, now)) {
      throw stop(1, `${ctx.shown} was read from ${local.site}, not from ${now.site}. Use --force to replace it with the file of ${now.site}.`)
    }
    const base = await site.file(local.version)
    if (!base) {
      throw stop(1,
        `The site no longer keeps version ${local.version}, the version ${ctx.shown} was read at, so it cannot tell whether your file has changes the site does not have.`,
        'Push them (tinyzoo model push), or use --force to drop them.')
    }
    const d = diffModelFile(base, local)
    if (d.ops.length || d.problems.length) {
      throw stop(1,
        `Your file has changes the site does not have: push them (tinyzoo model push), or use --force to drop them.`,
        ...(d.problems.length ? d.problems.map(problemLine) : describeModelOps(d.ops).map((l) => `  • ${l}`)))
    }
  }

  writeLocal(ctx, now)
  const from = `${now.site} (version ${now.version})`
  if (!local) ctx.io.log(`✓ Wrote ${ctx.shown} from ${from}: ${plural(now.types.length, 'type', 'types')}.`)
  else {
    const lines = changeLines(local, now)
    if (lines.length) {
      ctx.io.log(`✓ Wrote ${ctx.shown} from ${from}. What changed:`)
      for (const l of lines) ctx.io.log(l)
    }
    else ctx.io.log(`✓ ${ctx.shown} is up to date with ${from}: nothing changed.`)
  }

  const types = ctx.args.values.types
  if (types) {
    const contentToken = ctx.io.env.TINYZOO_CONTENT_TOKEN?.trim()
    // The generated types are a route of the content API: its own token, never the access token.
    const plain = new ModelSite(site.base, undefined, ctx.io.fetch ?? fetch)
    const a = await plain.call('GET', '/api/content-types.ts', undefined, { accept: 'text/plain', ...(contentToken ? { 'x-api-key': contentToken } : {}) })
    if (a.status === 401) throw stop(1, `The site's content API needs its content token for the generated types: set TINYZOO_CONTENT_TOKEN.`)
    if (a.status !== 200) throw stop(1, `The site did not give its generated types: ${messageOf(a)} (${a.status}).`)
    const out = resolve(ctx.io.cwd, types)
    mkdirSync(dirname(out), { recursive: true })
    writeFileSync(out, a.text)
    ctx.io.log(`✓ Wrote ${relative(ctx.io.cwd, out) || out}: the site's generated types.`)
  }
  clientHint(ctx)
  return 0
}

/** The plan of a push: the operations, the statements, the site's notes. */
function printPlan(ctx: Context, site: ModelSite, version: number, ops: ModelOp[], result: any): void {
  ctx.io.log(`Changes for ${site.base} (now at version ${version}):`)
  for (const l of describeModelOps(ops)) ctx.io.log(`  • ${l}`)
  const n = Number(result?.statements ?? 0)
  ctx.io.log(n ? `The database gets ${plural(n, 'statement', 'statements')}.` : 'The database needs no statement.')
  const notes: any[] = Array.isArray(result?.notes) ? result.notes : []
  if (notes.length) {
    ctx.io.log('The site notes:')
    for (const note of notes) ctx.io.log(`  • ${note.message}`)
  }
  if (ops.some((o) => o.op === 'type.remove' || o.op === 'field.remove')) ctx.io.log('What is hidden keeps its content and can be restored in the admin. Nothing is deleted for good.')
}

async function push(ctx: Context): Promise<number> {
  const local = readLocal(ctx)
  if (!local) throw stop(1, `There is no ${ctx.shown} here. Run \`tinyzoo model pull\` first.`)
  const site = connect(ctx, local)
  const dryRun = ctx.args.flags.has('dry-run')

  for (let round = 0; ; round++) {
    const [base, now] = await Promise.all([site.file(local.version), site.file()]) as [ModelFile | null, ModelFile]
    if (otherSite(ctx, local, now)) throw stop(1, `${ctx.shown} was read from ${local.site}, not from ${now.site}. Pull the file of ${now.site} first.`)
    if (!base) {
      throw stop(1,
        `The site no longer keeps version ${local.version}, the version ${ctx.shown} was read at, so it cannot tell what you changed.`,
        'Pull the file again (tinyzoo model pull --force), make your changes in it once more, and push.')
    }
    const d = diffModelFile(base, local)
    if (d.problems.length) throw stop(1, `${ctx.shown} has changes that cannot be made:`, ...d.problems.map(problemLine))
    if (!d.ops.length) {
      ctx.io.log(`Nothing to push: ${ctx.shown} has no changes since version ${local.version}.`)
      if (now.version !== local.version) ctx.io.log(`The site has changed since (version ${now.version} now): \`tinyzoo model pull\` brings its changes.`)
      return 0
    }

    const plan = await site.call('POST', '/api/cms/_model', { baseVersion: now.version, ops: d.ops, dryRun: true })
    if (plan.status === 409 && codeOf(plan) === 'stale-version' && round === 0) { ctx.io.log('The site changed in that moment; reading it again.'); continue }
    if (plan.status !== 200) throw refusal(plan, site.base, d.ops)
    printPlan(ctx, site, now.version, d.ops, plan.body)
    if (dryRun) { ctx.io.log('Dry run: nothing was sent.'); return 0 }

    if (!ctx.args.flags.has('yes')) {
      const interactive = ctx.io.interactive ?? Boolean(process.stdin.isTTY && process.stdout.isTTY)
      if (!interactive) throw stop(2, 'There is no terminal to ask in: pass --yes to send the changes.')
      if (!await (ctx.io.confirm ?? askYesNo)(`Send these changes to ${site.base}?`)) { ctx.io.log('Nothing was sent.'); return 1 }
    }

    const sent = await site.call('POST', '/api/cms/_model', { baseVersion: now.version, ops: d.ops })
    if (sent.status === 409 && codeOf(sent) === 'stale-version') {
      if (round === 0) { ctx.io.log('The site changed in that moment; starting again.'); continue }
      throw stop(1, 'The site keeps changing. Nothing was sent; try again in a moment.')
    }
    if (sent.status !== 200) throw refusal(sent, site.base, d.ops)

    const after = await site.file() as ModelFile
    writeLocal(ctx, after)
    ctx.io.log(`✓ Sent. ${site.base} is at version ${after.version}; ${ctx.shown} now holds it.`)
    // The local file has the developer's changes already: what else differs is the owner's.
    const theirs = changeLines(local, after)
    if (theirs.length) {
      ctx.io.log('It also holds what changed on the site since you pulled:')
      for (const l of theirs) ctx.io.log(l)
    }
    clientHint(ctx)
    return 0
  }
}

async function check(ctx: Context): Promise<number> {
  const local = readLocal(ctx)
  if (!local) throw stop(1, `There is no ${ctx.shown} here. Run \`tinyzoo model pull\` first.`)
  if (ctx.hasConfig) {
    const configPath = resolve(ctx.io.cwd, 'cms.config.ts')
    const config = await (ctx.io.loadConfig ?? ((p: string) => import(pathToFileURL(p).href)))(configPath)
    const { problems } = customModelConfig(config, modelFileDoc(local))
    if (problems.length) {
      throw stop(1, `The types of ${ctx.shown} do not build over cms.config.ts:`, ...problems.map((p) => `  • ${p.message}`))
    }
  }
  if (ctx.args.flags.has('offline')) {
    ctx.io.log(`✓ ${ctx.shown} reads${ctx.hasConfig ? ' and its types build over cms.config.ts' : ''}: ${plural(local.types.length, 'type', 'types')}.`)
    return 0
  }
  const site = connect(ctx, local)
  const fit = await site.call('POST', '/api/cms/_model/fit', { file: local })
  if (fit.status !== 200) throw refusal(fit, site.base)
  if (!fit.body?.fits) {
    throw stop(1,
      `Code built from ${ctx.shown} reads what ${site.base} does not have:`,
      ...(fit.body?.breaks ?? []).map((b: any) => `  • ${b.message}`),
      'If these are changes you made in the file, push them (tinyzoo model push). Otherwise pull the file (tinyzoo model pull) and update the code.')
  }
  const now = await site.file() as ModelFile
  const lines = changeLines(local, now)
  if (!lines.length) {
    ctx.io.log(`✓ ${ctx.shown} fits ${site.base} and is the same as its model (version ${now.version}).`)
    return 0
  }
  ctx.io.log(`✓ ${ctx.shown} fits ${site.base}. The site has more or other things than the file (version ${now.version}):`)
  for (const l of lines) ctx.io.log(l)
  ctx.io.log('`tinyzoo model pull` brings them.')
  if (ctx.args.flags.has('strict')) { ctx.io.error('✗ --strict: the file is not the same as the site\'s model.'); return 1 }
  return 0
}

async function register(ctx: Context): Promise<number> {
  const name = ctx.args.values.name ?? 'web'
  const remove = ctx.args.flags.has('remove')
  const local = remove ? (existsSync(ctx.path) ? readLocal(ctx) : null) : readLocal(ctx)
  if (!local && !remove) throw stop(1, `There is no ${ctx.shown} here. Run \`tinyzoo model pull\` first.`)
  const site = connect(ctx, local)
  const path = `/api/cms/_model/code/${encodeURIComponent(name)}`
  if (remove) {
    const a = await site.call('DELETE', path)
    if (a.status !== 200) throw refusal(a, site.base)
    ctx.io.log(`✓ Removed the registration "${name}" from ${site.base}. Its code is no longer asked before a change of the content types.`)
    return 0
  }
  const a = await site.call('PUT', path, { file: local })
  if (a.status !== 200) throw refusal(a, site.base)
  ctx.io.log(`✓ Registered ${ctx.shown} as "${name}" on ${site.base}: ${plural(local!.types.length, 'type', 'types')}. A change that takes away what it reads is now refused.`)
  return 0
}

/**
 * Runs `tinyzoo model <sub> …` and returns the exit code. Prints through `io`; reads nothing of
 * the process but what `io` leaves out (fetch, the terminal).
 */
export async function modelCommand(argv: string[], io: ModelIo): Promise<number> {
  const out = { log: (l: string) => console.log(l), error: (l: string) => console.error(l), ...io }
  const sub = argv[0] as Sub
  if (['help', '--help', '-h'].includes(argv[0] ?? '')) { out.log(MODEL_USAGE); return 0 }
  if (!SUBCOMMANDS.includes(sub)) {
    out.error(argv[0] ? `Unknown command "tinyzoo model ${argv[0]}".\n\n${MODEL_USAGE}` : MODEL_USAGE)
    return 2
  }
  try {
    let args: ReturnType<typeof parseArgs>
    try { args = parseArgs(argv.slice(1), ...FLAGS[sub]) }
    catch (err) { throw stop(2, `${(err as Error).message}.`, '', MODEL_USAGE) }
    if (args.positional.length) throw stop(2, `Unexpected "${args.positional[0]}".`, '', MODEL_USAGE)
    const path = resolve(out.cwd, args.values.file ?? MODEL_FILE_NAME)
    const ctx: Context = {
      sub, args, io: out, path,
      shown: relative(out.cwd, path) || path,
      hasConfig: existsSync(resolve(out.cwd, 'cms.config.ts')),
    }
    switch (sub) {
      case 'pull': return await pull(ctx)
      case 'push': return await push(ctx)
      case 'check': return await check(ctx)
      case 'register': return await register(ctx)
    }
  }
  catch (err) {
    if (!(err instanceof ModelStop)) throw err
    for (const [i, line] of err.lines.entries()) out.error(i === 0 ? `✗ ${line}` : line)
    return err.code
  }
}
