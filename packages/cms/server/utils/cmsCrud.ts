import { and, eq, inArray, isNull, ne, or, sql } from 'tinyzoo'
import { propOf, snake, type CmsEntity, type CmsRegistry } from 'tinyzoo'
import type { CmsUser } from './cmsSession'

export function getEntity(reg: CmsRegistry, name: string | undefined): CmsEntity {
  const e = name ? reg.byName.get(name) : undefined
  if (!e) throw createError({ statusCode: 404, statusMessage: `Unknown entity: ${name}` })
  return e
}

/** Split a validated payload into scalar/FK column values and m2m id-lists. */
export function splitPayload(e: CmsEntity, data: Record<string, any>) {
  const values: Record<string, any> = {}
  const m2m: Record<string, string[]> = {}
  for (const [key, fld] of Object.entries(e.fields)) {
    if (!(key in data)) continue
    if (fld.relation?.kind === 'one-to-many') continue
    if (fld.relation?.kind === 'many-to-many') {
      m2m[key] = Array.isArray(data[key]) ? data[key] : []
      continue
    }
    values[propOf(key, fld)] = data[key]
  }
  return { values, m2m }
}

/**
 * Shape a DB row for the admin edit form: m2m → id arrays, owned FKs (media +
 * to-one) aliased from `${key}Id` back to the field key, the media record
 * attached as `${key}__media` for the preview, and blocks upgraded to their current
 * versions. Mutates + returns the row.
 */
export async function hydrateRowForForm(db: any, reg: CmsRegistry, e: CmsEntity, row: any, opts: { markFailed?: boolean } = {}) {
  // Blocks and lists stored at an older version are upgraded (and stamped) for the editor;
  // one whose upgrade failed is flagged (`__upgradeFailed`) and kept as stored.
  upgradeStoredJson(e, row, { admin: opts.markFailed !== false })
  for (const [key, fld] of Object.entries(e.fields)) {
    if (fld.relation?.kind !== 'many-to-many') continue
    const j = reg.junctionByOwnerField.get(`${e.name}.${key}`)!
    const links: any[] = await db.select().from(j.table).where(eq(j.table[j.ownerCol], row.id))
    row[key] = links.map((l) => l[j.targetCol])
  }
  for (const [key, fld] of Object.entries(e.fields)) {
    const ownsFk = (fld as any).type === 'media' || fld.relation?.kind === 'many-to-one'
    if (!ownsFk) continue
    const fkId = row[`${key}Id`] ?? null
    row[key] = fkId
    if ((fld as any).type === 'media') {
      row[`${key}__media`] = fkId
        ? (await db.select().from(reg.cmsMedia).where(eq(reg.cmsMedia.id, fkId)))[0] ?? null
        : null
    }
  }
  return row
}

/** Diff-write m2m junction rows in the surrounding transaction. */
export async function writeM2M(
  db: any, reg: CmsRegistry, e: CmsEntity, rowId: string,
  m2m: Record<string, string[]>, replace = false,
) {
  for (const [key, ids] of Object.entries(m2m)) {
    const j = reg.junctionByOwnerField.get(`${e.name}.${key}`)
    if (!j) continue
    if (replace) await db.delete(j.table).where(eq(j.table[j.ownerCol], rowId))
    if (ids.length) {
      await db.insert(j.table)
        .values(ids.map((tid) => ({ [j.ownerCol]: rowId, [j.targetCol]: tid })))
        .onConflictDoNothing()
    }
  }
}

export function parseOr422(schema: any, body: unknown) {
  const r = schema.safeParse(body)
  if (!r.success) {
    throw createError({ statusCode: 422, statusMessage: 'Validation failed', data: r.error.issues })
  }
  return r.data
}

/** Does a file type match a field's `accept` ("image/*", "application/pdf", "image/png,image/jpeg")? Extensions (".pdf") are only for the browser's file dialog. */
export function mimeAccepted(accept: string, mime: string): boolean {
  const wanted = accept.split(',').map((a) => a.trim().toLowerCase()).filter((a) => a && !a.startsWith('.'))
  if (!wanted.length) return true
  const type = mime.toLowerCase()
  return wanted.some((a) => a === '*/*' || a === type || (a.endsWith('/*') && type.startsWith(a.slice(0, -1))))
}

/**
 * A media, file or gallery field with an `accept` only takes files of those types — the
 * admin's picker filters by it, but the API must too (a video's id in a field that shows
 * pictures would only be a broken image on the site). 422, like any invalid value.
 */
export async function assertMediaAccepted(db: any, reg: CmsRegistry, e: CmsEntity, data: Record<string, any>): Promise<void> {
  const wanted: { key: string; accept: string; ids: string[] }[] = []
  for (const [key, fld] of Object.entries(e.fields) as [string, any][]) {
    const accept = fld.meta?.accept
    if (typeof accept !== 'string' || !accept.trim() || !(key in data)) continue
    const value = data[key]
    if (fld.type === 'media' && typeof value === 'string') wanted.push({ key, accept, ids: [value] })
    else if (fld.type === 'gallery' && Array.isArray(value)) wanted.push({ key, accept, ids: value.map((i: any) => i?.mediaId).filter((id: unknown) => typeof id === 'string') })
  }
  const ids = [...new Set(wanted.flatMap((w) => w.ids))]
  if (!ids.length) return
  const rows: { id: string; mime: string }[] = await db.select({ id: reg.cmsMedia.id, mime: reg.cmsMedia.mime }).from(reg.cmsMedia).where(inArray(reg.cmsMedia.id, ids))
  const mimeOf = new Map(rows.map((r) => [r.id, r.mime]))
  const issues: { code: string; path: string[]; message: string }[] = []
  for (const w of wanted) {
    const bad = w.ids.map((id) => mimeOf.get(id)).find((mime) => mime && !mimeAccepted(w.accept, mime))
    if (bad) issues.push({ code: 'custom', path: [w.key], message: 'This field takes ' + w.accept + ', not ' + bad })
  }
  if (issues.length) throw createError({ statusCode: 422, statusMessage: 'Validation failed', data: issues })
}

/**
 * Evaluate an access rule. Returns `{ allowed, where }`:
 *  - rule returns `true`  → full access
 *  - rule returns `false` → denied
 *  - rule returns a Drizzle condition → allowed, but AND that into the query (row-level)
 */
export function accessWhere(
  e: CmsEntity, op: 'read' | 'create' | 'update' | 'delete', user: CmsUser,
): { allowed: boolean; where: any } {
  // 1. The person's role decides first …
  const byRole = roleAccess(e, op, user)
  if (!byRole.allowed) return byRole
  // 2. … then the entity's own `access` rule narrows it further (AND). The rule sees the
  // role's name (`user.role`) and the built-in it is (or extends) as `user.base`: write
  // `user.base === 'author'` to treat a custom role like its parent.
  const rule = (e.access as any)?.[op]
  if (!rule) return byRole
  // A role name of an external sign-in on a site without `defineRoles` (legacy) gets no
  // `base`: it reaches what the entity rules allow, as before roles existed, but a rule that
  // trusts `base === 'editor'` (the forms' messages) must not take it for an editor.
  const role = roleOf(user)
  const res = rule({ user: { ...user, base: role?.legacy ? null : role?.base ?? null }, table: e.table })
  if (res === false || res === null || res === undefined) return { allowed: false, where: undefined }
  return { allowed: true, where: both(byRole.where, res === true ? undefined : res) }
}

/**
 * What a role may do (see `defineRoles`; cms_users.role):
 *  - admin: everything (and, only admin, manages people — see requireCmsAdmin)
 *  - editor: every entry of every collection and global
 *  - author: reads everything, creates entries, changes and deletes only entries they
 *    created, never touches settings (globals)
 *  - a role the site defined: the one it extends, with the operations it lists per
 *    collection (a listed collection gets exactly those) and its `publish` setting
 *  - a role the site does not know (removed from the config): nothing at all. With an
 *    external sign-in on a site that defines no roles: as before roles could be defined,
 *    everything, and the entities' own `access` rules decide.
 * People who may not publish cannot write content that is live the moment it is saved.
 */
export function roleAccess(e: CmsEntity, op: 'read' | 'create' | 'update' | 'delete', user: CmsUser): { allowed: boolean; where: any } {
  const role = roleOf(user)
  if (!role) return { allowed: false, where: undefined }
  if (role.base === 'admin') return { allowed: true, where: undefined }
  const listed = role.entities.get(e.name)
  if (listed && !listed.has(op)) return { allowed: false, where: undefined }
  if (op === 'read') return { allowed: true, where: undefined }
  const ownOnly = role.base === 'author'
  // Settings are an editor's: an author-based role has them only where its definition says so.
  if (ownOnly && e.singleton && !listed) return { allowed: false, where: undefined }
  // Content that is live the moment it is saved (public without a publish workflow,
  // or marked `live`, e.g. redirects) — writing it would be publishing.
  if (!role.publish && (e.live || (e.content?.public && !e.publish))) return { allowed: false, where: undefined }
  if (!ownOnly || op === 'create' || e.singleton) return { allowed: true, where: undefined }
  return { allowed: true, where: eq(e.table.createdBy, user.id) }
}

/** Rows that are not live (for writes by people who may not publish), or undefined. */
export function notLiveCond(e: CmsEntity, user: CmsUser): any {
  const p = e.publish
  if (!p || canPublish(user)) return undefined
  const col = e.table[propOf(p.field, e.fields[p.field]!)]
  return or(isNull(col), ne(col, p.publishedValue))
}

/**
 * May this person change this entry (or, with no id, the entity's one global)? The same
 * rules a save applies, told to the form beforehand so it opens read-only instead of
 * failing on save. `why` says which rule says no: the role, somebody else's entry,
 * or an entry that is live (people who may not publish cannot change what is live).
 */
export async function updateVerdict(db: any, e: CmsEntity, user: CmsUser, id?: string | null): Promise<{ update: boolean; why?: 'role' | 'owner' | 'published' }> {
  const a = accessWhere(e, 'update', user)
  if (!a.allowed) return { update: false, why: 'role' }
  if (!id) return { update: true }
  const [ok] = await db.select({ id: e.table.id }).from(e.table).where(both(both(eq(e.table.id, id), a.where), notLiveCond(e, user)))
  if (ok) return { update: true }
  const [mine] = await db.select({ id: e.table.id }).from(e.table).where(both(eq(e.table.id, id), a.where))
  return { update: false, why: mine ? 'published' : 'owner' }
}

/** The id to record as createdBy/updatedBy — only a UUID fits the column (external auth may use others). */
export function actorId(user: CmsUser): string | null {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(user.id) ? user.id : null
}

/** May this person publish (or unpublish) entries? Authors write drafts only; a custom role says so with `publish`. */
export function canPublish(user: CmsUser): boolean {
  return roleOf(user)?.publish ?? false
}

/**
 * Refuse a write that would change publication state for someone who may not
 * publish: setting the publish field to its published value, or editing an entry
 * that is already live (their change would go straight to the website).
 */
export function assertPublishAllowed(e: CmsEntity, user: CmsUser, values: Record<string, any>, current?: Record<string, any> | null) {
  const p = e.publish
  if (!p || canPublish(user)) return
  const field = propOf(p.field, e.fields[p.field]!)
  const live = (v: unknown) => v === p.publishedValue
  if (live(values[field]) || (current && live(current[field]))) {
    throw createError({ statusCode: 403, statusMessage: 'Your role can write drafts but not publish' })
  }
}

/** 'entry.publish' / 'entry.unpublish' when a write changed publication state, else null. */
export function publishAction(e: CmsEntity, before: Record<string, any> | null, after: Record<string, any>): string | null {
  const p = e.publish
  if (!p) return null
  const field = propOf(p.field, e.fields[p.field]!)
  const was = before?.[field] === p.publishedValue
  const is = after[field] === p.publishedValue
  if (was === is) return null
  return is ? 'entry.publish' : 'entry.unpublish'
}

/**
 * Who may change or delete a file: with the library open to every file (`media: 'all'`),
 * anyone; with `'own'` (authors), only the person who uploaded it; with `'none'`, nobody.
 */
export function assertMediaOwner(user: CmsUser, media: { uploadedBy?: string | null }) {
  const mode = mediaAccess(user)
  if (mode === 'none') throw createError({ statusCode: 403, statusMessage: 'Your role cannot use the media library' })
  if (mode === 'own' && media.uploadedBy !== user.id) {
    throw createError({ statusCode: 403, statusMessage: 'You can only change files you uploaded' })
  }
}

/** The media library is closed to a role with `media: 'none'` (listing, uploading, changing, deleting). */
export function assertMediaLibrary(user: CmsUser) {
  if (mediaAccess(user) === 'none') throw createError({ statusCode: 403, statusMessage: 'Your role cannot use the media library' })
}

/** Admin-only endpoints (people management, audit log, privacy). Only the built-in admin, whatever other roles are defined. */
export function requireCmsAdmin(event: any): CmsUser {
  const user = requireCmsUser(event)
  if (!roleOf(user)?.manage) throw createError({ statusCode: 403, statusMessage: 'Administrators only' })
  return user
}

/** Throw 403 if not allowed; return the row-level filter (or undefined). */
export function authorize(e: CmsEntity, op: 'read' | 'create' | 'update' | 'delete', user: CmsUser) {
  const { allowed, where } = accessWhere(e, op, user)
  if (!allowed) throw createError({ statusCode: 403, statusMessage: `Not allowed to ${op} ${e.name}` })
  return where
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** The `:id` route param, or 404 when it cannot be a row id (Postgres would 500 on a non-uuid). */
export function getIdParam(event: any, name = 'id'): string {
  const id = getRouterParam(event, name)
  if (!id || !UUID_RE.test(id)) throw createError({ statusCode: 404, statusMessage: 'Not found' })
  return id
}

/** Field key whose column a Postgres unique constraint (`<table>_<column>_unique`) is on. */
function fieldOfConstraint(e: CmsEntity, constraint: string | undefined): string | undefined {
  if (!constraint) return undefined
  for (const [key, fld] of Object.entries(e.fields)) {
    const col = (e.table as any)[propOf(key, fld)]
    if (col?.name && (constraint === `${snake(e.name)}_${col.name}_unique` || constraint === `${snake(e.name)}_locales_${col.name}_unique`)) return key
  }
  return undefined
}

/**
 * Translate Postgres constraint violations into answers an editor can act on,
 * instead of a 500. Rethrows anything else untouched.
 *  - unique violation → 409, with a Zod-shaped issue on the field when known
 *  - FK violation on delete → 409 (still referenced, e.g. `onDelete: 'restrict'`)
 *  - FK violation on write → 422 (points at a row that does not exist)
 */
export function rethrowDbError(err: any, e: CmsEntity, op: 'write' | 'delete'): never {
  // Drizzle wraps driver errors (DrizzleQueryError) and keeps the original as `cause`.
  const pgErr = err?.code ? err : err?.cause
  if (pgErr?.code === '23505') {
    const field = fieldOfConstraint(e, pgErr.constraint)
    throw createError({
      statusCode: 409,
      statusMessage: 'Value already in use',
      data: field ? [{ path: [field], code: 'unique', message: 'Already in use' }] : undefined,
    })
  }
  if (pgErr?.code === '23503') {
    if (op === 'delete') {
      throw createError({ statusCode: 409, statusMessage: 'Still in use by other content; remove those references first' })
    }
    throw createError({ statusCode: 422, statusMessage: 'Refers to an item that does not exist' })
  }
  throw err
}

/** AND two optional Drizzle conditions. */
export function both(a: any, b: any) {
  return b ? (a ? and(a, b) : b) : a
}

/**
 * The version an edit is based on: the entry's `updatedAt` as the editor loaded it,
 * sent in the `X-CMS-Version` header. Null when absent (no check: API clients and
 * scripts that want last-write-wins simply leave it out).
 */
export function baseVersion(event: any): Date | null {
  const raw = getRequestHeader(event, 'x-cms-version')
  if (!raw) return null
  const d = new Date(raw)
  if (Number.isNaN(d.getTime())) throw createError({ statusCode: 400, statusMessage: 'Invalid X-CMS-Version' })
  return d
}

/**
 * 409 when the entry changed since the editor loaded it, saying who changed it and
 * when, so the admin can offer to reload or to save over it.
 */
export async function assertCurrentVersion(e: CmsEntity, current: Record<string, any> | null | undefined, base: Date | null): Promise<void> {
  if (!base || !current?.updatedAt) return
  if (new Date(current.updatedAt).getTime() === base.getTime()) return
  let byName: string | null = null
  if (current.updatedBy) {
    const { db, reg } = useCms()
    const [u] = await db.select({ name: reg.cmsUsers.name, email: reg.cmsUsers.email }).from(reg.cmsUsers).where(eq(reg.cmsUsers.id, current.updatedBy))
    byName = u ? displayName(u.name, u.email) || null : null
  }
  throw createError({
    statusCode: 409,
    statusMessage: 'Changed by someone else since you opened it',
    data: { code: 'stale', entity: e.name, version: new Date(current.updatedAt).toISOString(), updatedBy: current.updatedBy ?? null, updatedByName: byName },
  })
}

/**
 * The next version stamp for a row: now, but always at least 1 ms after the current
 * one — two saves never share a version, even with replica clocks out of step.
 */
export function nextVersion(col: any) {
  return sql`greatest(date_trunc('milliseconds', clock_timestamp()), ${col} + interval '1 millisecond')`
}

/**
 * Publishing without a publish date stamps "now" — the database's clock, not the
 * browser's. A date given is kept: ahead schedules the entry (the scheduler announces
 * it when it comes, even seconds later), behind back-dates it.
 */
export function stampPublishDate(e: CmsEntity, values: Record<string, any>, before: Record<string, any> | null) {
  const p = e.publish
  if (!p?.dateField) return
  const statusKey = propOf(p.field, e.fields[p.field]!)
  const dateKey = propOf(p.dateField, e.fields[p.dateField]!)
  const status = statusKey in values ? values[statusKey] : before?.[statusKey]
  if (status !== p.publishedValue) return
  const date = dateKey in values ? values[dateKey] : before?.[dateKey]
  if (date == null || date === '') values[dateKey] = sql`date_trunc('milliseconds', clock_timestamp())`
}

/**
 * What still points at an entry (many-to-one relations of other collections), so a
 * refused delete can say where it is used: a few titles per collection.
 */
export async function usedBy(db: any, reg: CmsRegistry, target: CmsEntity, id: string): Promise<{ entity: string; id: string; title: string; fields: string[] }[]> {
  const out: { entity: string; id: string; title: string; fields: string[] }[] = []
  for (const e of reg.entities) {
    for (const [key, fld] of Object.entries(e.fields) as [string, any][]) {
      if (fld.type !== 'relation' || fld.relation?.kind !== 'many-to-one') continue
      if ((fld.relation.to() as CmsEntity).name !== target.name) continue
      const col = e.table[`${key}Id`]
      if (!col) continue
      const rows: any[] = await db.select({ id: e.table.id, title: e.table[e.titleField] ?? e.table.id }).from(e.table).where(eq(col, id)).limit(5)
      for (const r of rows) out.push({ entity: e.name, id: r.id, title: r.title == null ? '' : String(r.title), fields: [key] })
    }
  }
  return out
}
