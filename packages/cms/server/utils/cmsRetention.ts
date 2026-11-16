import { and, eq, inArray, lt, sql } from 'tinyzoo'
import type { CmsEntity, CmsRegistry } from 'tinyzoo'

/**
 * Retention (GDPR): personal data is not kept forever.
 *
 *  - Form submissions: each form's `retentionDays` (defineForm); none = kept.
 *  - The audit log: `cms.retention.auditDays` (default 365; 0 = kept) — it holds who
 *    did what and, for failed sign-ins, the email and address tried.
 *
 * A daily task (`cms:retention`) deletes what is past its time, in batches, one
 * instance at a time (an advisory lock), and writes one audit entry with the counts
 * (never what was in the rows).
 */
const LOCK = 72_011_040
const BATCH = 500

/** The collections that are website forms. */
export const formEntities = (reg: CmsRegistry): CmsEntity[] => reg.entities.filter((e) => (e as any).preset === 'form')

/**
 * Delete entries of a form together with everything else that holds their text: the
 * saved versions (history), the shared-editing document and the search index rows.
 * Returns how many entries went. Run it in a transaction.
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

export interface RetentionResult { forms: Record<string, number>; audit: number }

/** Delete what is past its retention. Returns null when another instance holds the lock. */
export async function runRetention(): Promise<RetentionResult | null> {
  const { db, reg } = useCms()
  const auditDays = Math.max(0, Math.floor(Number((useRuntimeConfig().cms as any)?.retention?.auditDays ?? 365)) || 0)
  const result: RetentionResult = { forms: {}, audit: 0 }
  const ran = await db.transaction(async (tx: any) => {
    const [{ locked }] = (await tx.execute(sql`select pg_try_advisory_xact_lock(${LOCK}) as locked`)).rows
    if (!locked) return false
    for (const e of formEntities(reg)) {
      const days = Number((e as any).form?.retentionDays)
      if (!(days >= 1)) continue
      const cutoff = sql`now() - make_interval(days => ${Math.floor(days)})`
      let n = 0
      for (;;) {
        const old: any[] = await tx.select({ id: e.table.id }).from(e.table).where(lt(e.table.createdAt, cutoff)).limit(BATCH)
        const removed = await purgeSubmissions(tx, reg, e, old.map((r) => r.id))
        n += removed
        if (old.length < BATCH) break
      }
      if (n) result.forms[e.name] = n
    }
    if (auditDays >= 1) {
      const a = reg.cmsAudit
      for (;;) {
        const old: any[] = await tx.select({ id: a.id }).from(a).where(lt(a.createdAt, sql`now() - make_interval(days => ${auditDays})`)).limit(BATCH * 2)
        if (!old.length) break
        await tx.delete(a).where(inArray(a.id, old.map((r) => r.id)))
        result.audit += old.length
        if (old.length < BATCH * 2) break
      }
    }
    return true
  })
  if (!ran) return null
  const forms = Object.values(result.forms).reduce((a, b) => a + b, 0)
  if (forms || result.audit) {
    console.info(`[cms] retention: deleted ${forms} form submission(s) and ${result.audit} audit entr${result.audit === 1 ? 'y' : 'ies'}`)
    await audit(null, 'retention.purge', { meta: { forms: result.forms, audit: result.audit } })
  }
  return result
}
