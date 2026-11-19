// Small formatting helpers shared by the pages (auto-imported from app/utils).

const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

/** "just now", "3 min ago", "5 h ago", "2 days ago", or a date for anything older than a month. */
export function timeAgo(iso: string | null | undefined, now = Date.now()): string {
  if (!iso) return '—'
  const diff = now - Date.parse(iso)
  if (!Number.isFinite(diff)) return '—'
  if (diff < 0) return 'just now'
  if (diff < MINUTE) return 'just now'
  if (diff < HOUR) return `${Math.floor(diff / MINUTE)} min ago`
  if (diff < DAY) return `${Math.floor(diff / HOUR)} h ago`
  const days = Math.floor(diff / DAY)
  if (days < 31) return days === 1 ? 'yesterday' : `${days} days ago`
  return formatDate(iso)
}

/** "2 h 5 min", "3 days" — how long between two moments. */
export function duration(fromIso: string, toIso: string | null, now = Date.now()): string {
  const ms = (toIso ? Date.parse(toIso) : now) - Date.parse(fromIso)
  if (!Number.isFinite(ms) || ms < MINUTE) return 'under a minute'
  // Rounded once, to whole minutes, then split: 2 h 59.6 min is "3 h", never "2 h 60 min".
  const minutes = Math.round(ms / MINUTE)
  if (minutes < 60) return `${minutes} min`
  if (minutes < 24 * 60) {
    const h = Math.floor(minutes / 60)
    const m = minutes % 60
    return m ? `${h} h ${m} min` : `${h} h`
  }
  const d = Math.round(ms / DAY)
  return d === 1 ? '1 day' : `${d} days`
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

/** Whole days from now until `iso` (negative once it is past), or null. */
export function daysLeft(iso: string | null | undefined, now = Date.now()): number | null {
  if (!iso) return null
  const t = Date.parse(iso)
  return Number.isFinite(t) ? Math.floor((t - now) / DAY) : null
}

export function formatBytes(bytes: number | null | undefined): string {
  if (bytes == null) return '—'
  if (bytes < 1024) return `${bytes} B`
  const units = ['KB', 'MB', 'GB', 'TB']
  let v = bytes / 1024
  let i = 0
  while (v >= 1024 && i < units.length - 1) { v /= 1024; i++ }
  return `${v >= 100 ? Math.round(v) : v.toFixed(1)} ${units[i]}`
}

/** 0.99873 → "99.87 %", null → "—". */
export function formatUptime(share: number | null | undefined): string {
  if (share == null) return '—'
  const pct = share * 100
  return `${pct === 100 ? '100' : pct.toFixed(2)} %`
}

export function hostOf(url: string): string {
  try { return new URL(url).host }
  catch { return url }
}

/** Compare two x.y.z versions: negative when a < b. Pre-release tags are ignored. */
export function compareVersions(a: string, b: string): number {
  const pa = a.split(/[.-]/).slice(0, 3).map((n) => Number.parseInt(n, 10) || 0)
  const pb = b.split(/[.-]/).slice(0, 3).map((n) => Number.parseInt(n, 10) || 0)
  for (let i = 0; i < 3; i++) {
    if (pa[i]! !== pb[i]!) return pa[i]! - pb[i]!
  }
  return 0
}

/** The h3 error's message, for a toast. */
export function errorMessage(err: unknown, fallback = 'Something went wrong.'): string {
  const e = err as { data?: { statusMessage?: string; message?: string }; statusMessage?: string; message?: string }
  return e?.data?.statusMessage || e?.data?.message || e?.statusMessage || e?.message || fallback
}
