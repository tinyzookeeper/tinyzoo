import { applyModelOps, emptyModelDoc, linkFieldsOf, linkRef, ModelProblem, or, parseModelDoc, propOf, snake, sql, sqlWithParams, type CmsBinding, type CmsEntity, type CmsRegistry, type ModelContext, type ModelDoc, type ModelNote, type ModelOp } from 'tinyzoo'
import { bindingBlockTypes, bindingFields, bindingMissing, bindingsIn, bindingUses, type BindingMissing } from './cmsBindings'
import { designTypesForModel, modelCountQueries, modelPlanningBuild, ModelStatementRefused, planModelChange, runModelStatements } from './cmsModelPlan'
import { scrubError } from './cmsScrub'

/**
 * The structure function: the one way a site's own content types change (docs/custom-types-plan.md,
 * sections 4 to 7). The admin's route calls it; a model file and the MCP tools will call it too.
 *
 * One transaction on the site's own pool, as the site's own database user: the lock (two changes of
 * one site take turns), the version check, the facts the operations need, the operations, the
 * guard, the statements (each checked against the allowed list), the new version and the audit
 * line. After the commit the site's instance is retired, so the next request reads the new model,
 * and the change is announced to the other instances.
 */

/** The advisory lock of a site's structure changes (the others in use: 72_011_001…005, _040, _050, _060). */
export const MODEL_LOCK = 72_011_070
/** The channel of the shared store a change of structure is announced on. */
export const MODEL_CHANNEL = 'model'
/** How many versions of the model are kept. */
const KEEP_VERSIONS = 200
/** At most this many places per collection in a refusal. */
const PLACES_PER_ENTITY = 5

/** The table of the model's versions, made the first time a site changes its structure (design section 2). */
export const CMS_MODEL_TABLE_SQL = `CREATE TABLE IF NOT EXISTS "cms_model" (
  version    integer PRIMARY KEY,
  doc        jsonb NOT NULL,
  ops        jsonb NOT NULL,
  user_id    uuid,
  created_at timestamptz(3) NOT NULL DEFAULT now()
)`

export interface CmsModelChangeInput {
  /** The version the change was made against (0 before the first change). */
  baseVersion: number
  ops: ModelOp[]
  /** Run everything, statements included, then roll it back: the answer says what would happen. */
  dryRun?: boolean
  /** The server's own sweep (allows `purge`). */
  internal?: boolean
}

export interface CmsModelChangeResult {
  version: number
  doc: ModelDoc
  notes: ModelNote[]
  /** How many statements ran (or would run, for a dry run). */
  statements: number
  dryRun?: boolean
}

/** A place that shows or links to what a change would take away. */
export interface CmsModelPlace {
  entity: string
  id: string
  title: string
  /** The blocks field (`sections`) for a block, or the link field for a link. */
  field: string | null
  /** The block a place is, or null for a link. `label` is the block definition's label, so a block with no heading can be named. */
  block: { id: string; type: string; heading: string | null; label: unknown } | null
  /** Null: the entry's own row; else the translation's language. */
  locale: string | null
  admin: string
}

/** A place where a block's binding names something the site does not have. */
export interface CmsModelAttention extends CmsModelPlace {
  missing: BindingMissing
}

const quoteIdent = (id: string) => `"${id.replace(/"/g, '""')}"`
const rowsOf = (res: any): any[] => res?.rows ?? res ?? []

/** A refusal a person can act on: `{ code, message, … }` in the answer's `data`. */
function refusal(statusCode: number, code: string, message: string, extra: Record<string, unknown> = {}): Error {
  return createError({ statusCode, statusMessage: message, data: { code, message, ...extra } })
}

class StaleVersion extends Error {
  constructor(readonly current: number) { super('stale') }
}
class DryRun extends Error {
  constructor(readonly result: CmsModelChangeResult) { super('dry run') }
}

// ── the guard: what the stored content says ────────────────────────────────────

/**
 * Entries and globals whose stored content links to any entry of the type `type` (a stored
 * `cms:<type>/…` anywhere `linksTo` looks: link fields and rich text, inside lists, blocks and
 * groups, translations too). At most `perEntity` per collection. Entries of the type itself do not count.
 */
export async function linksToType(db: any, reg: CmsRegistry, type: string, perEntity = PLACES_PER_ENTITY): Promise<CmsModelPlace[]> {
  const prefix = linkRef(type, '').toLowerCase()
  const has = (col: any) => sql`strpos(lower(cast(${col} as text)), ${prefix}) > 0`
  const out: CmsModelPlace[] = []
  for (const e of reg.entities) {
    if (e.name === type) continue
    const keys = linkFieldsOf(e.fields as any).map(([k]) => k)
    if (!keys.length) continue
    const own = e.table as any
    const titleCol = own[e.titleField] ?? own.id
    const found = new Map<string, CmsModelPlace>()
    const add = (id: string, title: unknown, locale: string | null, field: string | null) => {
      const key = `${id}:${locale ?? ''}`
      if (found.has(key) || found.size >= perEntity) return
      found.set(key, { entity: e.name, id, title: e.singleton || title == null ? '' : String(title), field, block: null, locale, admin: e.singleton ? `/admin/${e.name}` : `/admin/${e.name}/${id}` })
    }
    const rows: any[] = await db.select({ id: own.id, title: titleCol }).from(own).where(or(...keys.map((k) => has(own[k])))).limit(perEntity)
    for (const r of rows) {
      let field: string | null = keys.length === 1 ? keys[0]! : null
      if (field === null) {
        for (const k of keys) {
          const [hit] = await db.select({ id: own.id }).from(own).where(sql`${own.id} = ${r.id} and ${has(own[k])}`).limit(1)
          if (hit) { field = k; break }
        }
      }
      add(r.id, r.title, null, field)
    }
    const t = e.localesTable as any
    const tkeys = keys.filter((k) => e.localized.includes(k) && t?.[k])
    if (t && tkeys.length && found.size < perEntity) {
      const hits: any[] = await db.select({ parentId: t.parentId, locale: t.locale }).from(t).where(or(...tkeys.map((k) => has(t[k])))).limit(perEntity)
      for (const h of hits) {
        const [parent] = await db.select({ id: own.id, title: titleCol }).from(own).where(sql`${own.id} = ${h.parentId}`)
        if (parent) add(parent.id, parent.title, h.locale, tkeys.length === 1 ? tkeys[0]! : null)
      }
    }
    out.push(...found.values())
  }
  return out
}

/** A binding found in the stored blocks of an entry (or of one of its translations). */
interface BindingHit {
  entity: CmsEntity
  id: string
  title: string
  /** The blocks field. */
  field: string
  /** Null: the entry's own row; else the translation's language. */
  locale: string | null
  block: { id: string; type: string; heading: string | null; label: unknown }
  binding: CmsBinding
}

const adminPath = (e: CmsEntity, id: string) => (e.singleton ? `/admin/${e.name}` : `/admin/${e.name}/${id}`)

function placeOf(h: BindingHit): CmsModelPlace {
  return { entity: h.entity.name, id: h.id, title: h.title, field: h.field, block: h.block, locale: h.locale, admin: adminPath(h.entity, h.id) }
}

/**
 * The first `perEntity` hits of each collection, and at most `total` of all, as places.
 * Hits come in registry order, so the first ones of a collection are kept.
 */
function placesOf(hits: BindingHit[], perEntity: number, total: number): CmsModelPlace[] {
  const seen = new Map<string, number>()
  const out: CmsModelPlace[] = []
  for (const h of hits) {
    if (out.length >= total) break
    const n = seen.get(h.entity.name) ?? 0
    if (n >= perEntity) continue
    seen.set(h.entity.name, n + 1)
    out.push(placeOf(h))
  }
  return out
}

/**
 * Every binding of a block in the stored pages that `match` accepts: in each blocks field of each
 * collection (top level of the entity), on the entry's own row and on its translations. Only the
 * rows that hold a block with a binding are read (`@>` on the stored blocks), and their blocks are
 * walked here. Table and column names come from the registry's table objects; the block types
 * are passed as parameters.
 */
async function findBindings(db: any, reg: CmsRegistry, match: (binding: CmsBinding) => boolean): Promise<BindingHit[]> {
  const out: BindingHit[] = []
  for (const e of reg.entities) {
    const own = e.table as any
    const titleCol = own[e.titleField] ?? own.id
    for (const [key, fld] of Object.entries(e.fields)) {
      if (fld.type !== 'blocks' || !fld.blocks) continue
      const types = bindingBlockTypes(fld.blocks)
      if (!types.size) continue
      const column = (table: any) => table?.[propOf(key, fld)]
      const holds = (col: any) => or(...[...types.keys()].map((type) => sql`${col} @> ${JSON.stringify([{ type }])}::jsonb`))
      const collect = (id: string, title: unknown, locale: string | null, value: unknown) => {
        let stored = value
        if (typeof stored === 'string') { try { stored = JSON.parse(stored) } catch { stored = null } }
        for (const found of bindingsIn(stored, types)) {
          if (!match(found.binding)) continue
          const label = fld.blocks![found.block.type]?.label ?? null
          out.push({ entity: e, id, title: e.singleton || title == null ? '' : String(title), field: key, locale, block: { ...found.block, label }, binding: found.binding })
        }
      }
      if (column(own)) {
        const rows: any[] = await db.select({ id: own.id, title: titleCol, value: column(own) }).from(own).where(holds(column(own)))
        for (const r of rows) collect(r.id, r.title, null, r.value)
      }
      const t = e.localesTable as any
      if (t && e.localized.includes(key) && column(t)) {
        const rows: any[] = await db.select({ parentId: t.parentId, locale: t.locale, value: column(t) }).from(t).where(holds(column(t)))
        const parents = new Map<string, unknown>()
        const ids = [...new Set(rows.map((r) => r.parentId as string))]
        if (ids.length) {
          const found: any[] = await db.select({ id: own.id, title: titleCol }).from(own).where(sql`${own.id} in (${sql.join(ids.map((id) => sql`${id}`), sql`, `)})`)
          for (const p of found) parents.set(p.id, p.title)
        }
        for (const r of rows) if (parents.has(r.parentId)) collect(r.parentId, parents.get(r.parentId), r.locale, r.value)
      }
    }
  }
  return out
}

/**
 * Where a block shows a field or a type, or orders by it: the blocks of the pages whose binding
 * names `type` (and, with `field`, shows it or orders by it). `field` null: the type itself. At
 * most `perEntity` places per collection, and `total` in all.
 */
export async function blocksShowing(db: any, reg: CmsRegistry, type: string, field: string | null, perEntity = PLACES_PER_ENTITY, total = Infinity): Promise<CmsModelPlace[]> {
  return placesOf(await findBindings(db, reg, (b) => bindingUses(b, type, field)), perEntity, total)
}

/** The blocks whose binding names a type or a field the site does not have, each with what is missing. At most `limit`. */
export async function cmsModelAttention(limit = 50): Promise<CmsModelAttention[]> {
  const doc = cmsLoadedCustomPart()?.doc ?? null
  const { db, reg } = useCms()
  const out: CmsModelAttention[] = []
  for (const h of await findBindings(db, reg, (b) => bindingMissing(b, doc) !== null)) {
    if (out.length >= limit) break
    out.push({ ...placeOf(h), missing: bindingMissing(h.binding, doc)! })
  }
  return out
}

/** The guard's checks against stored content, for the operations that take something away. */
async function placesInUse(db: any, reg: CmsRegistry, ops: ModelOp[]): Promise<{ op: number; places: CmsModelPlace[]; what: string }[]> {
  const out: { op: number; places: CmsModelPlace[]; what: string }[] = []
  for (const [i, op] of (ops as any[]).entries()) {
    if (op?.op === 'type.remove') {
      const places = [...await blocksShowing(db, reg, op.type, null), ...await linksToType(db, reg, op.type)]
      if (places.length) out.push({ op: i, places, what: 'type' })
    }
    else if (op?.op === 'field.remove') {
      const places = await blocksShowing(db, reg, op.type, op.key)
      if (places.length) out.push({ op: i, places, what: 'field' })
    }
  }
  return out
}

// ── the function ───────────────────────────────────────────────────────────────

/**
 * Change the current site's own content types. Refusals are answers a person can act on: 404
 * (the feature is off for the site), 422 `{ code, message, op, details }` (an operation is not
 * valid, or the planner refuses a statement: `not-allowed` with `reasons`), 409 `stale-version`
 * (the model changed since `baseVersion`; `version` is the current one), 409 `in-use` with
 * `places`, 503 `busy` (the tables are in use; try again). Anything else is logged and answers 500.
 */
/** `event`: the request that asked (its person is named in the history and the audit log), or null for the server's own work. */
export function cmsChangeModel(event: any, input: CmsModelChangeInput): Promise<CmsModelChangeResult> {
  return changeModel(event, input, false)
}

/**
 * The same, for the site's own load (the later deletion found due before the instance serves):
 * the instance is not retired and nothing is announced, as it has not served the old model.
 */
export function cmsChangeModelBeforeLoad(input: CmsModelChangeInput): Promise<CmsModelChangeResult> {
  return changeModel(null, input, true)
}

async function changeModel(event: any, input: CmsModelChangeInput, beforeLoad: boolean): Promise<CmsModelChangeResult> {
  const feature = cmsCustomTypes()
  if (!feature.on) throw createError({ statusCode: 404, statusMessage: 'Not found' })
  if (!input || !Number.isInteger(input.baseVersion) || input.baseVersion < 0 || !Array.isArray(input.ops)) {
    throw refusal(422, 'invalid-request', 'A change names the version it was made against (a whole number) and a list of operations')
  }
  const site = useCmsSite()
  const design = cmsDesignModel()
  const loaded = cmsLoadedCustomPart()
  const userId: string | null = event?.context?.cmsUser?.id ?? null
  const { db } = useCms()
  let result: CmsModelChangeResult
  try {
    result = await db.transaction(async (tx: any) => {
      const exec = async (text: string, params: unknown[] = []) => rowsOf(await tx.execute(sqlWithParams(text, params)))
      await exec(`select pg_advisory_xact_lock(${MODEL_LOCK})`)
      await exec(`set local lock_timeout = '2s'`)
      await exec(CMS_MODEL_TABLE_SQL)
      const [latest] = await exec('select version, doc from "cms_model" order by version desc limit 1')
      const current = latest ? Number(latest.version) : 0
      if (input.baseVersion !== current) throw new StaleVersion(current)
      const before = latest ? parseModelDoc(latest.doc) : emptyModelDoc()

      // The facts the operations need, counted here, under the lock.
      const planned = modelPlanningBuild(before, design.config)
      const counts: Required<NonNullable<ModelContext['counts']>> = { entries: {}, values: {}, missing: {} }
      // A type this call makes, named by the caller: it has no entries yet.
      for (const op of input.ops as any[]) if (op?.op === 'type.add' && typeof op.name === 'string' && !before.types.some((t) => t.name === op.name)) counts.entries[op.name] = 0
      for (const q of modelCountQueries(planned.entities, input.ops)) {
        const [row] = await exec(q.text)
        counts[q.kind][q.key] = Number(row?.n ?? 0)
      }
      const ctx: ModelContext = { design: designTypesForModel(design.reg), limits: feature.limits, now: new Date(), counts, internal: !!input.internal, ...cmsModelPurgeTimes() }
      const applied = applyModelOps(before, input.ops, ctx)

      // The guard: what the stored content shows or links to.
      const inUse = await placesInUse(tx, planned.reg, input.ops)
      if (inUse.length) {
        const first = inUse[0]!
        const message = first.what === 'type'
          ? 'This content type is still in use: blocks on pages show its entries, or content links to them. Change those first'
          : 'This field is still shown or used to order a list on the website, by the blocks listed here. Change those blocks first'
        throw refusal(409, 'in-use', message, { op: first.op, places: inUse.flatMap((u) => u.places) })
      }

      const plan = planModelChange(before, applied.doc, design.config, input.ops)
      if (plan.refused.length) throw refusal(422, 'not-allowed', 'This change cannot be made to the database', { reasons: plan.refused })
      await runModelStatements((text) => exec(text), plan.statements)

      const version = current + 1
      await exec('insert into "cms_model" (version, doc, ops, user_id) values ($1, $2::jsonb, $3::jsonb, $4)', [version, JSON.stringify(applied.doc), JSON.stringify(input.ops), userId])
      await exec('delete from "cms_model" where version <= $1', [version - KEEP_VERSIONS])
      await audit(event, 'model.change', { meta: { version, ops: summary(input.ops), statements: plan.statements.length, ...(input.internal ? { internal: true } : {}) } }, tx)
      const out: CmsModelChangeResult = { version, doc: applied.doc, notes: applied.notes, statements: plan.statements.length }
      if (input.dryRun) throw new DryRun({ ...out, dryRun: true })
      return out
    })
  }
  catch (err) {
    if (err instanceof DryRun) return err.result
    if (err instanceof StaleVersion) {
      // This instance missed a change made elsewhere: it serves an older model. The next request reads the new one.
      if (!beforeLoad && loaded && err.current > loaded.version) cmsRetireCurrentSite()
      throw refusal(409, 'stale-version', 'The content types were changed in the meantime. Reload and try again', { version: err.current })
    }
    if (err instanceof ModelProblem) throw refusal(422, err.code, err.message, { op: err.op, details: err.details ?? null })
    if (err instanceof ModelStatementRefused) throw refusal(422, 'not-allowed', 'This change needs a statement that is not allowed here', { reasons: [err.reason] })
    if ((err as any)?.statusCode) throw err
    const pg = (err as any)?.code ? err : (err as any)?.cause
    if (pg?.code === '55P03') throw refusal(503, 'busy', 'The content is being saved right now, so the structure cannot change this moment. Try again in a few seconds')
    // An entry was saved without the field between the count and the statement.
    if (pg?.code === '23502') throw refusal(409, 'has-missing-values', 'Some entries have no value for a field that would be required. Fill them in first')
    console.error(`[cms] site ${site.id}: a change of the content types failed`, scrubError(err))
    throw createError({ statusCode: 500, statusMessage: 'The content types could not be changed' })
  }

  if (!beforeLoad) {
    // Requests under way finish with the model they started with; the next one reads the new model.
    cmsRetireCurrentSite()
    // The message names its site now: by the time the store answers, this work's instance may be gone.
    const message = channelMessage({ origin: instanceId(), version: result.version })
    const announced = useCmsStore()
      .then((store) => store.publish(MODEL_CHANNEL, message))
      .catch((err) => console.error('[cms] could not announce a change of the content types', scrubError(err)))
    if (typeof event?.waitUntil === 'function') event.waitUntil(announced)
  }
  return result
}

/** A short line per operation for the audit log: what it was and what it named. */
function summary(ops: ModelOp[]): { op: string; type?: string; key?: string }[] {
  return (ops as any[]).slice(0, 50).map((o) => ({
    op: String(o?.op ?? '').slice(0, 20),
    ...(typeof o?.type === 'string' ? { type: o.type.slice(0, 40) } : typeof o?.name === 'string' ? { type: o.name.slice(0, 40) } : {}),
    ...(typeof o?.key === 'string' ? { key: o.key.slice(0, 40) } : typeof o?.field?.key === 'string' ? { key: o.field.key.slice(0, 40) } : {}),
  }))
}

// ── other instances ────────────────────────────────────────────────────────────

const unknownSite = cmsProcessWide({ at: 0 }, 'a log throttle: one line a minute about messages for unknown sites')

/**
 * A change of structure announced by another instance (`model` channel; this handler runs with
 * no site). The site it names, when this process has it loaded with an older model, is retired:
 * its next request reads the new one. Messages of this process, and for sites it does not know, are dropped.
 */
export function cmsModelMessage(msg: any): void {
  if (!msg || typeof msg !== 'object' || msg.origin === instanceId()) return
  const version = Number(msg.version)
  if (!Number.isInteger(version) || version < 1) return
  const id = channelSiteId(msg)
  const site = id ? cmsSiteById(id) : null
  if (!site) {
    if (Date.now() - unknownSite.at > 60_000) {
      unknownSite.at = Date.now()
      console.warn(`[cms] dropped a change of content types for a site this instance does not know: ${String(id).slice(0, 80)}`)
    }
    return
  }
  // Looked at only if the site is loaded here; looking never loads it.
  const seen = cmsPeekInSite(site, () => ({ state: cmsCustomPartState(), version: cmsLoadedCustomPart()?.version ?? null }))
  if (!seen || seen.state === 'idle') return
  if (seen.state === 'loaded' && seen.version !== null && seen.version >= version) return
  cmsRetireSite(site.id)
}

// ── what the admin's routes read ───────────────────────────────────────────────

/** 404 unless the feature is on for the current site: the routes do not exist for a site without it. */
export function requireCustomTypes(): { on: true; limits: ModelContext['limits'] } {
  const feature = cmsCustomTypes()
  if (!feature.on) throw createError({ statusCode: 404, statusMessage: 'Not found' })
  return { on: true, limits: feature.limits }
}

/** How many entries each custom type of the document has (hidden types too: their tables are there until the later deletion). */
export async function countModelEntries(doc: ModelDoc | null): Promise<Record<string, number>> {
  const out: Record<string, number> = {}
  if (!doc?.types.length) return out
  const { db } = useCms()
  for (const t of doc.types) {
    const [row] = rowsOf(await db.execute(sql.raw(`select count(*)::int as n from ${quoteIdent(snake(t.name))}`)))
    out[t.name] = Number(row?.n ?? 0)
  }
  return out
}

/** The most places `cmsModelUsage` lists of each kind. */
const USAGE_PLACES = 50

/**
 * Where a custom type, or one of its fields, is shown or linked to now (what removing it would
 * meet). With a field: the blocks that show it or order by it. Without: the blocks that show the
 * type and the content that links to it (up to 50 of each), and, for each field some block
 * of the type uses, how many different entries have such a block.
 */
export async function cmsModelUsage(type: string, field: string | null): Promise<{ places: CmsModelPlace[]; fields?: Record<string, number> }> {
  const part = cmsLoadedCustomPart()
  const t = part?.doc?.types.find((x) => x.name === type)
  if (!t) throw createError({ statusCode: 404, statusMessage: 'No such content type' })
  if (field !== null && !t.fields.some((f) => f.key === field)) throw createError({ statusCode: 404, statusMessage: 'No such field' })
  const { db } = useCms()
  const { reg } = modelPlanningBuild(part!.doc!, cmsDesignModel().config)
  if (field !== null) return { places: await blocksShowing(db, reg, type, field, USAGE_PLACES, USAGE_PLACES) }
  const hits = await findBindings(db, reg, (b) => b.type === type)
  const entries = new Map<string, Set<string>>()
  for (const h of hits) {
    for (const key of bindingFields(h.binding)) {
      if (!entries.has(key)) entries.set(key, new Set())
      entries.get(key)!.add(`${h.entity.name}:${h.id}`)
    }
  }
  const fields: Record<string, number> = {}
  for (const [key, set] of entries) fields[key] = set.size
  return { places: [...placesOf(hits, USAGE_PLACES, USAGE_PLACES), ...await linksToType(db, reg, type, USAGE_PLACES)], fields }
}

/** The newest versions of the site's model: who changed it, when, and how (the documents themselves are left out). */
export async function cmsModelHistory(limit = 50): Promise<{ version: number; at: string; by: { id: string; name: string } | null; ops: unknown }[]> {
  const { db, reg } = useCms()
  const [exists] = rowsOf(await db.execute(sql`select to_regclass('public.cms_model') as t`))
  if (!exists?.t) return []
  const rows = rowsOf(await db.execute(sql`select version, created_at, user_id, ops from "cms_model" order by version desc limit ${limit}`))
  const ids = [...new Set(rows.map((r) => r.user_id).filter((id): id is string => typeof id === 'string'))]
  const names = new Map<string, string>()
  if (ids.length) {
    const u = reg.cmsUsers as any
    const people: any[] = await db.select({ id: u.id, name: u.name, email: u.email }).from(u).where(sql`${u.id} in (${sql.join(ids.map((id) => sql`${id}`), sql`, `)})`)
    for (const p of people) names.set(p.id, displayName(p.name, p.email) || '')
  }
  return rows.map((r) => ({
    version: Number(r.version),
    at: new Date(r.created_at).toISOString(),
    by: typeof r.user_id === 'string' ? { id: r.user_id, name: names.get(r.user_id) ?? '' } : null,
    ops: r.ops,
  }))
}
