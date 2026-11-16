import { and, eq, indexTree, inArray, pathTemplateKeys, sitePath } from 'tinyzoo'
import type { CmsEntity, CmsRegistry } from 'tinyzoo'
import { loadTreeNodes, treePathIn } from './cmsTreeAddress'

// Explicit imports only (no Nitro auto-imports): `tinyzoo links:convert` uses this too.

/** Can a link point at an entry of this collection? It is public and has an address on the website. */
export const isLinkable = (e: CmsEntity | undefined): e is CmsEntity => !!e && !e.singleton && !!e.content?.public && !!e.content?.path

/** The columns an entry's address is built from (`/blog/:slug` → slug). */
export const addressKeys = (e: CmsEntity): string[] => pathTemplateKeys(e.content?.path).filter((k) => (e.table as any)[k])

const filled = (v: unknown) => v !== null && v !== undefined && v !== ''

/**
 * The website address of entries of `e` in `locale`: what the picker offers and what a
 * stored link resolves to. `rows` hold `id` and the address columns. As everywhere on the
 * website, a translated part (a slug) comes from the translation and an untranslated
 * one falls back to the default language; a language the collection has no address for
 * (`content.path` per language) links to the default language's page.
 */
export async function entryAddresses(db: any, reg: CmsRegistry, e: CmsEntity, rows: Record<string, any>[], locale: string | null): Promise<Map<string, string | null>> {
  const out = new Map<string, string | null>()
  if (!rows.length || !e.content?.path) return out
  // A page tree: the address is the ancestors' parts plus its own (/o-nas/tym), per language.
  if (e.tree) {
    const index = indexTree(await loadTreeNodes(db, reg, e))
    for (const row of rows) out.set(row.id, index.has(row.id) ? treePathIn(reg, e, index, row.id, locale) : null)
    return out
  }
  const keys = addressKeys(e)
  const def = reg.locales?.default ?? null
  const translated = new Map<string, Record<string, any>>()
  const t = e.localesTable
  if (locale && def && locale !== def && t && keys.some((k) => e.localized.includes(k))) {
    const cols: Record<string, any> = { parentId: t.parentId }
    for (const k of keys) if (e.localized.includes(k) && t[k]) cols[k] = t[k]
    const trs: any[] = await db.select(cols).from(t).where(and(inArray(t.parentId, rows.map((r) => r.id)), eq(t.locale, locale)))
    for (const r of trs) translated.set(r.parentId, r)
  }
  for (const row of rows) {
    const merged = { ...row }
    const tr = translated.get(row.id)
    if (tr) for (const k of keys) if (e.localized.includes(k) && filled(tr[k])) merged[k] = tr[k]
    let path = sitePath(reg.locales, e.content.path, locale, merged)
    if (path === null && def && locale !== def) path = sitePath(reg.locales, e.content.path, def, row)
    out.set(row.id, path)
  }
  return out
}
