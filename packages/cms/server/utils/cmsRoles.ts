import { z } from 'zod'
import { allRoleNames, fieldEditable, fieldReadable, resolveRole } from 'tinyzoo'
import type { CmsEntity, CmsFieldRule, CmsMediaAccess, CmsResolvedRole } from 'tinyzoo'

/**
 * What the signed-in person's role means on this site: the built-in role, or one the site
 * defined with `defineRoles`. Null when the site does not know the role (it was removed from
 * the config): that account has no access to anything, whatever its name once meant.
 *
 * An external sign-in (`cms.auth.mode: 'external'`) on a site that defines **no** roles keeps
 * what it always had: a role name the CMS does not know is treated as an editor's reach and
 * the entities' own `access` rules decide. As soon as the site defines roles, every name must
 * be known: an unknown one fails closed, like a removed role.
 */
export function roleOf(user: { role?: unknown } | null | undefined): CmsResolvedRole | null {
  if (!user) return null
  const { reg } = useCms()
  return resolveRole(reg.roles, user.role, { legacyUnknown: cmsAuthMode() === 'external' })
}

/** The person's media library access ('none' for a role the site does not know). */
export function mediaAccess(user: { role?: unknown } | null | undefined): CmsMediaAccess {
  return roleOf(user)?.media ?? 'none'
}

/** The role names an administrator can give a person: the built-ins and the site's own. */
export function assignableRoles(): string[] {
  return allRoleNames(useCms().reg.roles)
}

// ── per-field access ──────────────────────────────────────────────────────────────

const ruled = new WeakMap<CmsEntity, [string, CmsFieldRule][]>()

/** The fields of an entity that carry an `.access()` rule (most have none). */
export function fieldRules(e: CmsEntity): [string, CmsFieldRule][] {
  let list = ruled.get(e)
  if (!list) {
    list = []
    for (const [key, fld] of Object.entries(e.fields)) {
      const rule = (fld as any).meta?.access as CmsFieldRule | undefined
      if (rule) list.push([key, rule])
    }
    ruled.set(e, list)
  }
  return list
}

/** Does any field of the entity have an access rule? */
export const hasFieldRules = (e: CmsEntity): boolean => fieldRules(e).length > 0

/** The keys of the fields this person may not read. */
export function unreadableFields(e: CmsEntity, user: { role?: unknown }): Set<string> {
  const out = new Set<string>()
  const list = fieldRules(e)
  if (!list.length) return out
  const role = roleOf(user)
  for (const [key, rule] of list) if (!fieldReadable(role, rule)) out.add(key)
  return out
}

/** The keys of the fields this person may not edit (the unreadable ones included). */
export function uneditableFields(e: CmsEntity, user: { role?: unknown }): Set<string> {
  const out = new Set<string>()
  const list = fieldRules(e)
  if (!list.length) return out
  const role = roleOf(user)
  for (const [key, rule] of list) if (!fieldEditable(role, rule)) out.add(key)
  return out
}

export const canReadField = (e: CmsEntity, key: string, user: { role?: unknown }): boolean => !unreadableFields(e, user).has(key)

/**
 * Take the fields this person may not read out of a row (or rows) about to be sent: the
 * field, the column of a to-one relation or media field (`<key>Id`), and what the form
 * attaches (`<key>__label`, `<key>__media`, the default-language value of a translation).
 * Mutates and returns what it is given.
 */
export function stripUnreadable<R extends Record<string, any> | null | undefined>(e: CmsEntity, user: { role?: unknown }, row: R): R {
  if (!row || !hasFieldRules(e)) return row
  const hidden = unreadableFields(e, user)
  if (!hidden.size) return row
  for (const key of hidden) {
    delete (row as any)[key]
    delete (row as any)[`${key}Id`]
    delete (row as any)[`${key}__label`]
    delete (row as any)[`${key}__media`]
    if ((row as any).__defaults) delete (row as any).__defaults[key]
  }
  return row
}

export function stripUnreadableRows<R extends Record<string, any>>(e: CmsEntity, user: { role?: unknown }, rows: R[]): R[] {
  if (hasFieldRules(e)) for (const r of rows) stripUnreadable(e, user, r)
  return rows
}

/** Remove from a snapshot of values (a revision) what this person may not read. */
export function stripUnreadableValues(e: CmsEntity, user: { role?: unknown }, data: Record<string, any> | null | undefined): void {
  stripUnreadable(e, user, data)
}

/**
 * Refuse a write that names a field this person may not edit (403, saying which). Checked on
 * the keys the request sent, before anything is validated or stored: a field the person cannot
 * edit is never in a write at all — the admin leaves it out, and an API client that sends it
 * is told so, instead of its value being dropped without a word. Fields the person cannot edit
 * keep what they hold (a default only fills a *new* entry).
 */
export function assertFieldsEditable(e: CmsEntity, user: { role?: unknown }, keys: Iterable<string>): void {
  const blocked = uneditableFields(e, user)
  if (!blocked.size) return
  const hit = [...new Set(keys)].filter((k) => blocked.has(k) && Object.hasOwn(e.fields, k))
  if (!hit.length) return
  const names = hit.join(', ')
  throw createError({
    statusCode: 403,
    statusMessage: `Your role cannot change ${hit.length > 1 ? 'these fields' : 'this field'}: ${names}`,
    data: { code: 'field_forbidden', fields: hit },
  })
}

/** The keys a JSON request body names (nothing for a body that is not an object). */
export function bodyKeys(body: unknown): string[] {
  return body && typeof body === 'object' && !Array.isArray(body) ? Object.keys(body as object) : []
}

/** The role of an invitation or a change of role: one the site has (a built-in or one it defined). */
export function assignableRoleSchema() {
  return z.string().refine((r) => assignableRoles().includes(r), { message: 'Unknown role' })
}

/** What a role may do with one collection or global: the operations it has, and whether only on its own entries. */
export interface CmsRoleReach { ops: ('read' | 'create' | 'update' | 'delete')[]; own: boolean }

/**
 * What a role reaches, area by area of the admin (every collection and global of the site): the same
 * rules a request meets (the role, then the entity's own `access` rule, asked about a person with only
 * that role), so the Team page can say in words what each role does. An area the role cannot read is
 * left out. A rule that needs more of the person than their role (a row rule on their id) is taken as
 * "some entries", which is what the person meets too.
 */
export function roleReach(name: string): Record<string, CmsRoleReach> {
  const { reg } = useCms()
  const role = resolveRole(reg.roles, name)
  const out: Record<string, CmsRoleReach> = {}
  if (!role) return out
  const someone = { id: '00000000-0000-0000-0000-000000000000', email: '', name: '', role: name }
  const ask = (e: CmsEntity, op: CmsRoleReach['ops'][number]) => {
    try {
      return accessWhere(e, op, someone)
    }
    catch {
      // An `access` rule that cannot answer for a made-up person: what the role alone allows.
      return roleAccess(e, op, someone)
    }
  }
  for (const g of reg.graph) {
    const e = reg.byName.get(g.name)
    if (!e) continue
    const read = ask(e, 'read')
    if (!read.allowed) continue
    const reach: CmsRoleReach = { ops: ['read'], own: false }
    for (const op of ['create', 'update', 'delete'] as const) {
      if (e.singleton && op !== 'update') continue
      const a = ask(e, op)
      if (!a.allowed) continue
      reach.ops.push(op)
      // Changing or deleting only some entries: an author's own (the row rule on `createdBy`).
      if (op !== 'create' && a.where !== undefined && role.base === 'author') reach.own = true
    }
    out[g.name] = reach
  }
  return out
}

/**
 * The roles an administrator can pick, for the Team page: name, label, what they extend, and what each
 * reaches (`reach`), publishes and may do with files, so the admin can describe a role that has no
 * `description` of its own, and show every role side by side.
 */
export function roleChoices() {
  const { reg } = useCms()
  return assignableRoles().map((name) => {
    const r = resolveRole(reg.roles, name)!
    return {
      name, custom: r.custom, from: r.base, label: r.label ?? null, description: r.description ?? null,
      publish: r.publish, media: r.media, manage: r.manage, reach: roleReach(name),
      // The collections its definition names: what the role is about, said first.
      listed: [...r.entities.keys()],
    }
  })
}

/**
 * A signed-in person's draft preview (`?preview` on the content API) shows the page without the
 * fields their role may not read: the preview must not be a way round `.access({ read })`.
 * The public answer, and a preview made with the content token, are not touched.
 */
export function stripForPreviewer(event: any, e: CmsEntity, items: Record<string, any>[]): void {
  const user = event?.context?.cmsUser
  if (!user || getQuery(event).preview === undefined) return
  for (const item of items) stripUnreadable(e, user, item)
}

/**
 * The roles that may change a field with this rule, for the sentence under a locked field ("Only Editor and
 * Administrator can change this"): the roles it lists, built-ins first, the administrator (who always may) last.
 * Each with its label from the config (null for a built-in: the admin names those itself).
 */
export function editableBy(rule: CmsFieldRule | undefined): { name: string; label: unknown }[] {
  const { reg } = useCms()
  const names = rule?.edit ?? rule?.read ?? []
  const order = allRoleNames(reg.roles)
  const listed = [...new Set([...names.filter((n) => n !== 'admin'), 'admin'])]
    .sort((a, b) => (a === 'admin' ? 1 : b === 'admin' ? -1 : order.indexOf(a) - order.indexOf(b)))
  return listed.map((name) => ({ name, label: resolveRole(reg.roles, name)?.label ?? null }))
}
