import { and, eq, gt, inArray, isNull, lte, or, propOf, sql } from 'tinyzoo'
import { cmsSweepDue } from './cmsBackground'

const LOCK = 72_011_004
const KEY = 'scheduler.lastRun'

/**
 * Multi-tenant mode only: what this instance knows about when the site next has something to
 * announce, so a quiet site's database is not opened every minute.
 * `nextAt`: undefined = unknown (look), null = nothing is scheduled, a time = the earliest one.
 * `generation` counts the changes that could move it: a look that began before one must not
 * store what it found (the change may have committed after the look's query).
 */
const schedule = cmsSiteScoped(() => ({ nextAt: undefined as number | null | undefined, lookedAt: 0, generation: 0 }))

/** A change in the current site may have moved what is due (any write that is reported, here or on another instance): look again next tick. */
export function forgetScheduledWork(): void {
  if (!cmsIsMultiTenant()) return
  const memory = schedule()
  memory.generation++
  memory.nextAt = undefined
}

/**
 * Is there a reason to run the scheduler in the current site now (multi-tenant mode)? Yes when
 * nothing is known, when the remembered time has come, or when the site's turn in the slow
 * rotation has come (another instance that knew about something due may have restarted).
 */
export function scheduledWorkMayBeDue(): boolean {
  const memory = schedule()
  if (memory.nextAt === undefined) return true
  if (memory.nextAt !== null && Date.now() >= memory.nextAt) return true
  return cmsSweepDue(useCmsSite().id, memory.lookedAt)
}

/**
 * How long until the earliest entry (or translation) that is scheduled and not announced yet
 * goes live, measured by the database's clock; null when nothing is. One query for all entities.
 * The conditions are the ones the run above announces by, for a date after now.
 */
async function nextDueInMs(tx: any, reg: any): Promise<number | null> {
  const parts: any[] = []
  for (const e of reg.entities) {
    const p = e.publish
    if (!p?.dateField || p.schedule === false) continue
    const date = e.table[propOf(p.dateField, e.fields[p.dateField]!)]
    const status = e.table[propOf(p.field, e.fields[p.field]!)]
    parts.push(sql`(select min(${date}) from ${e.table} where ${and(eq(status, p.publishedValue), sql`${date} > now()`, sql`${date} > ${e.table.updatedAt}`)})`)
    const lt = e.localesTable
    if (p.perLocale && lt) {
      parts.push(sql`(select min(${lt.publishedAt}) from ${lt} where ${and(eq(lt.published, true), sql`${lt.publishedAt} > now()`, sql`${lt.publishedAt} > ${lt.updatedAt}`)})`)
    }
  }
  if (!parts.length) return null
  const res = await tx.execute(sql`select extract(epoch from (least(${sql.join(parts, sql`, `)}) - now())) * 1000 as wait_ms`)
  const wait = (res.rows ?? res)[0]?.wait_ms
  return wait === null || wait === undefined ? null : Math.max(0, Number(wait))
}

/**
 * Report every scheduled entry (or, with per-language publishing, translation) whose publish
 * date passed since the last run — a translation only once the default language is live too
 * (it gates every language). One
 * replica at a time (a Postgres advisory lock); the last run is kept in cms_state,
 * so a restart or a missed minute catches up instead of skipping. The very first
 * run starts from now.
 */
export async function announceScheduled(opts: { remember?: boolean } = {}): Promise<number> {
  // `remember` (multi-tenant mode): also find out when the next one is due, in the same run, and keep it.
  const memory = opts.remember ? schedule() : null
  const generation = memory?.generation
  try {
    return await announce(memory, generation)
  }
  catch (err) {
    // Not knowing is looking again next time.
    if (memory) memory.nextAt = undefined
    throw err
  }
}

async function announce(memory: ReturnType<typeof schedule> | null, generation: number | undefined): Promise<number> {
  const { db, reg } = useCms()
  const due: { e: any; id: string; row: any; locale?: string }[] = []
  let nextIn: number | null = null
  let queriedAt = 0
  const ran = await db.transaction(async (tx: any) => {
    const [{ locked }] = (await tx.execute(sql`select pg_try_advisory_xact_lock(${LOCK}) as locked`)).rows
    if (!locked) return false
    const s = reg.cmsState
    const [state] = await tx.select().from(s).where(eq(s.key, KEY))
    const [{ now }] = (await tx.execute(sql`select now() as now`)).rows
    // The very first run looks back ten minutes (an entry going live during a deploy).
    const since = state?.value?.at ? new Date(state.value.at) : new Date(new Date(now).getTime() - 10 * 60_000)
    for (const e of reg.entities) {
      const p = e.publish
      if (!p?.dateField || p.schedule === false) continue
      const date = e.table[propOf(p.dateField, e.fields[p.dateField]!)]
      const status = e.table[propOf(p.field, e.fields[p.field]!)]
      // Only entries saved before their date (scheduled): "publish now" was announced
      // when it was saved — the server stamps that date itself (stampPublishDate),
      // so it never lies after the save. At worst a borderline case is announced twice.
      const rows: any[] = await tx.select().from(e.table)
        .where(and(eq(status, p.publishedValue), gt(date, since), lte(date, new Date(now)), sql`${date} > ${e.table.updatedAt}`))
      for (const row of rows) due.push({ e, id: row.id, row })
      // Publishing per language: a translation with its own date and state goes live on its own. The
      // default language gates: it is live (and announced) only while the entry itself is, so a
      // translation whose date passed while the default language was not live yet waits, and goes
      // live with it, at the later of the two dates.
      const lt = e.localesTable
      if (p.perLocale && lt) {
        const candidates = new Map<string, { parentId: string; locale: string; updatedAt: Date }>()
        const own: any[] = await tx.select({ parentId: lt.parentId, locale: lt.locale, updatedAt: lt.updatedAt }).from(lt)
          .where(and(eq(lt.published, true), gt(lt.publishedAt, since), lte(lt.publishedAt, new Date(now)), sql`${lt.publishedAt} > ${lt.updatedAt}`))
        for (const tr of own) candidates.set(tr.parentId + '#' + tr.locale, tr)
        // The default language going live now takes along the languages that were only waiting for it.
        if (rows.length) {
          const waiting: any[] = await tx.select({ parentId: lt.parentId, locale: lt.locale, updatedAt: lt.updatedAt }).from(lt)
            .where(and(inArray(lt.parentId, rows.map((r) => r.id)), eq(lt.published, true), or(isNull(lt.publishedAt), lte(lt.publishedAt, new Date(now)))))
          for (const tr of waiting) candidates.set(tr.parentId + '#' + tr.locale, tr)
        }
        if (candidates.size) {
          const parents = [...new Set([...candidates.values()].map((c) => c.parentId))]
          const live = new Set((await tx.select({ id: e.table.id }).from(e.table).where(and(inArray(e.table.id, parents), ownPublishedCond(e)))).map((r: any) => r.id))
          for (const tr of candidates.values()) if (live.has(tr.parentId)) due.push({ e, id: tr.parentId, row: { updatedAt: tr.updatedAt }, locale: tr.locale })
        }
      }
    }
    if (memory) {
      nextIn = await nextDueInMs(tx, reg)
      queriedAt = Date.now()
    }
    await tx.insert(s).values({ key: KEY, value: { at: new Date(now).toISOString() } })
      .onConflictDoUpdate({ target: s.key, set: { value: { at: new Date(now).toISOString() }, updatedAt: sql`now()` } })
    return true
  })
  if (memory) memory.lookedAt = Date.now()
  // Another instance holds the lock: it is doing this run, and nothing is learnt here.
  if (!ran) return 0
  if (due.length) console.info(`[cms] scheduled: ${due.length} entries went live`)
  for (const { e, id, row, locale } of due) {
    await reportChange(null, { type: 'entry.published', entity: e, id, locale, before: { live: false, paths: [] }, after: row, noRevision: true })
  }
  // Remembered only if nothing was reported meanwhile (announcing is reported too: the next tick looks once more, and finds nothing due).
  if (memory && memory.generation === generation) memory.nextAt = nextIn === null ? null : queriedAt + nextIn
  return due.length
}
