import { sql } from 'drizzle-orm'
import { dayStart } from '../rollup'
import { analyticsEvents } from '../tables'
import { planOf, rawWhere, type Window } from './queries'

/**
 * The extra reports of `mode: 'consent'`, among the visitors who allowed statistics in the
 * cookie banner: their views carry the consent id of their cookie, which lasts for months, so
 * they can be followed from one day to the next. Everyone else stays counted by the day's hash
 * only, which is what the headline numbers count in every mode.
 *
 * Raw views only (the last `keepRawDays`): the daily totals keep no consent ids. Filters apply.
 */

const e = analyticsEvents

export interface ConsentReport {
  /** The days the report covers: the raw part of the period (null when none of it has raw views). */
  from: string | null
  to: string | null
  /** The period reaches back to days with totals only, which these reports cannot cover. */
  partial: boolean
  /** Every visit of those days, and the ones of visitors who allowed statistics. */
  visits: number
  consentVisits: number
  /** consentVisits / visits (0–1). */
  share: number
  /** Distinct visitors over the whole period, not added up per day. */
  visitors: number
  /** First seen in this period, or seen before it (as far back as raw views go). */
  newVisitors: number
  returningVisitors: number
  /** Visitors by how many visits they made in the period. */
  frequency: { key: '1' | '2' | '3-5' | '6+'; visitors: number }[]
  /** Visits per visitor in the period. */
  visitsPerVisitor: number
}

export async function consentReportOf(db: any, w: Window): Promise<ConsentReport> {
  const plan = planOf(w)
  const empty: ConsentReport = {
    from: null, to: null, partial: !!plan.rolled || plan.partial, visits: 0, consentVisits: 0, share: 0, visitors: 0,
    newVisitors: 0, returningVisitors: 0, frequency: [{ key: '1', visitors: 0 }, { key: '2', visitors: 0 }, { key: '3-5', visitors: 0 }, { key: '6+', visitors: 0 }], visitsPerVisitor: 0,
  }
  if (!plan.raw) return empty
  const where = rawWhere(plan.raw, w)
  const start = dayStart(plan.raw.from, w.tz)
  const [all]: any[] = await db.select({
    visits: sql<number>`count(distinct ${e.session})::int`,
    consentVisits: sql<number>`count(distinct ${e.session}) filter (where ${e.consentId} is not null)::int`,
  }).from(e).where(where)
  const res: any = await db.execute(sql`with ids as (
      select ${e.consentId} as id, count(distinct ${e.session})::int as visits from ${e} where ${where} and ${e.consentId} is not null group by 1
    ), seen as (
      select ${e.consentId} as id, min(${e.at}) as first_at from ${e} where ${e.consentId} in (select id from ids) group by 1
    )
    select count(*)::int as visitors,
      count(*) filter (where seen.first_at >= ${start})::int as new_visitors,
      count(*) filter (where seen.first_at < ${start})::int as returning_visitors,
      count(*) filter (where ids.visits = 1)::int as f1,
      count(*) filter (where ids.visits = 2)::int as f2,
      count(*) filter (where ids.visits between 3 and 5)::int as f3,
      count(*) filter (where ids.visits >= 6)::int as f6,
      coalesce(sum(ids.visits), 0)::int as visits
    from ids join seen on seen.id = ids.id`)
  const r = res?.rows?.[0] ?? {}
  const visits = Number(all?.visits ?? 0)
  const consentVisits = Number(all?.consentVisits ?? 0)
  const visitors = Number(r.visitors ?? 0)
  return {
    ...empty,
    from: plan.raw.from,
    to: plan.raw.to,
    visits,
    consentVisits,
    share: visits ? consentVisits / visits : 0,
    visitors,
    newVisitors: Number(r.new_visitors ?? 0),
    returningVisitors: Number(r.returning_visitors ?? 0),
    frequency: [
      { key: '1', visitors: Number(r.f1 ?? 0) },
      { key: '2', visitors: Number(r.f2 ?? 0) },
      { key: '3-5', visitors: Number(r.f3 ?? 0) },
      { key: '6+', visitors: Number(r.f6 ?? 0) },
    ],
    visitsPerVisitor: visitors ? Number(r.visits ?? 0) / visitors : 0,
  }
}
