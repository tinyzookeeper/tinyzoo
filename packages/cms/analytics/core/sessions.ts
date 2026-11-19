/**
 * Visits (sessions): the page views of one visitor (the day's hash) with gaps under 30 minutes.
 * A visit is attributed to where it started: its source and campaign are the first view's, and
 * every later view of the visit carries them too, so a filter on a source keeps whole visits.
 */

export const SESSION_GAP_MS = 30 * 60_000

/** What a visit's latest view tells the next one (from the database, or from earlier in a batch). */
export interface SessionTail {
  session: string
  at: number
  referrerHost: string | null
  source: string
  utmSource: string | null
  utmMedium: string | null
  utmCampaign: string | null
}

/** A page view on its way into the table: what it said itself, before it joins a visit. */
export interface ViewDraft {
  visitor: string
  at: number
  referrerHost: string | null
  source: string
  /** The referrer was the site itself. */
  internal: boolean
  utmSource: string | null
  utmMedium: string | null
  utmCampaign: string | null
}

export interface SessionAssignment {
  session: string
  isEntry: boolean
  referrerHost: string | null
  source: string
  utmSource: string | null
  utmMedium: string | null
  utmCampaign: string | null
}

/**
 * Put each view into a visit. `tails` holds each visitor's latest view before these (and is
 * updated, so the next batch continues from here). Views are taken in time order.
 *
 * A view continues the visit when it comes less than 30 minutes after the visitor's previous
 * one, even with another referrer (a second tab from the same search): the visit keeps the
 * source it started with. A new visit starts with the view's own source; one that started
 * from the site's own page (the previous visit ended long ago) counts as Direct.
 */
export function assignSessions<T extends ViewDraft>(views: T[], tails: Map<string, SessionTail>, newId: () => string): (T & SessionAssignment)[] {
  const ordered = views.map((v, i) => ({ v, i })).sort((a, b) => a.v.at - b.v.at || a.i - b.i)
  const out: (T & SessionAssignment)[] = new Array(views.length)
  for (const { v, i } of ordered) {
    const tail = tails.get(v.visitor)
    let next: SessionTail
    let isEntry: boolean
    if (tail && v.at - tail.at < SESSION_GAP_MS && v.at >= tail.at - SESSION_GAP_MS) {
      next = { ...tail, at: Math.max(tail.at, v.at) }
      isEntry = false
    }
    else {
      next = {
        session: newId(),
        at: v.at,
        referrerHost: v.internal ? null : v.referrerHost,
        source: v.internal ? 'Direct' : v.source,
        utmSource: v.utmSource,
        utmMedium: v.utmMedium,
        utmCampaign: v.utmCampaign,
      }
      isEntry = true
    }
    tails.set(v.visitor, next)
    out[i] = {
      ...v,
      session: next.session,
      isEntry,
      referrerHost: next.referrerHost,
      source: next.source,
      utmSource: next.utmSource,
      utmMedium: next.utmMedium,
      utmCampaign: next.utmCampaign,
    }
  }
  return out
}
