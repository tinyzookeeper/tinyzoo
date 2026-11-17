// What a role does, in words. The Team page gets each role's reach from the server (`roleChoices`:
// what it may do with every collection and global, whether it publishes, its files); these helpers
// turn that into the lists and the one sentence the admin shows — the sentence stands in for a
// custom role's `description` when the developer wrote none.
type T = (key: string, params?: Record<string, any>) => string

export type CmsRoleOp = 'read' | 'create' | 'update' | 'delete'

/** A role as `/api/cms/_users` describes it. */
export interface CmsRoleChoice {
  name: string
  custom: boolean
  from: string
  label: unknown
  description: unknown
  publish?: boolean
  media?: 'all' | 'own' | 'none'
  manage?: boolean
  /** What the role may do with each area it can read (by the entity's name). */
  reach?: Record<string, { ops: CmsRoleOp[]; own: boolean }>
  /** The areas its definition names (`entities`): what the role is about, named first. */
  listed?: string[]
}

export interface CmsRoleReachSummary {
  /** Areas it may change (add, edit or delete in), in the order given. */
  edits: string[]
  /** Areas it may only read. */
  reads: string[]
  /** It may change every area. */
  editsAll: boolean
  /** It may read every area (and change none). */
  readsAll: boolean
  /** It changes only the entries it created (a role based on author). */
  own: boolean
}

/**
 * Group a role's reach over the site's areas (`areas`: entity names, in the admin's order). The areas the
 * role's definition names come first: a proofreader "Edits Posts, …", not "Edits Contact form, Events, …".
 */
export function cmsRoleReach(role: CmsRoleChoice, given: string[]): CmsRoleReachSummary {
  const reach = role.reach ?? {}
  const listed = new Set(role.listed ?? [])
  const areas = [...given.filter((a) => listed.has(a)), ...given.filter((a) => !listed.has(a))]
  const edits = areas.filter((a) => reach[a]?.ops.some((o) => o !== 'read'))
  const reads = areas.filter((a) => reach[a] && !edits.includes(a))
  return {
    edits,
    reads,
    editsAll: areas.length > 0 && edits.length === areas.length,
    readsAll: areas.length > 0 && !edits.length && reads.length === areas.length,
    own: Object.values(reach).some((r) => r.own),
  }
}

/** "Posts, Pages, Events and 3 more": a list in the admin's language, cut after `max` names. */
export function cmsNameList(names: string[], locale: string, t: T, max = 4): string {
  const shown = names.length > max ? [...names.slice(0, max - 1), t('roles.summary.more', { count: names.length - (max - 1) })] : names
  try {
    return new Intl.ListFormat(locale, { type: 'conjunction' }).format(shown)
  }
  catch {
    return shown.join(', ')
  }
}

/**
 * One sentence on what a role does, made from its definition: what it changes, what it only reads,
 * whether it publishes, its files. "Edits Posts and Pages. Only reads Authors and Tags. Cannot
 * publish: drafts only. Changes only their own files."
 */
export function cmsRoleSentence(role: CmsRoleChoice, areas: string[], opts: { t: T; locale: string; label: (area: string) => string; max?: number }): string {
  const { t, locale, label } = opts
  const r = cmsRoleReach(role, areas)
  const list = (names: string[]) => cmsNameList(names.map(label), locale, t, opts.max)
  const parts: string[] = []
  if (r.editsAll) parts.push(t('roles.summary.editsAll'))
  else if (r.edits.length) parts.push(t('roles.summary.edits', { list: list(r.edits) }))
  if (r.readsAll) parts.push(t('roles.summary.readsAll'))
  else if (r.reads.length) parts.push(t('roles.summary.reads', { list: list(r.reads) }))
  if (!r.edits.length && !r.reads.length) parts.push(t('roles.summary.nothing'))
  if (r.edits.length) {
    if (r.own) parts.push(t('roles.summary.own'))
    parts.push(role.publish ? t('roles.summary.publishes') : t('roles.summary.drafts'))
  }
  if (role.media) parts.push(t(`roles.summary.media.${role.media}`))
  if (role.manage) parts.push(t('roles.summary.manage'))
  return parts.join(' ')
}

/**
 * "Only Editor and Administrator can change this": the roles that may change a locked field, named.
 * `names` are the role labels in the admin's language, administrator last.
 */
export function cmsLockedSentence(names: string[], locale: string, t: T): string {
  let list = names.join(', ')
  try {
    list = new Intl.ListFormat(locale, { type: t('readOnly.listType') === 'disjunction' ? 'disjunction' : 'conjunction' }).format(names)
  }
  catch { /* the plain list */ }
  return t('readOnly.onlyRoles', { count: names.length, roles: list })
}
