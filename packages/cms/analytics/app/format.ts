// How the analytics admin shows numbers, times and places. Pure functions of the admin's language.

/** 1 284 / 12,9 tis. — compact from 10 000 up, in full below (in the admin's language). */
export function compactNumber(n: number, locale: string): string {
  const v = Number(n) || 0
  if (Math.abs(v) < 10_000) return new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(v)
  return new Intl.NumberFormat(locale, { notation: 'compact', maximumFractionDigits: 1 }).format(v)
}

export function decimal(n: number, locale: string, digits = 1): string {
  return new Intl.NumberFormat(locale, { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(Number(n) || 0)
}

export function percent(fraction: number, locale: string, digits = 0): string {
  return new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: digits }).format(Number(fraction) || 0)
}

/** A duration as people say it: "45 s", "2 min 05 s", "1 h 12 min". */
export function duration(ms: number): string {
  const s = Math.round((Number(ms) || 0) / 1000)
  if (s < 60) return `${s} s`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m} min ${String(s % 60).padStart(2, '0')} s`
  return `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')} min`
}

/** The flag of a country code, as the two regional-indicator letters (systems without flag emoji show the letters). */
export function flag(code: string): string {
  if (!/^[A-Z]{2}$/.test(code)) return ''
  return String.fromCodePoint(...[...code].map((c) => 0x1F1E6 + c.charCodeAt(0) - 65))
}

const regionNames = new Map<string, Intl.DisplayNames | null>()

/** "Czechia" / "Česko" for `CZ`, in the admin's language. */
export function countryName(code: string, locale: string): string {
  if (!regionNames.has(locale)) {
    try { regionNames.set(locale, new Intl.DisplayNames([locale], { type: 'region' })) }
    catch { regionNames.set(locale, null) }
  }
  try { return regionNames.get(locale)?.of(code) ?? code }
  catch { return code }
}

/** Clean steps for an axis that reaches `max`: [0, 50, 100, 150]. */
export function niceTicks(max: number, count = 4): number[] {
  if (!(max > 0)) return [0, 1]
  const raw = max / count
  const mag = 10 ** Math.floor(Math.log10(raw))
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? 10 * mag
  const top = Math.max(step, Math.ceil(max / step) * step)
  const ticks: number[] = []
  for (let v = 0; v <= top + step / 2; v += step) ticks.push(Math.round(v * 1000) / 1000)
  return ticks
}
