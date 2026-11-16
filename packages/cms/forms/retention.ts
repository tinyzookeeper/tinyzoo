import { and, eq, inArray, lt, sql } from 'drizzle-orm'
import type { CmsEntity, CmsRegistry } from '../src/entity'
import type { CmsRetentionContext } from '../src/plugin'

/**
 * Retention (GDPR) for form submissions: each form's `retentionDays` (`defineForm`);
 * none = kept. The daily retention task (`cms:retention`) calls `retainForms` through
 * the plugin's `retention` hook, inside its transaction and lock.
 */

/** The collections that are website forms. */
export const formEntities = (reg: CmsRegistry): CmsEntity[] => reg.entities.filter((e) => (e as any).preset === 'form')

/**
 * Delete entries of a form together with everything else that holds their text: the
 * saved versions (history), the shared-editing document and the search index rows.
 * Returns how many entries went. Run it in a transaction. (The Privacy screen's
 * erasure uses it too.)
 */
export async function purgeSubmissions(tx: any, reg: CmsRegistry, e: CmsEntity, ids: string[]): Promise<number> {
  if (!ids.length) return 0
  const deleted: any[] = await tx.delete(e.table).where(inArray(e.table.id, ids)).returning({ id: e.table.id })
  const gone = deleted.map((r) => r.id as string)
  if (gone.length) {
    await tx.delete(reg.cmsRevisions).where(and(eq(reg.cmsRevisions.entity, e.name), inArray(reg.cmsRevisions.recordId, gone)))
    await tx.delete(reg.cmsSearch).where(and(eq(reg.cmsSearch.entity, e.name), inArray(reg.cmsSearch.recordId, gone)))
    await tx.delete(reg.cmsCollab).where(inArray(reg.cmsCollab.name, gone.map((id) => `${e.name}/${id}`)))
  }
  return gone.length
}

/** Delete the submissions that are past their form's retention; returns the count per form. */
export async function retainForms({ tx, reg, batch }: CmsRetentionContext): Promise<Record<string, number>> {
  const counts: Record<string, number> = {}
  for (const e of formEntities(reg)) {
    const days = Number((e as any).form?.retentionDays)
    if (!(days >= 1)) continue
    const cutoff = sql`now() - make_interval(days => ${Math.floor(days)})`
    let n = 0
    for (;;) {
      const old: any[] = await tx.select({ id: e.table.id }).from(e.table).where(lt(e.table.createdAt, cutoff)).limit(batch)
      n += await purgeSubmissions(tx, reg, e, old.map((r) => r.id))
      if (old.length < batch) break
    }
    if (n) counts[e.name] = n
  }
  return counts
}
