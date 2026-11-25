import { emptyModelDoc, modelFileOf, modelMisfits, ModelProblem, newModelMisfits, parseModelDoc, parseModelFile, sql, sqlWithParams, type ModelDoc, type ModelFile, type ModelMisfit } from 'tinyzoo'
import { scrubError } from './cmsScrub'

/**
 * Code that runs against a site's own content types (docs/model-file-plan.md, sections 6 and 7).
 *
 * A registration is a model file that some running code told the site it was built against: a
 * separate frontend in its deploy (`tinyzoo model register`), or the site's own build at start.
 * The site keeps each in its own database (`cms_model_code`, made the first time something
 * registers). A change of structure that would take away what a registration reads is refused
 * (`cmsRegistrationsBrokenBy`, asked by the structure function inside its transaction).
 *
 * Nothing of a registration is kept in memory: it is read from the site's database when it is
 * needed. Registering changes no model, so it retires nothing and announces nothing.
 *
 * Who may call the routes: an administrator signed in, or a personal access token with the right
 * `model` whose person is an administrator now (`requireModelCaller`).
 */

/** The table of registrations, made the first time something registers (never by a migration). */
export const CMS_MODEL_CODE_TABLE_SQL = `CREATE TABLE IF NOT EXISTS "cms_model_code" (
  name       text PRIMARY KEY,
  file       jsonb NOT NULL,
  version    integer NOT NULL,
  source     text NOT NULL,
  user_id    uuid,
  created_at timestamptz(3) NOT NULL DEFAULT now(),
  updated_at timestamptz(3) NOT NULL DEFAULT now()
)`

/** How many registrations a site keeps. */
export const MAX_CODE_REGISTRATIONS = 10

/** Who registered: the site's own build, a person's access token, or a person signed in. */
export type CmsCodeSource = 'app' | 'token' | 'session'

/** A registration as the routes answer it. */
export interface CmsCodeRegistration {
  name: string
  /** When something first registered under this name. */
  registeredAt: string
  /** When the file in force now was registered. */
  updatedAt: string
  source: CmsCodeSource
  by: { id: string; name: string } | null
  /** The version of the site's model when the file in force was registered. */
  version: number
  /** How many types the file has; null when the stored file cannot be read (written by a newer tinyzoo). */
  types: number | null
  /** What the site lacks now of what the file reads; null when the stored file cannot be read. */
  breaks: ModelMisfit[] | null
}

/** A registration a change would break, as a refusal names it. */
export interface CmsCodeBreak {
  name: string
  registeredAt: string
  updatedAt: string
  source: string
  breaks: ModelMisfit[]
}

const CODE_NAME_RE = /^[a-z0-9][a-z0-9-]{0,39}$/
const rowsOf = (res: any): any[] => res?.rows ?? res ?? []
const iso = (v: unknown): string => new Date(v as any).toISOString()

/** A refusal a person can act on: `{ code, message, … }` in the answer's `data`. */
function codeRefusal(statusCode: number, code: string, message: string, extra: Record<string, unknown> = {}): Error {
  return createError({ statusCode, statusMessage: message, data: { code, message, ...extra } })
}

// ── who may call ───────────────────────────────────────────────────────────────

/**
 * The caller of a route of the site's own content types, or the refusal. In this order:
 *
 * - With `Authorization: Bearer …`: the token's person (401 for a token that is not one of this
 *   site's, with the rate limit of wrong tokens); 404 when the feature is off for the site; 403
 *   unless the token has the right `model` and its person's own role manages the site now. The
 *   token's user becomes the request's user, so the history and the audit log name the person,
 *   and the audit line the token.
 * - Without: signed in (401), the feature (404), an administrator (403), as every route of step 2.
 *
 * Only these routes take a token this way. Every other admin route reads the session alone.
 */
export async function requireModelCaller(event: any): Promise<{ user: CmsUser; token: boolean }> {
  const header = String(getHeader(event, 'authorization') ?? '').trim()
  if (/^Bearer\s/i.test(header)) {
    // Tokens exist with the built-in sign-in and the MCP server on (requireTokenOwner).
    if (cmsAuthMode() !== 'builtin' || !cmsMcpEnabled()) throw createError({ statusCode: 401, statusMessage: 'Access tokens are not used on this site' })
    const user = await requireTokenUser(event)
    requireCustomTypes()
    if (user.token?.rights.model !== true) {
      throw codeRefusal(403, 'token-cannot-model', 'This access token cannot read or change the content types. Make a token with the right "Content types" (admin, your account, Access tokens)')
    }
    // The person's own role, not narrowed by the token (a token's role never manages).
    if (!roleOf({ role: user.role })?.manage) throw createError({ statusCode: 403, statusMessage: 'Administrators only' })
    event.context.cmsUser = user
    event.context.cmsTokenVia = 'token'
    return { user, token: true }
  }
  const user = requireCmsUser(event)
  requireCustomTypes()
  requireCmsAdmin(event)
  return { user, token: false }
}

// ── reading ────────────────────────────────────────────────────────────────────

type Exec = (text: string, params?: unknown[]) => Promise<any[]>

const execOn = (db: any): Exec => async (text, params = []) => rowsOf(await db.execute(sqlWithParams(text, params)))

const tableExists = async (exec: Exec, table: string): Promise<boolean> => !!(await exec('select to_regclass($1) as t', [`public.${table}`]))[0]?.t

/** The newest stored model of the site: version 0 and the empty model when it never changed its structure. */
async function newestModel(exec: Exec): Promise<{ version: number; doc: ModelDoc }> {
  if (!await tableExists(exec, 'cms_model')) return { version: 0, doc: emptyModelDoc() }
  const [row] = await exec('select version, doc from "cms_model" order by version desc limit 1')
  return row ? { version: Number(row.version), doc: parseModelDoc(row.doc) } : { version: 0, doc: emptyModelDoc() }
}

/** The site's public address, as the file names it. */
function siteAddress(): string | undefined {
  const url = String(cmsSettings().publicUrl || '').trim()
  return url ? url.replace(/\/+$/, '') : undefined
}

/**
 * The site's model file now, or (`version`) as it was at that version: 404 when that version is
 * not kept (the newest 200 are) or does not exist yet. Version 0 is the empty model. Read from the
 * database, not from this instance's memory, which may be older.
 */
export async function cmsModelFileAt(version: number | null): Promise<ModelFile> {
  const exec = execOn(useCms().db)
  const site = siteAddress()
  const now = await newestModel(exec)
  if (version === null || version === now.version) return modelFileOf(now.doc, { version: now.version, site })
  if (version === 0) return modelFileOf(emptyModelDoc(), { version: 0, site })
  const [row] = version < now.version ? await exec('select doc from "cms_model" where version = $1', [version]) : []
  if (!row) throw codeRefusal(404, 'version-not-kept', `The site does not keep version ${version} of its content types (it keeps the newest 200)`, { version: now.version })
  return modelFileOf(parseModelDoc(row.doc), { version, site })
}

/** Would code built from `file` work against the site now? `breaks`: what the site lacks of what the file reads. */
export async function cmsModelFit(file: unknown): Promise<{ version: number; fits: boolean; breaks: ModelMisfit[] }> {
  const parsed = fileOrRefusal(file)
  const now = await newestModel(execOn(useCms().db))
  const breaks = modelMisfits(parsed, now.doc, cmsDesignModel().config)
  return { version: now.version, fits: breaks.length === 0, breaks }
}

/** A model file sent by a caller, or 422 `invalid-file` with the place. */
function fileOrRefusal(file: unknown): ModelFile {
  try {
    return parseModelFile(file)
  }
  catch (err) {
    if (err instanceof ModelProblem) throw codeRefusal(422, err.code, err.message)
    throw err
  }
}

/** The names of the people with these ids. */
async function namesOf(ids: string[]): Promise<Map<string, string>> {
  const names = new Map<string, string>()
  if (!ids.length) return names
  const { db, reg } = useCms()
  const u = reg.cmsUsers as any
  const people: any[] = await db.select({ id: u.id, name: u.name, email: u.email }).from(u).where(sql`${u.id} in (${sql.join(ids.map((id) => sql`${id}`), sql`, `)})`)
  for (const p of people) names.set(p.id, displayName(p.name, p.email) || '')
  return names
}

function registrationOf(row: any, doc: ModelDoc, design: Record<string, any>, names: Map<string, string>): CmsCodeRegistration {
  let file: ModelFile | null = null
  try { file = parseModelFile(row.file) }
  catch { /* written by a newer tinyzoo: listed, not compared */ }
  return {
    name: row.name,
    registeredAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
    source: row.source,
    by: typeof row.user_id === 'string' ? { id: row.user_id, name: names.get(row.user_id) ?? '' } : null,
    version: Number(row.version),
    types: file ? file.types.length : null,
    breaks: file ? modelMisfits(file, doc, design) : null,
  }
}

/** The file stored under one registration and who registered it, or null (no such registration, or no table yet). Never makes the table. */
export async function cmsModelCodeFile(name: string): Promise<{ file: unknown; source: string } | null> {
  const exec = execOn(useCms().db)
  if (!await tableExists(exec, 'cms_model_code')) return null
  const [row] = await exec('select file, source from "cms_model_code" where name = $1', [name])
  return row ? { file: row.file, source: row.source } : null
}

/** The site's registrations, by name, each with what the site lacks now. Empty for a site that never registered. */
export async function cmsModelCodeList(): Promise<CmsCodeRegistration[]> {
  const exec = execOn(useCms().db)
  if (!await tableExists(exec, 'cms_model_code')) return []
  const rows = await exec('select name, file, version, source, user_id, created_at, updated_at from "cms_model_code" order by name')
  if (!rows.length) return []
  const now = await newestModel(exec)
  const names = await namesOf([...new Set(rows.map((r) => r.user_id).filter((id): id is string => typeof id === 'string'))])
  const design = cmsDesignModel().config
  return rows.map((r) => registrationOf(r, now.doc, design, names))
}

// ── registering and removing ───────────────────────────────────────────────────

/** 422 unless `name` can name a registration. */
function checkName(name: string): void {
  if (!CODE_NAME_RE.test(name)) throw codeRefusal(422, 'invalid-name', 'A registration\'s name is 1 to 40 characters: a to z, 0 to 9 and "-", starting with a letter or a digit')
}

/** Lock timeouts and a busy database answer 503, as a change of structure does; refusals pass; anything else is logged and answers 500. */
function codeFailure(err: unknown, what: string): never {
  if ((err as any)?.statusCode) throw err
  const pg = (err as any)?.code ? err : (err as any)?.cause
  if (pg?.code === '55P03') throw codeRefusal(503, 'busy', 'The content types are being changed right now. Try again in a few seconds')
  console.error(`[cms] site ${useCmsSite().id}: ${what}`, scrubError(err))
  throw createError({ statusCode: 500, statusMessage: 'The registration could not be saved' })
}

/**
 * Register `file` under `name`: the code built from it runs against the site now. One
 * transaction on the site's own pool, under the lock of a change of structure (`MODEL_LOCK`), so
 * a change and a registration cannot pass each other. Refused with 409 `does-not-fit` (and
 * `breaks`) when the site lacks what the file reads, unless `force` (the site's own build, whose
 * code runs whether it fits or not). A name that exists is replaced. At most 10 per site
 * (422 `limit-code`). The audit line `model.code.register` is written in the transaction.
 */
export async function cmsRegisterCode(event: any, input: { name: string; file: unknown; source: CmsCodeSource; force?: boolean }): Promise<CmsCodeRegistration> {
  requireCustomTypes()
  checkName(input.name)
  const file = fileOrRefusal(input.file)
  const design = cmsDesignModel().config
  const user: CmsUser | undefined = event?.context?.cmsUser
  const userId = user ? actorId(user) : null
  const { db } = useCms()
  try {
    return await db.transaction(async (tx: any) => {
      const exec = execOn(tx)
      await exec(`select pg_advisory_xact_lock(${MODEL_LOCK})`)
      await exec(`set local lock_timeout = '2s'`)
      await exec(CMS_MODEL_CODE_TABLE_SQL)
      const [others] = await exec('select count(*)::int as n from "cms_model_code" where name <> $1', [input.name])
      if (Number(others?.n ?? 0) >= MAX_CODE_REGISTRATIONS) {
        throw codeRefusal(422, 'limit-code', `A site keeps at most ${MAX_CODE_REGISTRATIONS} registrations. Remove one first`)
      }
      const now = await newestModel(exec)
      const breaks = modelMisfits(file, now.doc, design)
      if (breaks.length && !input.force) {
        throw codeRefusal(409, 'does-not-fit', 'The site does not have everything this code reads. Update the code to the site\'s content types (pull the model file again), then register it', { version: now.version, breaks })
      }
      if (breaks.length) console.warn(`[cms] site ${useCmsSite().id}: the code "${input.name}" was registered although the site lacks what it reads: ${breaks.map((b) => b.message).join('; ')}`)
      const [row] = await exec(
        `insert into "cms_model_code" (name, file, version, source, user_id) values ($1, $2::jsonb, $3, $4, $5)
         on conflict (name) do update set file = excluded.file, version = excluded.version, source = excluded.source, user_id = excluded.user_id, updated_at = now()
         returning name, file, version, source, user_id, created_at, updated_at`,
        [input.name, JSON.stringify(file), now.version, input.source, userId],
      )
      await audit(event, 'model.code.register', { meta: { name: input.name, source: input.source, version: now.version, misfits: breaks.length } }, tx)
      const names = new Map<string, string>(userId && user ? [[userId, displayName(user.name, user.email) || '']] : [])
      return registrationOf(row, now.doc, design, names)
    })
  }
  catch (err) {
    codeFailure(err, 'code could not be registered')
  }
}

/** Remove the registration `name` (404 when there is none). Audit line `model.code.remove`. Never makes the table. */
export async function cmsRemoveCode(event: any, name: string): Promise<{ removed: string }> {
  requireCustomTypes()
  if (!CODE_NAME_RE.test(name)) throw codeRefusal(404, 'no-registration', 'There is no registration of that name')
  const { db } = useCms()
  try {
    return await db.transaction(async (tx: any) => {
      const exec = execOn(tx)
      await exec(`select pg_advisory_xact_lock(${MODEL_LOCK})`)
      await exec(`set local lock_timeout = '2s'`)
      const [gone] = await tableExists(exec, 'cms_model_code') ? await exec('delete from "cms_model_code" where name = $1 returning name', [name]) : []
      if (!gone) throw codeRefusal(404, 'no-registration', 'There is no registration of that name')
      await audit(event, 'model.code.remove', { meta: { name } }, tx)
      return { removed: name }
    })
  }
  catch (err) {
    codeFailure(err, 'a registration could not be removed')
  }
}

// ── the check inside the structure function ────────────────────────────────────

/**
 * The registrations a change from `before` to `after` would break: for each, what does not fit
 * after the change and did fit before it (`newModelMisfits`). Read from the site's database with
 * the change's own transaction (`exec`), so a registration made a moment ago counts. A site that
 * never registered costs one `to_regclass`. A stored file that cannot be read (a newer format) is
 * skipped with one log line.
 */
export async function cmsRegistrationsBrokenBy(exec: Exec, before: ModelDoc, after: ModelDoc, design: Record<string, any>): Promise<CmsCodeBreak[]> {
  if (!await tableExists(exec, 'cms_model_code')) return []
  const rows = await exec('select name, file, source, created_at, updated_at from "cms_model_code" order by name')
  const out: CmsCodeBreak[] = []
  for (const r of rows) {
    let file: ModelFile
    try {
      file = parseModelFile(r.file)
    }
    catch (err) {
      console.warn(`[cms] site ${useCmsSite().id}: the registration "${r.name}" cannot be read, so a change is not checked against it: ${(err as Error)?.message ?? String(err)}`)
      continue
    }
    const breaks = newModelMisfits(modelMisfits(file, before, design), modelMisfits(file, after, design))
    if (breaks.length) out.push({ name: r.name, registeredAt: iso(r.created_at), updatedAt: iso(r.updated_at), source: r.source, breaks })
  }
  return out
}
