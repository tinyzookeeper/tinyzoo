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

/** AND two optional Drizzle conditions. */
export function both(a: any, b: any) {
  return b ? (a ? and(a, b) : b) : a
}
