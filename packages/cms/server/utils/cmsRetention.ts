import { inArray, lt, sql } from 'tinyzoo'

/**
 * Retention (GDPR): personal data is not kept forever.
 *
 *  - Plugin data: each plugin's `retention` hook (the forms plugin deletes submissions
 *    past their form's `retentionDays`; none = kept).
 *  - The audit log: `cms.retention.auditDays` (default 365; 0 = kept) — it holds who
 *    did what and, for failed sign-ins, the email and address tried.
 *  - Changes of sign-in address: one nobody confirmed, or a way back nobody took, is
 *    deleted once its link has expired (cms_state `email-change:*`, `email-revert:*`).
 *
 * A daily task (`cms:retention`) deletes what is past its time, in batches, one
 * instance at a time (an advisory lock), and writes one audit entry with the counts
 * (never what was in the rows).
 */
const LOCK = 72_011_040
const BATCH = 500

export interface RetentionResult {
  /** What the forms plugin deleted, per form (also in `plugins.forms`). */
  forms: Record<string, number>
  /** What each plugin's retention hook deleted, by plugin name. */
  plugins: Record<string, Record<string, number>>
  audit: number
}

/** Delete what is past its retention. Returns null when another instance holds the lock. */
export async function runRetention(): Promise<RetentionResult | null> {
  const { db, reg } = useCms()
  const auditDays = Math.max(0, Math.floor(Number((useRuntimeConfig().cms as any)?.retention?.auditDays ?? 365)) || 0)
  const result: RetentionResult = { forms: {}, plugins: {}, audit: 0 }
  const ran = await db.transaction(async (tx: any) => {
    const [{ locked }] = (await tx.execute(sql`select pg_try_advisory_xact_lock(${LOCK}) as locked`)).rows
    if (!locked) return false
    for (const p of reg.plugins) {
      if (!p.hooks?.retention) continue
      const counts = (await p.hooks.retention({ tx, reg, batch: BATCH })) || {}
      if (Object.values(counts).some((n) => n > 0)) result.plugins[p.name] = counts
    }
    result.forms = result.plugins.forms ?? {}
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
    // Changes of sign-in address nobody confirmed, and ways back nobody took, once expired.
    await sweepEmailStates(tx, reg)
    return true
  })
  if (!ran) return null
  const forms = Object.values(result.forms).reduce((a, b) => a + b, 0)
  const others = Object.entries(result.plugins).filter(([name]) => name !== 'forms')
  if (forms || others.length || result.audit) {
    const more = others.map(([name, counts]) => `, ${Object.values(counts).reduce((a, b) => a + b, 0)} item(s) of the ${name} plugin`).join('')
    console.info(`[cms] retention: deleted ${forms} form submission(s)${more} and ${result.audit} audit entr${result.audit === 1 ? 'y' : 'ies'}`)
    await audit(null, 'retention.purge', { meta: { forms: result.forms, audit: result.audit, ...(others.length ? { plugins: Object.fromEntries(others) } : {}) } })
  }
  return result
}
