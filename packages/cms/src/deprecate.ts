// Deprecations: the way tinyzoo retires part of its public API without breaking a
// site on the next update. The policy lives in CONTRIBUTING.md; in short, the
// old API keeps working for at least one minor release and says so once.
//
//   /** @deprecated Use `publish` instead. Removed in 0.4. */
//   export function oldThing() {
//     cmsDeprecated('oldThing', '`oldThing()` is replaced by `publish()`.', { removeIn: '0.4.0' })
//     …
//   }
//
// `@deprecated` shows up in the editor; `cmsDeprecated()` shows up in the log of a
// site that still uses it.

/** @internal */
export interface CmsDeprecation {
  /** Stable id of the thing that is deprecated: one warning per id and process. */
  id: string
  message: string
  /** The release that removes it, when known. */
  removeIn?: string
}

/** @internal */
export interface CmsDeprecatedOptions {
  /** The tinyzoo version that removes it, e.g. `'0.4.0'` or `'1.0.0'`. */
  removeIn?: string
}

const seen = new Map<string, CmsDeprecation>()

/**
 * Whether to print. `TINYZOO_DEPRECATIONS` decides when set (`1`/`show` always,
 * `0`/`off` never); otherwise warnings print everywhere except under
 * `NODE_ENV=test`, so a site's own test output stays clean.
 */
function shouldPrint(): boolean {
  const flag = (process.env.TINYZOO_DEPRECATIONS ?? '').toLowerCase()
  if (flag === '1' || flag === 'show' || flag === 'true') return true
  if (flag === '0' || flag === 'off' || flag === 'false') return false
  return process.env.NODE_ENV !== 'test'
}

/**
 * Mark a call site as deprecated: warns once per process
 * (`[tinyzoo] deprecated: … Will be removed in 0.4.0.`), whatever the number of
 * calls. The warning is silent under `NODE_ENV=test` unless
 * `TINYZOO_DEPRECATIONS=1`, but is always recorded: see `cmsDeprecations()`.
 *
 * @internal
 */
export function cmsDeprecated(id: string, message: string, options: CmsDeprecatedOptions = {}): void {
  if (seen.has(id)) return
  const entry: CmsDeprecation = { id, message, ...(options.removeIn ? { removeIn: options.removeIn } : {}) }
  seen.set(id, entry)
  if (!shouldPrint()) return
  const removal = options.removeIn ? ` Will be removed in ${options.removeIn}.` : ' Will be removed in a later release.'
  console.warn(`[tinyzoo] deprecated: ${message}${removal} (${id})`)
}

/**
 * Every deprecation hit so far in this process, in the order they happened (for tests and diagnostics).
 *
 * @internal
 */
export function cmsDeprecations(): CmsDeprecation[] {
  return [...seen.values()]
}

/**
 * Forget what was recorded, so the next call warns again (tests).
 *
 * @internal
 */
export function resetCmsDeprecations(): void {
  seen.clear()
}
