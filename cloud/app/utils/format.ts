import type { Locale } from '#shared/templates'

const tag = (locale: Locale) => (locale === 'en' ? 'en-GB' : 'cs-CZ')

/** "23. listopadu 2026" / "23 November 2026". */
export function formatDate(iso: string | null | undefined, locale: Locale): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString(tag(locale), { day: 'numeric', month: 'long', year: 'numeric' })
}

/** "23. 11. 2026 14:05" / "23 Nov 2026, 14:05". */
export function formatDateTime(iso: string | null | undefined, locale: Locale): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString(tag(locale), { day: 'numeric', month: locale === 'en' ? 'short' : 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

/** How long something took: "0,4 s", "12 s", "1 min 5 s". */
export function formatDuration(ms: number | null | undefined, locale: Locale): string {
  if (ms == null || !Number.isFinite(ms)) return ''
  if (ms < 10_000) return `${(Math.max(ms, 100) / 1000).toLocaleString(tag(locale), { minimumFractionDigits: 1, maximumFractionDigits: 1 })} s`
  const s = Math.round(ms / 1000)
  return s < 60 ? `${s} s` : `${Math.floor(s / 60)} min ${s % 60} s`
}

export function formatBytes(bytes: number | null | undefined): string {
  if (bytes == null) return '—'
  return `${Math.round(bytes / (1024 * 1024))} MB`
}

/** An address without its scheme: "pekarna.localhost:4300". */
export function hostOf(url: string | null | undefined): string {
  if (!url) return ''
  try { return new URL(url).host }
  catch { return url }
}
