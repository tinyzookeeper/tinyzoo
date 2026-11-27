// The editor in the preview: the values of an entry or a global, edited where they stand in the page
// (since 2g). 2f finds an entry's plain and rich texts and pictures; here are the rest:
//
// - where a value is inside an entry (`CmsValuePath`): a field, a field of an item of a list (the item by
//   its id), a field of a group, and reading and replacing a value there;
// - the forms a value that is no plain text may be drawn in (a number with or without grouping, a date in
//   the page's language, a choice by its name), so the page can tell which field an element shows;
// - what a text is made of: one value with a unit around it (`450 Kč`), or several values of one entry in
//   a row (`7:00–8:00` is the "from" and the "to" of one row of the opening hours).
//
// A match is conservative: every letter and digit of the text must belong to a value (but for a short
// unit around one value), all values must be of one entry, and when the text could be made in two ways
// from different fields, nothing is found. Which entry it is, when several could make the same text, is
// decided by what stands around it (shared/builder-sources.ts).
//
// Pure functions of plain values, tested in test/unit/builder-values.spec.ts.
import { cmsMatchBare, cmsMatchSquash } from './builder-match'

const isObject = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x)

// ── where a value is ──

/**
 * A value inside an entry: its field, then, going down, a list's item by its id or a group's field:
 * `['note']`, `['rows', 'k3j…', 'from']`, `['address', 'city']`.
 */
export type CmsValuePath = string[]

const PATH_MOST = 6

export const isCmsValuePath = (x: unknown): x is CmsValuePath => Array.isArray(x) && x.length >= 1 && x.length <= PATH_MOST
  && x.every((s) => typeof s === 'string' && s.length > 0 && s.length <= 200)

export const cmsValuePathKey = (at: readonly string[]): string => at.join('\u0000')

/** The value at a path (`undefined` when the path is not there). In a list a step is an item's id, else a key. */
export function cmsValueAt(values: unknown, at: readonly string[]): unknown {
  let v: unknown = values
  for (const step of at) {
    if (Array.isArray(v)) v = v.find((x) => isObject(x) && x.id === step)
    else if (isObject(v)) v = Object.hasOwn(v, step) ? v[step] : undefined
    else return undefined
    if (v === undefined) return undefined
  }
  return v
}

/**
 * A copy of `values` with the value at `at` replaced (nothing else is copied deeper than the path).
 * `undefined` when the path is not there: an item that is gone, a group that is empty.
 */
export function cmsValueSet<T>(values: T, at: readonly string[], value: unknown): T | undefined {
  if (!at.length) return value as T
  const [step, ...rest] = at as [string, ...string[]]
  if (Array.isArray(values)) {
    const i = values.findIndex((x) => isObject(x) && x.id === step)
    if (i < 0 || !rest.length) return undefined
    const inner = cmsValueSet(values[i], rest, value)
    if (inner === undefined) return undefined
    const next = [...values]
    next[i] = inner
    return next as T
  }
  if (!isObject(values)) return undefined
  if (!rest.length) return { ...values, [step]: value } as T
  if (!Object.hasOwn(values, step)) return undefined
  const inner = cmsValueSet(values[step], rest, value)
  return inner === undefined ? undefined : { ...values, [step]: inner } as T
}

// ── the forms of a value ──

/** What a value that is no plain text is: a number, a date and time, or a choice (with each option's names). */
export interface CmsValueKind {
  value?: 'number' | 'date' | 'choice'
  options?: Record<string, string[]>
}

/** A form as it is compared: the normal form without what a look puts around a value, in lower case. */
export function cmsFormKey(text: string): string {
  return cmsMatchBare(cmsMatchSquash(text)).toLocaleLowerCase('cs')
}

const DATE_FORMS: Intl.DateTimeFormatOptions[] = [
  { day: 'numeric', month: 'numeric', year: 'numeric' },
  { day: '2-digit', month: '2-digit', year: 'numeric' },
  { day: 'numeric', month: 'numeric' },
  { day: 'numeric', month: 'long', year: 'numeric' },
  { day: 'numeric', month: 'long' },
  { day: 'numeric', month: 'short' },
  { day: 'numeric', month: 'short', year: 'numeric' },
  { weekday: 'long', day: 'numeric', month: 'long' },
  { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' },
  { weekday: 'long', day: 'numeric', month: 'numeric' },
  { weekday: 'short', day: 'numeric', month: 'numeric' },
  { weekday: 'short', day: 'numeric', month: 'long' },
  { hour: 'numeric', minute: '2-digit' },
  { hour: '2-digit', minute: '2-digit' },
  { day: 'numeric', month: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' },
  { day: 'numeric', month: 'numeric', hour: 'numeric', minute: '2-digit' },
  { day: 'numeric', month: 'long', hour: 'numeric', minute: '2-digit' },
  { day: 'numeric', month: 'long', year: 'numeric', hour: 'numeric', minute: '2-digit' },
]

/**
 * The texts a value may be drawn as, each as `cmsFormKey` gives it. A number: plain, with the grouping
 * and the decimal mark of the page's language and of Czech, English and German, with two decimals. A
 * date and time: the usual short and long dates, with and without the weekday and the year, the time, and
 * both together, in the page's languages (`langs`), read in the browser's time zone and in UTC (a site may
 * draw either); also `2026-11-27`. A choice: the option's names and the stored value. Nothing else has a
 * form: a switch is not drawn as a text.
 */
export function cmsValueForms(value: unknown, kind: CmsValueKind, langs: readonly string[] = []): string[] {
  const out = new Set<string>()
  const add = (s: string) => {
    const key = cmsFormKey(s)
    if (key) out.add(key)
  }
  if (kind.value === 'number') {
    const n = typeof value === 'number' ? value : typeof value === 'string' && /^-?\d+(?:\.\d+)?$/.test(value.trim()) ? Number(value) : Number.NaN
    if (!Number.isFinite(n)) return []
    add(String(n))
    for (const lang of new Set([...langs, 'cs', 'en', 'de'])) {
      try {
        add(new Intl.NumberFormat(lang).format(n))
        add(new Intl.NumberFormat(lang, { useGrouping: false }).format(n))
        add(new Intl.NumberFormat(lang, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n))
      }
      catch { /* a language the browser does not know */ }
    }
  }
  else if (kind.value === 'date') {
    const d = value instanceof Date ? value : typeof value === 'string' || typeof value === 'number' ? new Date(value) : null
    if (!d || Number.isNaN(d.getTime())) return []
    for (const lang of langs.length ? new Set(langs) : new Set(['cs'])) {
      for (const timeZone of [undefined, 'UTC']) {
        for (const options of DATE_FORMS) {
          try {
            const text = new Intl.DateTimeFormat(lang, { ...options, timeZone }).format(d)
            add(text)
            // "27. 11. 2026" written without its spaces.
            if (/\.\s/.test(text)) add(text.replace(/\.\s+/g, '.'))
          }
          catch { /* a language the browser does not know */ }
        }
      }
    }
    add(d.toISOString().slice(0, 10))
  }
  else if (kind.value === 'choice') {
    if (typeof value !== 'string' || !value) return []
    add(value)
    for (const name of (kind.options && Object.hasOwn(kind.options, value) ? kind.options[value] : undefined) ?? []) add(name)
  }
  return [...out]
}

// ── what a text is made of ──

/** A value of an entry (or a global) as the page may find it in a text: where it is, and its forms. */
export interface CmsValueField {
  entity: string
  id: string
  at: CmsValuePath
  /** A plain text (its form is itself) or a value that is no text (a number, a date, a choice). */
  kind: 'text' | 'value'
  /** Its forms, each as `cmsFormKey` gives it. */
  keys: string[]
}

export interface CmsValueIndex {
  byKey: Map<string, CmsValueField[]>
}

export function cmsValueIndex(fields: readonly CmsValueField[]): CmsValueIndex {
  const byKey = new Map<string, CmsValueField[]>()
  for (const f of fields) {
    for (const key of f.keys) {
      const list = byKey.get(key)
      if (list) list.push(f)
      else byKey.set(key, [f])
    }
  }
  return { byKey }
}

/** The values of one entry a text is made of, in the text's order. */
export interface CmsValueHit {
  entity: string
  id: string
  values: CmsValueField[]
}

const TOKEN = /[\p{L}\p{N}]+/gu
/** A text of more words than this is prose, not values in a row. */
const TOKENS_MOST = 14
/** A value's form spans at most this many words ("pátek 27. listopadu 2026 18:30"). */
const SPAN_MOST = 7
/** The letters a look may put around one value (`od 450 Kč`, `Cena: 450 Kč`). */
const AROUND_MOST = 12
/** A plain text counts with a word around it only when it is at least this long (`trenér Tomáš Brabec`). */
const TEXT_LEAST = 6

/**
 * Which entries could have made a text, and from which of their values. For each entry on its own: the
 * text is its values' forms in a row, with nothing but spaces and punctuation between them (at most four;
 * each value once), or one value with a few letters and no digit around it. When an entry can make the
 * text from different sets of its fields, it is left out: the text does not tell which. More than one
 * entry in the answer: the caller decides by what stands around the text.
 */
export function cmsValueMatch(text: string, index: CmsValueIndex): CmsValueHit[] {
  const folded = cmsMatchSquash(text).toLocaleLowerCase('cs')
  const tokens: { start: number; end: number }[] = []
  for (const m of folded.matchAll(TOKEN)) tokens.push({ start: m.index, end: m.index + m[0].length })
  const n = tokens.length
  if (!n || n > TOKENS_MOST) return []
  const byEntry = new Map<string, { i: number; j: number; field: CmsValueField }[]>()
  for (let i = 0; i < n; i++) {
    for (let j = i; j < n && j < i + SPAN_MOST; j++) {
      const hits = index.byKey.get(folded.slice(tokens[i]!.start, tokens[j]!.end))
      if (!hits) continue
      for (const field of hits) {
        const key = `${field.entity}\n${field.id}`
        const list = byEntry.get(key)
        if (list) list.push({ i, j, field })
        else byEntry.set(key, [{ i, j, field }])
      }
    }
  }
  const out: CmsValueHit[] = []
  for (const occs of byEntry.values()) {
    const first = occs[0]!.field
    const chains: CmsValueField[][] = []
    const walk = (pos: number, used: CmsValueField[]) => {
      if (chains.length > 8) return
      if (pos === n) { chains.push(used); return }
      if (used.length >= 4) return
      for (const o of occs) {
        if (o.i !== pos || used.some((u) => cmsValuePathKey(u.at) === cmsValuePathKey(o.field.at))) continue
        walk(o.j + 1, [...used, o.field])
      }
    }
    walk(0, [])
    // More ways than can be told apart: nothing.
    if (chains.length > 8) continue
    if (chains.length) {
      const set = (c: CmsValueField[]) => c.map((f) => cmsValuePathKey(f.at)).sort().join('\u0001')
      const one = set(chains[0]!)
      if (chains.every((c) => set(c) === one)) out.push({ entity: first.entity, id: first.id, values: chains[0]! })
      continue
    }
    // One value with a look's word or unit around it: no digit and only a few letters outside it.
    // The longest such value counts (a whole name before a surname alone); two of one length: nothing.
    const around = new Map<string, CmsValueField>()
    let longest = 0
    for (const o of occs) {
      const length = tokens[o.j]!.end - tokens[o.i]!.start
      if (length < longest || (o.field.kind === 'text' && length < TEXT_LEAST)) continue
      let letters = 0
      let digit = false
      tokens.forEach((t, k) => {
        if (k >= o.i && k <= o.j) return
        const word = folded.slice(t.start, t.end)
        if (/\p{N}/u.test(word)) digit = true
        letters += word.length
      })
      if (digit || letters > AROUND_MOST) continue
      if (length > longest) around.clear()
      longest = length
      around.set(cmsValuePathKey(o.field.at), o.field)
    }
    if (around.size === 1) out.push({ entity: first.entity, id: first.id, values: [...around.values()] })
  }
  return out
}
