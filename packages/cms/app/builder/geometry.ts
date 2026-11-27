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

// ── lists in any direction: a stack, a row, a wrapping row, a grid ──

/** A block's box (px, any one coordinate system). */
export interface Box { left: number; top: number; right: number; bottom: number }

/** A place to drop or add in a list, as a line on the screen: `index` is where a block goes in the list (0 … length). */
export interface Slot { index: number; x1: number; y1: number; x2: number; y2: number }

/** Two boxes stand on one line when the second starts right of the first and they overlap by more than half the lower one. */
function sameLine(a: Box, b: Box): boolean {
  const overlap = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top)
  const lower = Math.min(a.bottom - a.top, b.bottom - b.top)
  return b.left >= a.right - 2 && overlap > Math.max(1, lower / 2)
}

/** The boxes of a list, in its order, grouped into the lines they stand on (indexes). */
export function linesOf(boxes: readonly Box[]): number[][] {
  const lines: number[][] = []
  boxes.forEach((b, i) => {
    const line = lines[lines.length - 1]
    if (line && sameLine(boxes[line[line.length - 1]!]!, b)) line.push(i)
    else lines.push([i])
  })
  return lines
}

/** The direction a list runs in as drawn: `x` when two of its blocks stand side by side, else `y`; `null` for fewer than two. */
export function axisOf(boxes: readonly Box[]): 'x' | 'y' | null {
  if (boxes.length < 2) return null
  return linesOf(boxes).some((line) => line.length > 1) ? 'x' : 'y'
}

/** Whether every block of a list stands on one line along its axis (a stack, or a row that does not wrap). */
export function oneLine(boxes: readonly Box[], axis: 'x' | 'y'): boolean {
  const lines = linesOf(boxes)
  return axis === 'x' ? lines.length === 1 : lines.every((line) => line.length === 1)
}

const typicalGap = (gaps: number[]) => {
  const real = gaps.filter((g) => g > 0.5)
  return real.length ? Math.min(...real) : 8
}

/**
 * Every place in a list as a line on the screen, along its direction: in a stack a horizontal line
 * in the middle of each gap (and above the first block, below the last); in a row a vertical line in
 * the middle of each gap, as tall as the line of blocks; in a wrapping row or a grid the same on each
 * line, so the place between two lines is both after the last block of one and before the first of
 * the next.
 */
export function slotsOf(boxes: readonly Box[], axis: 'x' | 'y' = axisOf(boxes) ?? 'y'): Slot[] {
  const n = boxes.length
  if (!n) return []
  const slots: Slot[] = []
  if (axis === 'y') {
    const left = Math.min(...boxes.map((b) => b.left))
    const right = Math.max(...boxes.map((b) => b.right))
    const g = typicalGap(boxes.slice(1).map((b, i) => b.top - boxes[i]!.bottom))
    for (let i = 0; i <= n; i++) {
      const y = i === 0 ? boxes[0]!.top - g / 2 : i === n ? boxes[n - 1]!.bottom + g / 2 : (boxes[i - 1]!.bottom + boxes[i]!.top) / 2
      slots.push({ index: i, x1: left, y1: y, x2: right, y2: y })
    }
    return slots
  }
  const lines = linesOf(boxes)
  const g = typicalGap(lines.flatMap((line) => line.slice(1).map((i) => boxes[i]!.left - boxes[i - 1]!.right)))
  for (const line of lines) {
    const top = Math.min(...line.map((i) => boxes[i]!.top))
    const bottom = Math.max(...line.map((i) => boxes[i]!.bottom))
    line.forEach((i, k) => {
      const x = k === 0 ? boxes[i]!.left - g / 2 : (boxes[i - 1]!.right + boxes[i]!.left) / 2
      slots.push({ index: i, x1: x, y1: top, x2: x, y2: bottom })
    })
    const last = line[line.length - 1]!
    const x = boxes[last]!.right + g / 2
    slots.push({ index: last + 1, x1: x, y1: top, x2: x, y2: bottom })
  }
  return slots
}

/**
 * The slot nearest a point (by its distance to the slot's line); `null` when there is none. Being
 * beside a line counts more than being far along it: in a grid, a pointer in the second line picks a
 * gap of the second line, even when a gap of the first is a little closer.
 */
export function nearestSlot(slots: readonly Slot[], x: number, y: number): Slot | null {
  let best: Slot | null = null
  let bestDistance = Infinity
  for (const s of slots) {
    const cx = Math.max(Math.min(x, Math.max(s.x1, s.x2)), Math.min(s.x1, s.x2))
    const cy = Math.max(Math.min(y, Math.max(s.y1, s.y2)), Math.min(s.y1, s.y2))
    const across = 4
    const d = s.x1 === s.x2 ? Math.hypot(x - cx, (y - cy) * across) : Math.hypot((x - cx) * across, y - cy)
    if (d < bestDistance) { best = s; bestDistance = d }
  }
  return best
}

/** One slot per place (0 … length), for the "+" of a list: between two blocks of one line its gap, else before a block (and after the last). */
export function addSlots(slots: readonly Slot[], length: number): Slot[] {
  const out: Slot[] = []
  for (let i = 0; i <= length; i++) {
    const all = slots.filter((s) => s.index === i)
    // Two lines for one place (the end of a line and the start of the next): the one before the block.
    const pick = i < length && all.length > 1 ? all[all.length - 1] : all[0]
    if (pick) out.push(pick)
  }
  return out
}

/** Where a block dragged from `from` lands among the others when the pointer is at slot `index` of the whole list. */
export const targetAmongOthers = (index: number, from: number) => (index > from ? index - 1 : index)

/** The place of slot `index` in another list of `ids`, in the list of the block at `path`. */
export function placeInList(ids: readonly string[], index: number, path: string[]): CmsBuilderPlace {
  if (ids[index] !== undefined) return { before: ids[index]!, in: path }
  if (ids.length) return { after: ids[ids.length - 1]!, in: path }
  return { end: true, in: path }
}

/**
 * Which block a click selects, as an index into `chain` (the ids of the blocks under the pointer, from
 * the page's list down): one level deeper than the deepest block the click shares with the selection,
 * so the first click selects a section, the next a block inside it; a click on a sibling selects the
 * sibling; a click inside the selected block where nothing is deeper keeps it.
 */
export function selectDepth(chain: readonly string[], selected: readonly string[] | null): number {
  if (!chain.length) return -1
  const sel = selected ?? []
  let k = 0
  while (k < chain.length && k < sel.length && chain[k] === sel[k]) k++
  return Math.min(k, chain.length - 1)
}

// ── where a nested block's toolbar goes ──

/** The area two boxes share (px²). */
export function overlapArea(a: Box, b: Box): number {
  const w = Math.min(a.right, b.right) - Math.max(a.left, b.left)
  const h = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top)
  return w > 0 && h > 0 ? w * h : 0
}

/**
 * Which of the places a toolbar could stand hides the least: each is scored by what it covers (each
 * thing's area under it times its weight: the selected block's own text counts most) and by how much
 * of it is off the screen (`bounds`), which counts far more. The first of equal places wins, so the
 * places are given in the order they are preferred.
 */
export function leastHidden(places: readonly Box[], covers: readonly { box: Box; weight: number }[], bounds: Box): number {
  let best = 0
  let bestScore = Infinity
  places.forEach((p, i) => {
    const area = (p.right - p.left) * (p.bottom - p.top)
    const off = area - overlapArea(p, bounds)
    const score = off * 100 + covers.reduce((sum, c) => sum + overlapArea(p, c.box) * c.weight, 0)
    if (score < bestScore - 0.5) { best = i; bestScore = score }
  })
  return best
}

/** Whether the boxes of a list are all of one size (a grid's cells), within `tolerance` px. */
export function sameSizes(boxes: readonly Box[], tolerance = 2): boolean {
  if (boxes.length < 2) return true
  const w = boxes[0]!.right - boxes[0]!.left
  const h = boxes[0]!.bottom - boxes[0]!.top
  return boxes.every((b) => Math.abs(b.right - b.left - w) <= tolerance && Math.abs(b.bottom - b.top - h) <= tolerance)
}

/**
 * In a list whose blocks are all of one size (a grid), how far each block moves while the block at
 * `from` is held at `target`: into the cell of its place in the new order, so the others close the gap
 * and open one at the target. `[dx, dy]` per block, the dragged one `[0, 0]`.
 */
export function cellShifts(boxes: readonly Box[], from: number, target: number): [number, number][] {
  const order = boxes.map((_, i) => i).filter((i) => i !== from)
  order.splice(target, 0, from)
  return boxes.map((b, i) => {
    if (i === from) return [0, 0]
    const to = boxes[order.indexOf(i)]!
    return [to.left - b.left, to.top - b.top]
  })
}

/**
 * The inner area of a box a dragged block enters a group by at once: its middle, a third of it or
 * more from each edge (`min` px at least). Near its edges the block lands before or after the group,
 * unless the pointer stays over it for a moment.
 */
export function innerArea(b: Box, min = 24): Box {
  const ix = Math.max((b.right - b.left) * 0.3, Math.min(min, (b.right - b.left) / 4))
  const iy = Math.max((b.bottom - b.top) * 0.3, Math.min(min, (b.bottom - b.top) / 4))
  return { left: b.left + ix, top: b.top + iy, right: b.right - ix, bottom: b.bottom - iy }
}

// ── since 3e: the phone-sized admin's sheet covers the bottom of the frame ──

/**
 * The bottom of what the person sees (px, as `height` is): the frame's height less what the admin covers
 * (`inset`, in the same unit), but never above `min` px under a header that stays at the top, so a sheet
 * taller than the frame cannot leave the tools no room at all.
 */
export function visibleBottom(height: number, inset: number, sticky: number, min = 48): number {
  if (inset <= 0) return height
  return Math.min(height, Math.max(height - inset, sticky + min))
}

/**
 * Where the window must scroll (px) to bring a block into the room between `top` (the bottom of a header that
 * stays at the top) and `bottom` (the visible bottom): a block that fits is centred in the room, a taller one
 * gets its top 24 px under `top`. `rect` is the block's box in the viewport.
 */
export function scrollTargetFor(rect: { top: number; bottom: number }, scrollY: number, top: number, bottom: number): number {
  const room = bottom - top
  const height = rect.bottom - rect.top
  const at = height < room ? rect.top + scrollY - top - (room - height) / 2 : rect.top + scrollY - top - 24
  return Math.max(0, at)
}

/**
 * How far to scroll so a block is in sight between `top` + `margin` and `bottom` - `margin`: the new scroll
 * position, or `null` when it is in sight already (or the scroll would not move: a block too tall to show whole).
 */
export function scrollToShow(rect: { top: number; bottom: number }, scrollY: number, top: number, bottom: number, margin = 16): number | null {
  if (rect.top >= top + margin && rect.bottom <= bottom - margin) return null
  const at = scrollTargetFor(rect, scrollY, top, bottom)
  return Math.abs(at - scrollY) < 1 ? null : at
}

// ── taps: pressing twice, whatever the browser says `detail` is ──

/** A press on the page (or the tools): when and where (screen px), how many in a row, and whether the first of them was on the tools. */
export interface PressRecord { at: number; x: number; y: number; count: number; inside: boolean }

/**
 * The record after a press: it continues the row of the one before when it comes within `ms` and `px` of it
 * (`px` Infinity: by time alone), else it starts a new one. `inside` stays that of the row's first press.
 */
export function nextPress(prev: PressRecord | null, now: { at: number; x: number; y: number; inside: boolean }, o: { ms?: number; px?: number } = {}): PressRecord {
  const { ms = 400, px = 24 } = o
  const again = !!prev && now.at - prev.at <= ms && Math.hypot(now.x - prev.x, now.y - prev.y) <= px
  return { at: now.at, x: now.x, y: now.y, count: again ? prev!.count + 1 : 1, inside: again ? prev!.inside : now.inside }
}

/**
 * How many presses in a row a mouse event is: the browser's `detail`, or, when it says less (a touch's
 * synthesized mouse event often says 1 or 0), the count of the touch presses just before it (`fresh`: how
 * long ago the last of them was at most, ms).
 */
export function pressCount(detail: number, touch: PressRecord | null, now: number, fresh = 1000): number {
  if (touch && now - touch.at <= fresh && touch.count > detail) return touch.count
  return detail
}

/** The text on a page, as boxes, with what a toolbar costs over each: the block's own 4, the rest of its card 3, any other 1. */
export function weighCovers(own: readonly Box[], other: readonly Box[], card: Box | null): { box: Box; weight: number }[] {
  const inCard = (b: Box) => !!card && b.left >= card.left - 1 && b.right <= card.right + 1 && b.top >= card.top - 1 && b.bottom <= card.bottom + 1
  return [...own.map((box) => ({ box, weight: 4 })), ...other.map((box) => ({ box, weight: inCard(box) ? 3 : 1 }))]
}

/**
 * Where the toolbar of a block of a card's design may stand besides near the block: inside the card's top
 * edge (left, right), when the card is tall enough, and just below the card.
 */
export function cardPlaces(card: Box, w: number, h: number, gap: number, clampX: (x: number) => number): { left: number; top: number }[] {
  const tall = card.bottom - card.top >= h * 2 + gap * 2
  return [
    ...(tall ? [{ left: clampX(card.left + gap), top: card.top + gap }, { left: clampX(card.right - w - gap), top: card.top + gap }] : []),
    { left: clampX(card.left), top: card.bottom + gap },
  ]
}
