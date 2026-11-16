/**
 * After a failed submit: put the cursor on the first field that is wrong, so a keyboard or
 * screen-reader user lands where the problem is (and is told it) instead of on `<body>`.
 * Looks for `aria-invalid="true"` inside `root` (the form or dialog; the whole page by
 * default) and, when no field is marked, on the first `[data-cms-error-summary]` / alert.
 * Call it after the error state is set; it waits for the DOM to show it.
 */
export async function cmsFocusInvalid(root?: ParentNode | null, fallbackId?: string): Promise<boolean> {
  if (!import.meta.client) return false
  await nextTick()
  const scope: ParentNode = root ?? document
  const field = scope.querySelector<HTMLElement>('[aria-invalid="true"]:not([disabled]):not([type="hidden"])')
  // A composite field (rich text, pictures, blocks) has no single control to mark: its box is the next best place.
  const summary = field ? null : (fallbackId ? document.getElementById(fallbackId) : null) ?? scope.querySelector<HTMLElement>('[data-cms-error-summary], [role="alert"]:not(:empty)')
  const target = field ?? summary
  if (!target) return false
  if (!field && target.tabIndex < 0) target.tabIndex = -1
  const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  target.focus({ preventScroll: true })
  target.scrollIntoView?.({ block: 'center', behavior: reduce ? 'auto' : 'smooth' })
  return true
}
