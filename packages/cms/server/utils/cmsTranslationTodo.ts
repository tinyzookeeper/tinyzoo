import { and, desc, propOf, sql } from 'tinyzoo'
import type { CmsEntity, CmsRegistry } from 'tinyzoo'
import type { CmsUser } from './cmsSession'
import { languageStateCond, translatedCond, workStateSql } from './cmsTranslationWork'

/**
 * "Needs translating" for this person: entries live or scheduled in the default language whose
 * translation into `locale` is missing, being translated or a draft of its own (`todo`), narrowed to
 * what the person may update in that language: the role and the entity's own `update` rule (an
 * author's own entries), a translated field they may edit, and, for someone who may not publish,
 * a language that is not live (`notLiveInLanguage`, as the translation write judges it). The home
 * page lists exactly this, and its "Show all" opens the list filtered by it, so the two agree.
 * `keys`: the translated fields the person may read (what counts as translated for them).
 */
export function translationTodoCond(e: CmsEntity, user: CmsUser, locale: string, keys: readonly string[]): any {
  const update = accessWhere(e, 'update', user)
  if (!update.allowed) return sql`false`
  const locked = uneditableFields(e, user)
  if (!e.localized.some((k) => !locked.has(k))) return sql`false`
  return and(languageStateCond(e, locale, 'todo', keys), update.where, notLiveInLanguage(e, user, locale))
}

/** One language of one entry that needs translating, as the home page lists it. */
export interface TranslationWorkItem {
  entity: string
  id: string
  /** The entry's title (in the default language). */
  title: string | null
  /** When the entry or this translation last changed (the later). */
  updatedAt: Date
  locale: string
  /** Where this language stands: nothing yet, being translated, or a draft of its own (taken off the website). */
  state: 'missing' | 'translating' | 'draft'
  /** Something is translated already: a person who may publish can review it and put it on the website. */
  review?: true
}

/**
 * What needs translating, for the home page: the newest `limit` (entry, language) pairs across the
 * collections with translated fields, and how many there are per collection and language (each one
 * is a filtered list: `filter.lang:<code>=todo`). Nothing on a site with one language, nor for
 * someone who may not update any translations. Globals are left out (they have no drafts: a
 * translation of one is on the website as soon as it is saved).
 */
export async function translationWork(db: any, reg: CmsRegistry, user: CmsUser, limit: number): Promise<{ items: TranslationWorkItem[]; total: number; groups: { entity: string; locale: string; count: number }[] }> {
  const items: TranslationWorkItem[] = []
  const groups: { entity: string; locale: string; count: number }[] = []
  const locales = reg.locales
  if (!locales || locales.locales.length < 2) return { items, total: 0, groups }
  const others = locales.locales.filter((l) => l !== locales.default)
  for (const e of reg.entities) {
    if (e.singleton || !e.localized?.length || !e.localesTable) continue
    const read = accessWhere(e, 'read', user)
    if (!read.allowed) continue
    const hidden = unreadableFields(e, user)
    const keys = e.localized.filter((k) => !hidden.has(k))
    // Publishing writes the status (and the date): a field rule on them takes publishing away too (as `can.publish` in the graph).
    const p = e.publish
    const locked = uneditableFields(e, user)
    const publishes = !!p && canPublish(user) && !locked.has(p.field) && !(p.dateField && locked.has(p.dateField))
    const lt = e.localesTable
    const titleCol = hidden.has(e.titleField) ? sql`null` : e.table[propOf(e.titleField, e.fields[e.titleField]!)]
    for (const locale of others) {
      const where = and(read.where, translationTodoCond(e, user, locale, keys))
      const [counted] = await db.select({ count: sql<number>`count(*)::int` }).from(e.table).where(where)
      const count = counted?.count ?? 0
      if (!count) continue
      groups.push({ entity: e.name, locale, count })
      // The subquery is a fragment of its own: Drizzle writes the columns at the top of a one-table select without
      // their table, and inside the subquery an unqualified "id" would be the translation's. Read back as a Date.
      const translationChanged = sql`(select ${lt.updatedAt} from ${lt} where ${lt.parentId} = ${e.table.id} and ${lt.locale} = ${locale})`
      const changed = sql<Date>`greatest(${e.table.updatedAt}, coalesce(${translationChanged}, ${e.table.updatedAt}))`.mapWith(e.table.updatedAt)
      const rows: any[] = await db.select({
        id: e.table.id,
        title: titleCol,
        changed,
        state: workStateSql(e, locale),
        translated: sql<boolean>`${translatedCond(e, locale, keys)}`,
      }).from(e.table).where(where).orderBy(desc(changed), desc(e.table.id)).limit(limit)
      for (const r of rows) {
        items.push({
          entity: e.name, id: r.id, title: r.title == null ? null : String(r.title), updatedAt: r.changed, locale, state: r.state,
          ...(publishes && r.translated && r.state !== 'missing' ? { review: true as const } : {}),
        })
      }
    }
  }
  items.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
  return { items: items.slice(0, limit), total: groups.reduce((n, g) => n + g.count, 0), groups }
}
