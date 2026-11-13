import { and, eq } from '@my-cms/core'
import { propOf, type CmsEntity, type CmsRegistry } from '@my-cms/core'
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
 * to-one) aliased from `${key}Id` back to the field key, and the media record
 * attached as `${key}__media` for the preview. Mutates + returns the row.
 */
export async function hydrateRowForForm(db: any, reg: CmsRegistry, e: CmsEntity, row: any) {
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

/**
 * Evaluate an access rule. Returns `{ allowed, where }`:
 *  - rule returns `true`  → full access
 *  - rule returns `false` → denied
 *  - rule returns a Drizzle condition → allowed, but AND that into the query (row-level)
 */
export function accessWhere(
  e: CmsEntity, op: 'read' | 'create' | 'update' | 'delete', user: CmsUser,
): { allowed: boolean; where: any } {
  const rule = (e.access as any)?.[op]
  if (!rule) return { allowed: true, where: undefined }
  const res = rule({ user, table: e.table })
  if (res === true) return { allowed: true, where: undefined }
  if (!res) return { allowed: false, where: undefined }
  return { allowed: true, where: res }
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
    if (col?.name && constraint === `${e.name}_${col.name}_unique`) return key
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
      throw createError({ statusCode: 409, statusMessage: 'Still in use by other content — remove those references first' })
    }
    throw createError({ statusCode: 422, statusMessage: 'Refers to an item that does not exist' })
  }
  throw err
}

/** AND two optional Drizzle conditions. */
export function both(a: any, b: any) {
  return b ? (a ? and(a, b) : b) : a
}
