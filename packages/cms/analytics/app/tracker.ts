// The analytics plugin's tracker, in the website's pages. It sends a page view when a page
// opens and after every change of route, and how long the page was in front of the visitor
// (visible tab only, at most 30 minutes) when they leave it or hide the tab. No cookie, nothing
// in the browser's storage, no dependencies; the server makes the day's visitor id itself.
//
// It stays quiet in the admin (the website and the admin are one app), in the admin's preview,
// for automated browsers, and on pages opened from the disk.
//
// With a `gate` (the plugin's `mode: 'strict'`) it sends nothing at all, not even the time on
// a page, until the visitor allows statistics in the cookie banner; the page they are on is
// counted from the moment they do. When they take it back, it stops at once.
//
// Framework-free (the Nuxt plugins tracker.client.ts and tracker-strict.client.ts start it), so
// it can be tested without a browser.

export const TRACKER_ENDPOINT = '/api/content/_analytics/e'

/** What the strict tracker asks before it sends anything. */
export interface TrackerGate {
  /** The visitor's choice is known in this page. */
  ready: () => boolean
  /** Statistics are allowed. */
  granted: () => boolean
  /** Called when the choice is known, and whenever it changes. */
  onChange: (cb: () => void) => void
}

export interface TrackerHooks {
  /** The app is mounted (the first page is there). */
  mounted: (cb: () => void) => void
  /** A new page is in place after a change of route. */
  pageFinish: (cb: () => void) => void
}

export type TrackerSend = (body: string, leaving: boolean) => void

const defaultSend: TrackerSend = (body, leaving) => {
  // text/plain: a "simple" request, so no preflight even on a CDN that adds CORS headers.
  if (leaving && navigator.sendBeacon?.(TRACKER_ENDPOINT, new Blob([body], { type: 'text/plain' }))) return
  fetch(TRACKER_ENDPOINT, { method: 'POST', body, keepalive: true, headers: { 'content-type': 'text/plain' }, credentials: 'same-origin' }).catch(() => {})
}

export function startTracker(hooks: TrackerHooks, opts: { gate?: TrackerGate | null; send?: TrackerSend } = {}): void {
  const MAX_MS = 30 * 60_000
  if (navigator.webdriver || !/^https?:$/.test(location.protocol)) return
  const gate = opts.gate ?? null
  const send = opts.send ?? defaultSend

  const quiet = (path: string) => path === '/admin' || path.startsWith('/admin/') || path.startsWith('/api/')
    || new URLSearchParams(location.search).has('preview')
  const allowed = () => !gate || (gate.ready() && gate.granted())
  const id = () => Math.random().toString(36).slice(2, 12) + Date.now().toString(36)

  let view = ''
  let path = ''
  let shown = 0
  let since = 0
  let first = true

  const post = (data: Record<string, unknown>, leaving = false) => {
    if (!allowed()) return
    send(JSON.stringify(data), leaving)
  }
  const visible = () => document.visibilityState === 'visible'
  const pause = () => {
    if (since) shown += Date.now() - since
    since = 0
  }
  /** The time the current view was looked at since the last report: sent, then counted from 0. */
  const report = () => {
    pause()
    const ms = Math.min(shown, MAX_MS)
    if (view && ms >= 1000) post({ v: view, e: ms }, true)
    shown = 0
    if (visible()) since = Date.now()
  }

  const pageview = () => {
    // Not allowed (strict, no consent): nothing is sent, and the page is not taken as counted.
    if (!allowed()) return
    const next = location.pathname
    if (next === path) return
    if (view) report()
    path = next
    view = ''
    if (quiet(next)) return
    view = id()
    shown = 0
    since = visible() ? Date.now() : 0
    const q = new URLSearchParams(location.search)
    const utm = { s: q.get('utm_source'), m: q.get('utm_medium'), c: q.get('utm_campaign') }
    post({
      v: view,
      p: next,
      // Where the visitor came from: only for the page they arrived on.
      r: first ? document.referrer : '',
      u: utm.s || utm.m || utm.c ? utm : undefined,
      w: screen.width,
      l: navigator.language,
      lc: document.documentElement.lang || undefined,
    })
    first = false
  }

  /** Statistics taken back: forget the page, so nothing more about it (not even its time) is sent. */
  const stop = () => {
    view = ''
    path = ''
    shown = 0
    since = 0
  }

  document.addEventListener('visibilitychange', () => (visible() ? (since = Date.now()) : report()))
  window.addEventListener('pagehide', report)
  hooks.mounted(() => {
    // Registered once every app plugin has run, so the consent plugin's store is there.
    gate?.onChange(() => (allowed() ? pageview() : stop()))
    pageview()
  })
  // After the new page is in place: its <html lang> is the new one.
  hooks.pageFinish(() => { setTimeout(pageview, 0) })
}
