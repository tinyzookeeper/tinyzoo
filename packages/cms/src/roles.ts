import type { LocalizedText } from './i18n'
import { CMS_ROLES, type CmsRole } from './system'

/**
 * Roles beyond admin, editor and author.
 *
 *   export const roles = defineRoles({
 *     translator: {
 *       from: 'editor',
 *       label: { cs: 'Překladatel', en: 'Translator' },
 *       entities: { post: ['read', 'update'], page: ['read', 'update'] },
 *       publish: false,
 *       media: 'own',
 *     },
 *   })
 *
 * A custom role always **extends a built-in** (`from`): it starts as that role and
 * narrows it (or, for an `author`, widens it) per entity. It is never an administrator:
 * only `admin` manages people, whatever a role is named or based on. What a role may do
 * with each field is set on the field (`f.text().access({ edit: [roles.translator] })`);
 * which role a person has is set in the admin's Team page and stored in `cms_users.role`.
 *
 * This file has no server code: the config is read in the browser build too.
 */

/** What a role may do with the entries of one collection (or a global: read and update). */
export type CmsEntityOp = 'read' | 'create' | 'update' | 'delete'
export const CMS_ENTITY_OPS = ['read', 'create', 'update', 'delete'] as const

/** The media library: every file ('all'), the person's own uploads to change ('own'), or closed ('none'). */
export type CmsMediaAccess = 'all' | 'own' | 'none'
export const CMS_MEDIA_ACCESS = ['all', 'own', 'none'] as const

/** The built-in roles a custom role can extend. `admin` cannot be extended. */
export type CmsRoleBase = Exclude<CmsRole, 'admin'>
export const CMS_ROLE_BASES = ['editor', 'author'] as const

export interface CmsRoleDef {
  /** The built-in role this one starts as: `editor` (every entry) or `author` (drafts, own entries). */
  from: CmsRoleBase
  /** The name shown in the admin (Team, the account menu, invitations). One string, or one per admin language. Default: the role's key, capitalised. */
  label?: LocalizedText
  /** One sentence on what the role is for, shown beside it in the Team page. */
  description?: LocalizedText
  /**
   * What the role may do with a collection, by its name. A collection listed here gets
   * exactly these operations (`['read']` reads, `[]` does not see it); one left out is
   * what `from` allows. Any other operation needs `'read'` too. A global has `read` and `update`.
   * A role based on `author` keeps the rule that it changes and deletes only entries it created.
   */
  entities?: Record<string, readonly CmsEntityOp[]>
  /** May publish and unpublish, and change what is live. Default: what `from` has (editor yes, author no). */
  publish?: boolean
  /** The media library. Default: what `from` has (editor `'all'`, author `'own'`). */
  media?: CmsMediaAccess
}

/** A role named in a field's `access` list. `roles.translator` is one; built-ins are plain strings too. */
export interface CmsRoleRef<N extends string = string> {
  readonly __cms: 'role'
  readonly name: N
}
export type CmsRoleInput = CmsRole | CmsRoleRef

/**
 * Who may read and who may edit one field. A list names roles; a role missing from it
 * does not see (read) or cannot change (edit) the field. Left out: everyone who can read
 * (or write) the collection. Administrators always may. `edit` implies `read`.
 */
export interface CmsFieldAccess {
  read?: readonly CmsRoleInput[]
  edit?: readonly CmsRoleInput[]
}

/** The rule as stored on a field (`meta.access`): role names only. */
export interface CmsFieldRule {
  read?: string[]
  edit?: string[]
}

/** What `defineRoles` returns: a reference to every role, to name them in `.access()`. */
export type CmsRoles<R extends Record<string, CmsRoleDef>> =
  { readonly [K in keyof R & string]: CmsRoleRef<K> }
  & { readonly admin: CmsRoleRef<'admin'>; readonly editor: CmsRoleRef<'editor'>; readonly author: CmsRoleRef<'author'>; readonly __cms: 'roles' }

/** The definitions behind a `defineRoles` result (not enumerable on it). */
export interface CmsRolesDef {
  __cms: 'roles'
  roles: Record<string, CmsRoleDef>
}

const NAME = /^[a-z][a-z0-9_-]{0,39}$/
const DEFS = Symbol.for('tinyzoo.roles')

const isRef = (v: unknown): v is CmsRoleRef => !!v && typeof v === 'object' && (v as any).__cms === 'role' && typeof (v as any).name === 'string'

/** The name a role is stored under (cms_users.role): a string as given, or a reference's name. */
export function roleName(input: CmsRoleInput | string): string {
  return typeof input === 'string' ? input : input.name
}

/**
 * Define the site's own roles (export the result from `cms.config.ts`, above the entities that
 * name them). Checked as it is called: a role named like a built-in, one that extends
 * `admin`, an unknown operation or media setting. Collection names are checked once the
 * entities are known (when the config loads).
 */
export function defineRoles<const R extends Record<string, CmsRoleDef>>(roles: R & { [K in CmsRole]?: never }): CmsRoles<R> {
  const defs: Record<string, CmsRoleDef> = {}
  for (const [name, def] of Object.entries(roles as Record<string, CmsRoleDef>)) {
    if ((CMS_ROLES as readonly string[]).includes(name)) {
      throw new Error(`The role "${name}" is built in (${CMS_ROLES.join(', ')}); give your own role another name.`)
    }
    if (!NAME.test(name)) {
      throw new Error(`Invalid role name "${name}": lower-case letters, digits, "-" and "_", starting with a letter, at most 40 characters ("translator", "shop-manager"). The name is stored with each person; the label shown in the admin is separate.`)
    }
    if (!def || typeof def !== 'object') throw new Error(`The role "${name}" needs a definition: { from: 'editor' | 'author', … }.`)
    if ((def.from as string) === 'admin') {
      throw new Error(`The role "${name}" cannot extend admin: only the built-in admin manages people. Extend 'editor' and list what it may do.`)
    }
    if (!(CMS_ROLE_BASES as readonly string[]).includes(def.from)) {
      throw new Error(`The role "${name}" must say which built-in role it extends: from: 'editor' or 'author' (got ${JSON.stringify(def.from)}).`)
    }
    if (def.media !== undefined && !(CMS_MEDIA_ACCESS as readonly string[]).includes(def.media)) {
      throw new Error(`The role "${name}" has media: ${JSON.stringify(def.media)}; use 'all', 'own' or 'none'.`)
    }
    if (def.publish !== undefined && typeof def.publish !== 'boolean') throw new Error(`The role "${name}" has publish: ${JSON.stringify(def.publish)}; use true or false.`)
    for (const [entity, ops] of Object.entries(def.entities ?? {})) {
      if (!Array.isArray(ops)) throw new Error(`The role "${name}" lists "${entity}" with ${JSON.stringify(ops)}; use a list of operations, e.g. ['read', 'update'].`)
      for (const op of ops) {
        if (!(CMS_ENTITY_OPS as readonly string[]).includes(op)) throw new Error(`The role "${name}" lists the operation ${JSON.stringify(op)} for "${entity}"; use ${CMS_ENTITY_OPS.map((o) => `'${o}'`).join(', ')}.`)
      }
      if (ops.length && !ops.includes('read')) {
        throw new Error(`The role "${name}" may ${ops.join(', ')} "${entity}" but not read it. Add 'read': a person cannot change what they cannot see.`)
      }
    }
    defs[name] = def
  }
  const out: Record<string, unknown> = { __cms: 'roles' }
  for (const k of CMS_ROLES) out[k] = Object.freeze({ __cms: 'role', name: k })
  for (const k of Object.keys(defs)) out[k] = Object.freeze({ __cms: 'role', name: k })
  Object.defineProperty(out, DEFS, { value: { __cms: 'roles', roles: defs } satisfies CmsRolesDef, enumerable: false })
  return Object.freeze(out) as unknown as CmsRoles<R>
}

/** The definitions of a `defineRoles` result (or of a config module that exports one), or null. */
export function rolesDefOf(v: unknown): CmsRolesDef | null {
  const found = v && typeof v === 'object' && (v as any).__cms === 'roles' ? v : null
  return (found && (found as any)[DEFS]) ?? null
}

export function isRolesExport(v: unknown): boolean {
  return !!v && typeof v === 'object' && (v as any).__cms === 'roles'
}

/** Every role name a site has: the built-ins, then its own. */
export function allRoleNames(roles: CmsRolesDef | null): string[] {
  return [...CMS_ROLES, ...Object.keys(roles?.roles ?? {})]
}

// ── what a role means at run time ────────────────────────────────────────────────

/** A role with its defaults filled in. */
export interface CmsResolvedRole {
  name: string
  /** The built-in it is (or extends). `admin` only for the built-in admin. */
  base: CmsRole
  custom: boolean
  label?: LocalizedText
  description?: LocalizedText
  /** Operations per collection, for the collections the role lists. */
  entities: ReadonlyMap<string, ReadonlySet<CmsEntityOp>>
  publish: boolean
  media: CmsMediaAccess
  /** Manages people, the audit log and privacy: only `admin`. */
  manage: boolean
  /** A role name an external sign-in sent that this site does not define (see `resolveRole`): treated as before roles existed. */
  legacy?: boolean
}

const NO_ENTITIES: ReadonlyMap<string, ReadonlySet<CmsEntityOp>> = new Map()

const BUILT_IN: Record<CmsRole, CmsResolvedRole> = {
  admin: { name: 'admin', base: 'admin', custom: false, entities: NO_ENTITIES, publish: true, media: 'all', manage: true },
  editor: { name: 'editor', base: 'editor', custom: false, entities: NO_ENTITIES, publish: true, media: 'all', manage: false },
  author: { name: 'author', base: 'author', custom: false, entities: NO_ENTITIES, publish: false, media: 'own', manage: false },
}

const cache = new WeakMap<CmsRolesDef, Map<string, CmsResolvedRole>>()

/**
 * The role a stored name means, or null when the site does not know it (the account then
 * has no access: a role removed from the config fails closed). With `legacyUnknown` — an
 * external sign-in on a site that defines no roles — an unknown name is what it always was:
 * every collection allowed and the entities' own `access` rules decide.
 */
export function resolveRole(roles: CmsRolesDef | null, name: unknown, opts: { legacyUnknown?: boolean } = {}): CmsResolvedRole | null {
  if (typeof name !== 'string') return null
  if ((CMS_ROLES as readonly string[]).includes(name)) return BUILT_IN[name as CmsRole]
  const def = roles && Object.hasOwn(roles.roles, name) ? roles.roles[name] : undefined
  if (!def || !roles) {
    return opts.legacyUnknown && !roles ? { ...BUILT_IN.editor, name, legacy: true } : null
  }
  let byName = cache.get(roles)
  if (!byName) cache.set(roles, byName = new Map())
  const hit = byName.get(name)
  if (hit) return hit
  const base = BUILT_IN[def.from]
  const resolved: CmsResolvedRole = {
    name, base: def.from, custom: true, label: def.label, description: def.description,
    entities: new Map(Object.entries(def.entities ?? {}).map(([k, ops]) => [k, new Set(ops)])),
    publish: def.publish ?? base.publish,
    media: def.media ?? base.media,
    manage: false,
  }
  byName.set(name, resolved)
  return resolved
}

/** Is this role named in a rule (admin always passes)? */
function listed(role: CmsResolvedRole, names: readonly string[] | undefined): boolean {
  return role.name === 'admin' || !names || names.includes(role.name)
}

/** May the role read a field with this rule? */
export function fieldReadable(role: CmsResolvedRole | null, rule: CmsFieldRule | undefined): boolean {
  if (!role) return false
  return !rule || listed(role, rule.read)
}

/** May the role edit a field with this rule (it must be able to read it)? Whether it may write the entry at all is the entity's rule. */
export function fieldEditable(role: CmsResolvedRole | null, rule: CmsFieldRule | undefined): boolean {
  if (!role) return false
  return !rule || (listed(role, rule.read) && listed(role, rule.edit))
}

/** Turn `.access()`'s input into the stored rule (role names), checking its shape. */
export function normalizeFieldAccess(access: CmsFieldAccess): CmsFieldRule {
  if (!access || typeof access !== 'object' || Array.isArray(access)) throw new Error('`.access()` takes { read?: [roles], edit?: [roles] }.')
  const rule: CmsFieldRule = {}
  for (const key of ['read', 'edit'] as const) {
    const list = access[key]
    if (list === undefined) continue
    if (!Array.isArray(list)) throw new Error(`\`.access({ ${key} })\` takes a list of roles, e.g. ['editor', roles.translator].`)
    rule[key] = [...new Set(list.map((r) => {
      if (typeof r === 'string') return r
      if (isRef(r)) return r.name
      throw new Error(`\`.access({ ${key} })\` lists ${JSON.stringify(r)}, which is not a role: name built-in roles as strings ('editor') and your own as \`roles.name\`.`)
    }))]
  }
  for (const k of Object.keys(access)) if (k !== 'read' && k !== 'edit') throw new Error(`\`.access()\` knows read and edit, not "${k}".`)
  if (!rule.read && !rule.edit) throw new Error('`.access()` needs `read`, `edit` or both.')
  return rule
}

/**
 * The checks that need the entities (so they run when the registry is built): collection
 * names a role lists, operations a global cannot have, role names in field rules, a rule that
 * lets a role edit what it may not read, and fields the admin needs everyone to read.
 */
export function checkRoles(
  roles: CmsRolesDef | null,
  entities: { name: string; singleton?: boolean; titleField: string; fields: Record<string, { meta?: Record<string, any> }>; tree?: { parent: string; order: string }; content?: { slug?: string; path?: unknown }; publish?: { field: string; dateField?: string }; admin?: { list?: { orderField?: string } } }[],
  pathKeys: (e: any) => string[],
): void {
  const known = allRoleNames(roles)
  const byName = new Map(entities.map((e) => [e.name, e]))
  for (const [role, def] of Object.entries(roles?.roles ?? {})) {
    for (const [entity, ops] of Object.entries(def.entities ?? {})) {
      const e = byName.get(entity)
      if (!e) {
        const near = [...byName.keys()].filter((n) => n.toLowerCase() === entity.toLowerCase())
        throw new Error(`The role "${role}" lists "${entity}", which is not a collection or global of this site${near.length ? ` (did you mean "${near[0]}"?)` : ` (they are: ${[...byName.keys()].join(', ') || 'none'})`}.`)
      }
      if (e.singleton && ops.some((o) => o === 'create' || o === 'delete')) {
        throw new Error(`The role "${role}" lists "${entity}" with ${ops.join(', ')}, but "${entity}" is a global: it has read and update only.`)
      }
    }
  }
  for (const e of entities) {
    // What every screen of the admin shows about an entry: its title, state, date, address and place.
    const needed = new Map<string, string>([[e.titleField, 'its title']])
    if (e.publish) { needed.set(e.publish.field, 'its publish state'); if (e.publish.dateField) needed.set(e.publish.dateField, 'its publish date') }
    if (e.tree) { needed.set(e.tree.parent, 'its place in the tree'); needed.set(e.tree.order, 'its position in the tree') }
    if (e.content?.slug) needed.set(e.content.slug, 'its address')
    if (e.content?.path) for (const k of pathKeys(e)) needed.set(k, 'its address')
    if (e.admin?.list?.orderField) needed.set(e.admin.list.orderField, 'its position in the list')
    for (const [key, fld] of Object.entries(e.fields)) {
      const rule = fld.meta?.access as CmsFieldRule | undefined
      if (!rule) continue
      for (const k of ['read', 'edit'] as const) {
        for (const r of rule[k] ?? []) {
          if (!known.includes(r)) throw new Error(`${e.name}.${key}: access.${k} names the role "${r}", which this site does not have (roles: ${known.join(', ')}).`)
        }
      }
      if (rule.read && rule.edit) {
        const stray = rule.edit.filter((r) => r !== 'admin' && !rule.read!.includes(r))
        if (stray.length) throw new Error(`${e.name}.${key}: ${stray.join(', ')} may edit the field but not read it. A role that edits a field reads it: add it to access.read, or leave read out.`)
      }
      if (rule.read && needed.has(key)) {
        throw new Error(`${e.name}.${key} is ${needed.get(key)}, which the admin shows to everyone who sees the entry: it cannot be hidden with access.read. Restrict access.edit instead.`)
      }
    }
  }
}
