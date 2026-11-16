/**
 * HTTP byte ranges and entity tags for serving stored files. Pure functions with no
 * Nitro globals, so the unit tests can load them.
 */

/** `bytes=a-b`, `bytes=a-` or `bytes=-n`: one range only. Anything else (several ranges, other units) is not one. */
const SINGLE_RANGE = /^bytes=(\d*)-(\d*)$/

/**
 * The `Range` header when it asks for one range (it is passed on to the object store as
 * it is), otherwise `undefined`: the whole file is served, as the HTTP rules allow.
 */
export function singleRange(header: unknown): string | undefined {
  const value = String(header ?? '').trim()
  const m = SINGLE_RANGE.exec(value)
  return m && (m[1] || m[2]) ? value : undefined
}

/** The bytes (both ends included) a `Range` header selects in a file of `size` bytes; `'unsatisfiable'` when none of them exist. */
export function byteRange(header: unknown, size: number): { start: number; end: number } | 'unsatisfiable' | null {
  const value = singleRange(header)
  if (!value) return null
  const m = SINGLE_RANGE.exec(value)!
  const start = m[1] ? Number(m[1]) : Math.max(0, size - Number(m[2]))
  const end = m[1] && m[2] ? Math.min(Number(m[2]), size - 1) : size - 1
  if (start >= size || start > end) return 'unsatisfiable'
  return { start, end }
}

/** Does an `If-None-Match` header (a list, `*`, weak tags) name this entity tag? */
export function etagMatches(header: unknown, etag: string | undefined): boolean {
  const value = String(header ?? '').trim()
  if (!value || !etag) return false
  if (value === '*') return true
  const bare = (tag: string) => tag.trim().replace(/^W\//, '')
  const wanted = bare(etag)
  return value.split(',').some((tag) => bare(tag) === wanted)
}
