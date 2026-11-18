// Whether the keyboard was the last thing used, noted on <html> as `data-cms-keys`, and keyboard focus
// kept in view.
//
// A select menu and the search keep the focus in their search box and only mark the option the arrow
// keys reach (`data-highlighted`), which the pointer marks the same way. The browser's :focus-visible
// cannot tell the two apart there, so cms-admin.css rings a marked option only while this attribute is
// set: from the keyboard the option shows the admin's focus ring, under the pointer it looks as before.
// A key sets it (a lone Shift, Control, Alt or Meta does not); moving or pressing the pointer clears it.
//
// A dialog keeps Tab inside itself, and when Tab wraps from its last control to its first (or back) it
// moves the focus without scrolling (Reka's focus trap focuses with `preventScroll`). On a phone, where
// the publish review is taller than the screen, the focused button then sat off screen. While the
// keyboard is in use, a control that takes the focus entirely out of view is scrolled to the nearest edge.
import { onBeforeUnmount, onMounted } from 'vue'

/** The attribute on <html> while the keyboard was the last thing used. */
export const CMS_KEYS_ATTR = 'data-cms-keys'

const MODIFIERS = new Set(['Shift', 'Control', 'Alt', 'Meta', 'AltGraph', 'CapsLock', 'Fn', 'OS'])

/** Start noting it on `doc`'s <html>; returns the function that stops (and removes the attribute). */
export function cmsTrackKeys(doc: Document = document): () => void {
  const root = doc.documentElement
  const onKey = (e: KeyboardEvent) => {
    if (!MODIFIERS.has(e.key) && !root.hasAttribute(CMS_KEYS_ATTR)) root.setAttribute(CMS_KEYS_ATTR, '')
  }
  const onPointer = () => {
    if (root.hasAttribute(CMS_KEYS_ATTR)) root.removeAttribute(CMS_KEYS_ATTR)
  }
  const onFocus = (e: FocusEvent) => {
    const el = e.target as HTMLElement | null
    const view = doc.defaultView
    if (!view || !root.hasAttribute(CMS_KEYS_ATTR) || typeof el?.getBoundingClientRect !== 'function') return
    const r = el.getBoundingClientRect()
    if (!r.width && !r.height) return
    if (r.bottom <= 0 || r.top >= view.innerHeight || r.right <= 0 || r.left >= view.innerWidth) el.scrollIntoView?.({ block: 'nearest', inline: 'nearest' })
  }
  const opts = { capture: true, passive: true } as const
  doc.addEventListener('keydown', onKey, opts)
  doc.addEventListener('pointerdown', onPointer, opts)
  doc.addEventListener('pointermove', onPointer, opts)
  doc.addEventListener('focusin', onFocus, opts)
  return () => {
    doc.removeEventListener('keydown', onKey, opts)
    doc.removeEventListener('pointerdown', onPointer, opts)
    doc.removeEventListener('pointermove', onPointer, opts)
    doc.removeEventListener('focusin', onFocus, opts)
    root.removeAttribute(CMS_KEYS_ATTR)
  }
}

/**
 * `cmsTrackKeys` for as long as the calling component is mounted: started once it is in the page,
 * stopped (listeners and attribute gone) before it leaves. The admin layout calls it in its setup.
 */
export function cmsTrackKeysWhileMounted(doc?: Document): void {
  let stop: (() => void) | undefined
  onMounted(() => { stop = cmsTrackKeys(doc ?? document) })
  onBeforeUnmount(() => { stop?.(); stop = undefined })
}

/**
 * The option of a radio group an arrow key moves to: Down and Right the next, Up and Left the
 * previous, wrapping round. Null for any other key (Tab, Space and Enter keep their own meaning).
 */
export function cmsRadioArrow<T>(key: string, options: readonly T[], current: T): T | null {
  const step = key === 'ArrowDown' || key === 'ArrowRight' ? 1 : key === 'ArrowUp' || key === 'ArrowLeft' ? -1 : 0
  if (!step || !options.length) return null
  const at = options.indexOf(current)
  return options[((at < 0 ? 0 : at + step) + options.length) % options.length]!
}

/**
 * A key on one option of a radio group (`role="radiogroup"` holding `role="radio"` buttons with
 * `aria-checked` and a roving `tabindex`: only the chosen one is a Tab stop). An arrow key chooses
 * the next or previous option and, once that is drawn (`after`: Vue's `nextTick`), moves the focus
 * to the option now checked, so the focus and the choice move together. Other keys are left alone.
 */
export function cmsRadioGroupKey<T>(e: KeyboardEvent, options: readonly T[], current: T, choose: (option: T) => void, after: (fn: () => void) => unknown): void {
  const next = cmsRadioArrow(e.key, options, current)
  if (next === null) return
  e.preventDefault()
  const group = (e.currentTarget as HTMLElement | null)?.parentElement
  choose(next)
  after(() => group?.querySelector<HTMLElement>('[aria-checked="true"]')?.focus())
}
