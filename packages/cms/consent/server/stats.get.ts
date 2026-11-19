import { and, gte, sql } from 'drizzle-orm'
import { consentLog } from '../tables'
import { currentConsentVersion, requireConsentReader } from './state'

// GET /api/cms/_p/consent/stats?period=12w — how visitors choose, in counts only: choices that
// allowed everything, nothing or some, per week (12w) or month (12m), how often each category
// was allowed, and how many choices took something back. Never a single record.
const PERIODS = { '12w': { unit: 'week', count: 12 }, '12m': { unit: 'month', count: 12 } } as const

export default defineEventHandler(async (event) => {
  const { opts } = requireConsentReader(event)
  const { db } = useCms()
  const q = getQuery(event)
  const period = q.period === '12m' ? '12m' : '12w'
  const { unit, count } = PERIODS[period]
  const tz = String((useAppConfig() as any)?.cms?.admin?.timeZone || 'Europe/Prague')
  const l = consentLog
  const local = sql`(${l.at} at time zone ${tz})`
  const now = sql`(now() at time zone ${tz})`
  // The first bucket: the start of this week (month), less count - 1 of them, in the site's time.
  const back = `${count - 1} ${unit}s`
  const step = `1 ${unit}`
  const from = sql`(date_trunc(${unit}, ${now}) - ${back}::interval) at time zone ${tz}`
  // Everything allowed: no "false" in the choice; nothing: no "true".
  const all = sql`not jsonb_path_exists(${l.choice}, '$.* ? (@ == false)')`
  const none = sql`not jsonb_path_exists(${l.choice}, '$.* ? (@ == true)')`
  const rows: any[] = await db.select({
    key: sql<string>`date_trunc(${unit}, ${local})::date::text`,
    all: sql<number>`count(*) filter (where ${all})::int`,
    none: sql<number>`count(*) filter (where ${none} and not ${all})::int`,
    total: sql<number>`count(*)::int`,
    withdrawn: sql<number>`count(*) filter (where ${l.action} = 'withdrawn')::int`,
  }).from(l).where(and(gte(l.at, from))).groupBy(sql`1`).orderBy(sql`1`)

  const categories: any[] = opts.keys.length
    ? await db.select(Object.fromEntries(opts.keys.map((k) => [k, sql<number>`count(*) filter (where (${l.choice}->>${k})::boolean)::int`]))).from(l).where(gte(l.at, from))
    : [{}]
  const [{ keys: buckets }]: any[] = (await db.execute(sql`select array(select to_char(d, 'YYYY-MM-DD') from generate_series(date_trunc(${unit}, ${now} - ${back}::interval), date_trunc(${unit}, ${now}), ${step}::interval) d) as keys`) as any).rows
  const byKey = new Map(rows.map((r) => [String(r.key), r]))
  const series = (buckets as string[]).map((key) => {
    const r = byKey.get(key)
    const total = Number(r?.total ?? 0)
    const a = Number(r?.all ?? 0)
    const n = Number(r?.none ?? 0)
    return { key, all: a, none: n, custom: total - a - n, total, withdrawn: Number(r?.withdrawn ?? 0) }
  })
  const sum = (k: 'all' | 'none' | 'custom' | 'total' | 'withdrawn') => series.reduce((s, p) => s + p[k], 0)
  return {
    period,
    unit,
    version: await currentConsentVersion(),
    keepLogDays: opts.keepLogDays,
    totals: { all: sum('all'), none: sum('none'), custom: sum('custom'), total: sum('total'), withdrawn: sum('withdrawn') },
    series,
    // A category of the site's own comes with its name (the built-in ones have theirs in the admin's texts).
    categories: opts.categories.map((c) => {
      const key = typeof c === 'string' ? c : c.key
      return { key, label: typeof c === 'string' ? null : c.label, granted: Number(categories[0]?.[key] ?? 0) }
    }),
  }
})
