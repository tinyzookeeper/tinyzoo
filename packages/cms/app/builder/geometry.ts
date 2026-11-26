// The arithmetic of the overlay, apart from the DOM so it can be tested.
import type { CmsBuilderPlace } from '../../shared/builder'

/** Where a dragged block would land among the others: how many of their midpoints the pointer is below. */
export function targetIndex(pointerY: number, midpoints: readonly number[]): number {
  let at = 0
  while (at < midpoints.length && pointerY > midpoints[at]!) at++
  return at
}

/** The place for the block at `from` dropped at `target` among the others; `null` when that is where it is. */
export function dropPlace(ids: readonly string[], from: number, target: number): CmsBuilderPlace | null {
  if (target === from) return null
  const others = ids.filter((_, i) => i !== from)
  const before = others[target]
  if (before !== undefined) return { before }
  const after = others[others.length - 1]
  return after === undefined ? null : { after }
}

/** The ids as they will read once the block at `from` is dropped at `target` among the others. */
export function droppedOrder(ids: readonly string[], from: number, target: number): string[] {
  const rest = ids.filter((_, i) => i !== from)
  rest.splice(target, 0, ids[from]!)
  return rest
}

/** How far the others move (in px, as a signed amount) while the block at `from` is held at `target`: the ones it passes. */
export function shiftFor(index: number, from: number, target: number, step: number): number {
  if (index === from) return 0
  const among = index < from ? index : index - 1
  if (from < target && among >= from && among < target) return -step
  if (target < from && among >= target && among < from) return step
  return 0
}

/** The boundary nearest the pointer, within `within` px of it; `null` when none is. */
export function nearestBoundary(pointerY: number, ys: readonly number[], within = 24): number | null {
  let best: number | null = null
  let bestDistance = within + 1
  ys.forEach((y, i) => {
    const d = Math.abs(y - pointerY)
    if (d < bestDistance) { best = i; bestDistance = d }
  })
  return best
}

/** Scroll speed (px per frame, signed) for a pointer near the top or bottom of the viewport: faster the closer to the edge. */
export function edgeSpeed(clientY: number, viewportHeight: number, zone = 60, max = 22): number {
  if (clientY < zone) return -Math.min(1, (zone - clientY) / zone) * max
  if (clientY > viewportHeight - zone) return Math.min(1, (clientY - (viewportHeight - zone)) / zone) * max
  return 0
}
