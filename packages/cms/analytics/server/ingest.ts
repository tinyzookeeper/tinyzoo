import { and, eq, gt, inArray, sql } from 'drizzle-orm'
import { assignSessions, type SessionTail, type ViewDraft } from '../core/sessions'
import { newSessionId } from '../core/visitor'
import { analyticsEvents } from '../tables'
import { entryAt } from './context'

/**
 * Page views wait here a few seconds and are written together, so a visit never waits for the
 * database: the endpoint answers at once, and one insert carries a few seconds' views. The
 * time a page was looked at arrives later (when the visitor leaves it) and is added to its view.
 *
 * Per server, in memory, and per site: each site has its own buffer and timer, written into its
 * own database. A server that stops writes what is waiting (the Nitro plugin's `close`). One that
 * crashes loses its last few seconds of views.
 */

export interface PendingView extends ViewDraft {
  path: string
  locale: string | null
  view: string
  country: string | null
  device: string | null
  browser: string | null
  os: string | null
  language: string | null
  /** The visitor's consent id, when they allowed statistics (`mode: 'consent'`). */
  consentId?: string | null
  engagedMs: number
}

/** The most time one view can add: 30 minutes. */
export const MAX_ENGAGED_MS = 30 * 60_000
const MAX_WAITING = 5000
const INSERT_CHUNK = 500
const SESSION_LOOKBACK = sql`now() - interval '30 minutes'`

const flushMs = (): number => {
  const v = Number(process.env.CMS_TEST_ANALYTICS_FLUSH_MS)
  return Number.isFinite(v) && v > 0 ? v : 3000
}

interface Buffer {
  /** The site's id: a buffer released with its site's memory writes what waits inside that site. */
  site: string
  views: PendingView[]
  engaged: Map<string, { visitor: string; ms: number }>
  timer: ReturnType<typeof setTimeout> | null
  running: Promise<void> | null
}
const buffer = cmsSiteScoped<Buffer>(() => ({ site: useCmsSite().id, views: [], engaged: new Map(), timer: null, running: null }), {
  // A site that is unloaded because its directory row changed is still served: what waits is
  // written (into the site's database as the directory has it now), not thrown away with the
  // buffer. One that left the directory has no database here any more.
  dispose: async (b) => {
    if (b.timer) clearTimeout(b.timer)
    b.timer = null
    if (!b.views.length && !b.engaged.size) return
    const site = cmsSiteById(b.site)
    if (site) await runInCmsSite(site, () => write(b))
  },
})

function schedule() {
  const b = buffer()
  if (b.timer) return
  // The timer is started inside the site's request, so it fires inside the site.
  b.timer = setTimeout(() => { b.timer = null; void flushViews() }, flushMs())
  // A waiting flush never keeps a stopping process alive (the Nitro plugin flushes on close).
  ;(b.timer as any).unref?.()
}

export function queueView(v: PendingView): void {
  const { views } = buffer()
  if (views.length >= MAX_WAITING) return
  views.push(v)
  if (views.length >= INSERT_CHUNK) void flushViews()
  else schedule()
}

/** Time a visitor looked at a view (`view`, the tracker's id of it), added to what it had. */
export function queueEngagement(view: string, visitor: string, ms: number): void {
  const add = Math.min(Math.max(0, Math.round(ms)), MAX_ENGAGED_MS)
  if (!add) return
  // Still waiting to be written: add it there.
  const { views, engaged } = buffer()
  const waiting = views.find((v) => v.view === view && v.visitor === visitor)
  if (waiting) {
    waiting.engagedMs = Math.min(MAX_ENGAGED_MS, waiting.engagedMs + add)
    return
  }
  const had = engaged.get(view)
  if (!had && engaged.size >= MAX_WAITING) return
  engaged.set(view, { visitor, ms: Math.min(MAX_ENGAGED_MS, (had?.ms ?? 0) + add) })
  schedule()
}

/**
 * A visitor took statistics back (the consent plugin's `cms:consent`): their consent id goes from
 * every view, written or still waiting. The views stay, counted the cookieless way like everyone's.
 */
export async function forgetConsentId(consentId: string): Promise<number> {
  for (const v of buffer().views) if (v.consentId === consentId) v.consentId = null
  // A write under way may still carry it: let it finish, then clear what it wrote too.
  await flushViews()
  const { db } = useCms()
  const res: any = await db.update(analyticsEvents).set({ consentId: null }).where(eq(analyticsEvents.consentId, consentId))
  return Number(res?.rowCount ?? 0)
}

/** Write everything that waits (one flush at a time; one that is running is waited for, then the rest goes). */
export async function flushViews(): Promise<void> {
  // No current site (multi mode, the server stopping): every site writes its own.
  if (!currentCmsSite()) { await forEachCmsSite(() => flushViews(), { what: 'writing waiting visits' }); return }
  const b = buffer()
  while (b.running) await b.running
  if (!b.views.length && !b.engaged.size) return
  b.running = write(b).finally(() => { b.running = null })
  await b.running
}

async function write({ views, engaged }: Buffer): Promise<void> {
  const batch = views.splice(0, views.length)
  const times = [...engaged.entries()]
  engaged.clear()
  try {
    const { db } = useCms()
    if (batch.length) await insertViews(db, batch)
    if (times.length) await addEngagement(db, times)
  }
  catch (err) {
    console.error('[cms] analytics: could not save visits', scrubError(err))
  }
}

async function insertViews(db: any, batch: PendingView[]): Promise<void> {
  const e = analyticsEvents
  // Each visitor's latest view of the last 30 minutes: these views continue its visit.
  const visitors = [...new Set(batch.map((v) => v.visitor))]
  const tails = new Map<string, SessionTail>()
  for (let i = 0; i < visitors.length; i += INSERT_CHUNK) {
    const rows: any[] = await db.selectDistinctOn([e.visitor], {
      visitor: e.visitor, session: e.session, at: e.at, referrerHost: e.referrerHost, source: e.source,
      utmSource: e.utmSource, utmMedium: e.utmMedium, utmCampaign: e.utmCampaign,
    }).from(e).where(and(inArray(e.visitor, visitors.slice(i, i + INSERT_CHUNK)), gt(e.at, SESSION_LOOKBACK))).orderBy(e.visitor, sql`${e.at} desc`)
    for (const r of rows) tails.set(r.visitor, { ...r, at: new Date(r.at).getTime() })
  }
  const assigned = assignSessions(batch, tails, newSessionId)
  const rows = []
  for (const v of assigned) {
    const entry = await entryAt(v.path).catch(() => null)
    rows.push({
      at: new Date(v.at),
      path: v.path,
      entity: entry?.entity ?? null,
      entryId: entry?.id ?? null,
      // The language of the entry at this address, else what the page said it was.
      locale: entry?.locale ?? v.locale,
      visitor: v.visitor,
      session: v.session,
      view: v.view,
      isEntry: v.isEntry,
      referrerHost: v.referrerHost,
      source: v.source,
      utmSource: v.utmSource,
      utmMedium: v.utmMedium,
      utmCampaign: v.utmCampaign,
      country: v.country,
      device: v.device,
      browser: v.browser,
      os: v.os,
      language: v.language,
      consentId: v.consentId ?? null,
      engagedMs: v.engagedMs,
    })
  }
  for (let i = 0; i < rows.length; i += INSERT_CHUNK) await db.insert(e).values(rows.slice(i, i + INSERT_CHUNK))
}

async function addEngagement(db: any, times: [string, { visitor: string; ms: number }][]): Promise<void> {
  const e = analyticsEvents
  for (let i = 0; i < times.length; i += INSERT_CHUNK) {
    const values = sql.join(times.slice(i, i + INSERT_CHUNK).map(([view, t]) => sql`(${view}::text, ${t.visitor}::text, ${t.ms}::int)`), sql`, `)
    // Only a view of the last day, and only by the visitor who made it.
    await db.execute(sql`update ${e} set engaged_ms = least(${e.engagedMs} + v.ms, ${MAX_ENGAGED_MS})
      from (values ${values}) as v(view, visitor, ms)
      where ${e.view} = v.view and ${e.visitor} = v.visitor and ${e.at} > now() - interval '1 day'`)
  }
}
