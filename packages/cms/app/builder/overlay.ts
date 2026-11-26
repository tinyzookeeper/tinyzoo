// The editor in the preview, drawn over the site's page: hover names, a selected block with its
// toolbar, "+" between blocks and drag to reorder. Plain DOM in a shadow root, so the site's
// CSS and the tool's cannot touch each other. It changes nothing in the page but the marked
// blocks' transforms while one is dragged, and it only reports what the owner did: the admin
// decides, changes the content and the page redraws (see shared/builder.ts for the messages).
// Loaded on the first `cms:builder:on` only (plugins/cmsLivePreview.client.ts).
//
// Blocks inside a block's list (a layout's small blocks, a group's) are marked by <CmsBlocks> too,
// so the page is a tree of marked elements: each click goes one level deeper (a section, then a
// block in it, then a block in a group), Escape goes up a level. A list runs in the direction it is
// drawn in: a stack top to bottom, a row left to right, a wrapping row or a grid line by line.
//
// The admin may draw the page smaller than it lays it out (a desktop page scaled to fit the panel):
// it says so (`scale`), and the tools are drawn larger by as much (`k`), so their chips, toolbars, "+"
// and lines keep their size on the screen and their targets stay easy to hit. Every distance the tool
// measures on the screen (how far a drag starts, how near a "+" shows) is counted in screen pixels too.
import type { CmsBuilderKey, CmsBuilderKind, CmsBuilderListKinds, CmsBuilderPath, CmsBuilderPlace, CmsBuilderTexts, CmsBuilderToAdmin, CmsBuilderToPage } from '../../shared/builder'
import { cmsBuilderMarkers } from './state'
import {
  addSlots, axisOf, cellShifts, dropPlace, droppedOrder, edgeSpeed, innerArea, leastHidden, nearestBoundary, nearestSlot, oneLine, placeInList, sameSizes, selectDepth,
  shiftFor, slotsOf, targetAmongOthers,
  type Box, type Slot,
} from './geometry'

const MARK = '[data-cms-block]'
const EASE = 'cubic-bezier(.2,.7,.2,1)'
const DRAG_START = 4
const FALLBACK_MS = 2000
const BAR_HEIGHT = 30
/** How long a dragged block hovers over a group before the group takes it (ms). */
const DWELL = 400

let labels: Record<string, string> = {}
let kinds: CmsBuilderListKinds | null = null
let words: CmsBuilderTexts | null = null
let selected: CmsBuilderPath | null = null
let scrollToSelected = false
/** The page was laid out anew (the admin changed its width): bring the selected block back into view if it left it. */
let keepInView = false
let hover: BNode | null = null
let plus: { list: string, after: string } | null = null
let press: { pointerId: number, startX: number, startY: number, node: BNode } | null = null
let drag: Drag | null = null
let holding = false
/** When a drag was called off (Escape): the click its release still makes must not select or let go. */
let calledOff = 0
let frame = 0
let ui: Ui | null = null
/** How much smaller the admin draws the page than it lays it out (1: as large). */
let scale = 1
/** Page pixels per screen pixel: the tools are drawn this much larger, so they keep their size on the screen. */
const k = () => 1 / scale
let nodes: BNode[] = []
let nodeOfEl = new WeakMap<Element, BNode>()
const observed = new Set<Element>()

/** A marked block on the page: its elements (one, or a fragment's), its parent block and its path. */
interface BNode {
  id: string
  type: string
  list: string
  els: HTMLElement[]
  parent: BNode | null
  path: CmsBuilderPath
  key: string
}

interface Ui {
  host: HTMLElement
  root: ShadowRoot
  hover: HTMLElement
  chip: HTMLElement
  context: HTMLElement
  box: HTMLElement
  bar: HTMLElement
  name: HTMLElement
  prev: HTMLButtonElement
  next: HTMLButtonElement
  duplicate: HTMLButtonElement
  remove: HTMLButtonElement
  handle: HTMLButtonElement
  line: HTMLElement
  add: HTMLButtonElement
  drop: HTMLElement
  into: HTMLElement
  from: HTMLElement
  cell: HTMLElement
  adds: HTMLButtonElement[]
  empties: HTMLButtonElement[]
}

/** A list as the drag found it: its container (`null`: the page's own list), its blocks and their boxes in the document. */
interface ListGeo {
  container: BNode | null
  path: CmsBuilderPath
  items: BNode[]
  boxes: Box[]
  area: Box | null
  axis: 'x' | 'y'
  single: boolean
  slots: Slot[]
  depth: number
}

interface Drag {
  node: BNode
  own: ListGeo
  from: number
  /** The list it would land in, and where: for its own list among the others, for another one among all. */
  into: ListGeo
  index: number
  slot: Slot | null
  candidates: ListGeo[]
  /** Its own list is a grid of cells of one size: the others close the gap and open one at the target. */
  cells: boolean
  /** The group the pointer is over and since when; it takes the block after DWELL ms, or at once in its inner area. */
  dwell: { list: ListGeo; since: number } | null
  step: number
  free: boolean
  startX: number
  startY: number
  startScroll: number
  /** A large block inside a section is carried smaller, so the place it goes to stays in sight. */
  shrink: number
  lastX: number
  lastY: number
  styles: Map<HTMLElement, string | null>
}

const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches
const send = (message: CmsBuilderToAdmin) => window.parent.postMessage(message, location.origin)
const samePath = (a: CmsBuilderPath | null, b: CmsBuilderPath | null) => !!a && !!b && a.length === b.length && a.every((id, i) => b[i] === id)

// ---- the blocks of the page

/** Every marked block, in document order, each with its parent (the nearest marked block around it). */
function scan(): BNode[] {
  const out: BNode[] = []
  const byKey = new Map<string, BNode>()
  nodeOfEl = new WeakMap()
  for (const el of document.querySelectorAll<HTMLElement>(MARK)) {
    if (!el.isConnected) continue
    const id = el.dataset.cmsBlock ?? ''
    const list = el.dataset.cmsBlockList ?? ''
    const k = `${list}\n${id}`
    let node = byKey.get(k)
    if (!node) {
      const up = el.parentElement?.closest<HTMLElement>(MARK)
      const parent = up ? nodeOfEl.get(up) ?? null : null
      const path = parent ? [...parent.path, id] : [id]
      node = { id, type: el.dataset.cmsBlockType ?? '', list, els: [], parent, path, key: path.join('/') }
      byKey.set(k, node)
      out.push(node)
    }
    node.els.push(el)
    nodeOfEl.set(el, node)
  }
  return out
}

function nodeOf(target: Node | null): BNode | null {
  const el = (target instanceof Element ? target : target?.parentElement)?.closest<HTMLElement>(MARK) ?? null
  if (!el) return null
  // Drawn since the last look: look again.
  if (!nodeOfEl.has(el)) nodes = scan()
  return nodeOfEl.get(el) ?? null
}

/** The block at a path, else the deepest block along it that the page draws (a list the page draws without marks). */
function nodeAt(path: CmsBuilderPath | null): BNode | null {
  if (!path) return null
  for (let n = path.length; n > 0; n--) {
    const key = path.slice(0, n).join('/')
    const found = nodes.find((x) => x.key === key)
    if (found) return found
  }
  return null
}

const chainOf = (node: BNode): BNode[] => (node.parent ? [...chainOf(node.parent), node] : [node])
const siblingsOf = (node: BNode) => nodes.filter((n) => n.parent === node.parent && n.list === node.list)
/** The blocks of a container's list (its first list, as the admin counts it). */
function childrenOf(container: BNode | null): BNode[] {
  const all = nodes.filter((n) => n.parent === container)
  return all.filter((n) => n.list === all[0]?.list)
}

/** What a block is, from the admin's kinds along its path. */
function kindOf(node: BNode): CmsBuilderKind | null {
  const parentList = node.parent ? kindOf(node.parent)?.list : kinds
  return parentList?.types[node.type] ?? null
}
const listKindsOf = (container: BNode | null): CmsBuilderListKinds | null => (container ? kindOf(container)?.list ?? null : kinds)
const nameOf = (node: BNode) => kindOf(node)?.label ?? labels[node.type] ?? node.type

function rectOf(node: BNode): DOMRect {
  const rects = node.els.map((el) => el.getBoundingClientRect())
  if (rects.length === 1) return rects[0]!
  const left = Math.min(...rects.map((r) => r.left))
  const top = Math.min(...rects.map((r) => r.top))
  return new DOMRect(left, top, Math.max(...rects.map((r) => r.right)) - left, Math.max(...rects.map((r) => r.bottom)) - top)
}
/** A box in the document's coordinates. */
function boxOf(node: BNode): Box {
  const r = rectOf(node)
  return { left: r.left + scrollX, top: r.top + scrollY, right: r.right + scrollX, bottom: r.bottom + scrollY }
}

/** The direction a list is drawn in: from where its blocks stand, else from its element's CSS. */
function axisOfList(items: BNode[], boxes: Box[], container: BNode | null): 'x' | 'y' {
  const seen = axisOf(boxes)
  if (seen) return seen
  const holder = items[0]?.els[0]?.parentElement ?? container?.els[0] ?? null
  if (!holder) return 'y'
  const style = getComputedStyle(holder)
  return style.display.includes('flex') && style.flexDirection.startsWith('row') ? 'x' : 'y'
}

/** The left and right edge (viewport px) of a list's blocks together. */
function listSpan(items: BNode[]) {
  const rects = items.map(rectOf)
  return { left: Math.min(...rects.map((r) => r.left)), right: Math.max(...rects.map((r) => r.right)) }
}

/** Where "+" sits after each block of the page's list: the middle of the gap to the next block, or the last block's bottom edge. */
function boundaries(items: BNode[]): number[] {
  const rects = items.map(rectOf)
  return rects.map((r, i) => (rects[i + 1] ? (r.bottom + rects[i + 1]!.top) / 2 : r.bottom))
}

/** The bottom edge (viewport px) of a header that stays at the top of the window while the page scrolls; 0 when there is none. */
function stickyBottom(): number {
  let bottom = 0
  for (const el of document.elementsFromPoint(innerWidth / 2, 1)) {
    for (let at: Element | null = el; at && at !== document.body && at !== document.documentElement; at = at.parentElement) {
      const position = getComputedStyle(at).position
      if (position !== 'fixed' && position !== 'sticky') continue
      const r = at.getBoundingClientRect()
      if (r.top <= 1 && r.bottom < innerHeight / 2) bottom = Math.max(bottom, r.bottom)
      break
    }
  }
  return bottom
}

// ---- drawing

function schedule() {
  if (!frame) frame = requestAnimationFrame(render)
}

function place(el: HTMLElement, host: DOMRect, rect: { left: number, top: number, width: number, height: number }) {
  el.hidden = false
  el.style.left = `${rect.left - host.left}px`
  el.style.top = `${rect.top - host.top}px`
  el.style.width = `${rect.width}px`
  el.style.height = `${rect.height}px`
}

/**
 * Above the block's top edge, or inside it when there is no room above: near the top of the page,
 * under a header that stays at the top, or above the first block of the page's list (where the
 * site's header is).
 */
function above(el: HTMLElement, host: DOMRect, rect: DOMRect, height: number, inside: boolean, sticky: number) {
  el.hidden = false
  const width = el.offsetWidth * k()
  const gap = 6 * k()
  const h = height * k()
  const left = Math.min(Math.max(rect.left, 4 * k()), Math.max(4 * k(), document.documentElement.clientWidth - width - 4 * k()))
  el.style.left = `${left - host.left}px`
  const top = rect.top - h - gap
  const room = !inside && top >= sticky + 2 && rect.top + scrollY >= h + gap
  el.style.top = `${(room ? top : Math.max(rect.top, sticky) + gap) - host.top}px`
}

function render() {
  frame = 0
  if (!ui) return
  ui.host.style.setProperty('--k', String(k()))
  nodes = scan()
  const host = ui.host.getBoundingClientRect()
  const sticky = stickyBottom()
  watchBlocks()
  const current = nodeAt(selected)
  drawSelection(current, host, sticky)
  drawHover(current, host, sticky)
  drawPlus(host)
  drawAdds(current, host)
  drawEmpties(host)
  drawDrop(host)
  if (current && keepInView && !scrollToSelected && !drag) {
    keepInView = false
    const r = rectOf(current)
    if (r.bottom < sticky + 24 || r.top > innerHeight - 24) {
      const room = innerHeight - sticky
      window.scrollTo({ top: Math.max(0, r.top + scrollY - sticky - Math.max(24, (room - Math.min(r.height, room)) / 2)), behavior: 'auto' })
    }
  }
  if (current && scrollToSelected) {
    scrollToSelected = false
    // Only this page scrolls: scrollIntoView would scroll the admin around the frame too.
    const r = rectOf(current)
    const room = innerHeight - sticky
    const top = r.height < room ? r.top + scrollY - sticky - (room - r.height) / 2 : r.top + scrollY - sticky - 24
    window.scrollTo({ top: Math.max(0, top), behavior: reduced() ? 'auto' : 'smooth' })
  }
}

const ARROWS = { y: ['up', 'down'], x: ['left', 'right'] } as const

function drawSelection(current: BNode | null, host: DOMRect, sticky: number) {
  if (!ui) return
  ui.box.hidden = ui.bar.hidden = ui.context.hidden = true
  if (!current) return
  const rect = rectOf(current)
  place(ui.box, host, rect)
  ui.box.classList.toggle('sub', !!current.parent)
  if (current.parent && !drag) place(ui.context, host, rectOf(current.parent))
  if (drag) return
  const list = siblingsOf(current)
  const at = list.indexOf(current)
  const axis = axisOfList(list, list.map(boxOf), current.parent)
  const [back, on] = ARROWS[axis]
  ui.prev.innerHTML = svg(ICONS[back])
  ui.next.innerHTML = svg(ICONS[on])
  label(ui.prev, axis === 'x' ? words?.moveLeft ?? words?.moveUp : words?.moveUp)
  label(ui.next, axis === 'x' ? words?.moveRight ?? words?.moveDown : words?.moveDown)
  ui.name.textContent = nameOf(current)
  ui.prev.disabled = at <= 0
  ui.next.disabled = at >= list.length - 1
  // The first block of the page's list keeps its toolbar inside its top edge (the site's header is above it).
  if (!current.parent && at === 0) above(ui.bar, host, rect, BAR_HEIGHT, true, sticky)
  else placeNested(current, host, rect, sticky)
}

/**
 * The text on the page around a block, as boxes in the document: what a toolbar should not hide. Around
 * a small block, its section; around a section, it and the sections before and after it.
 */
let textCache: { key: string; own: Box[]; other: Box[] } | null = null
function textAround(node: BNode): { own: Box[]; other: Box[] } {
  const section = chainOf(node)[0]!
  const near = node.parent ? [section] : (() => {
    const list = siblingsOf(node)
    const at = list.indexOf(node)
    return [list[at - 1], node, list[at + 1]].filter((n): n is BNode => !!n)
  })()
  const key = `${node.key}\n${near.flatMap((n) => n.els.map((el) => el.offsetHeight)).join()}`
  if (textCache?.key === key) return textCache
  const own: Box[] = []
  const other: Box[] = []
  const range = document.createRange()
  let count = 0
  for (const root of near.flatMap((n) => n.els)) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
    for (let n = walker.nextNode(); n && count < 600; n = walker.nextNode()) {
      if (!n.nodeValue?.trim()) continue
      count++
      range.selectNodeContents(n)
      const mine = node.els.some((el) => el.contains(n))
      for (const r of range.getClientRects()) (mine ? own : other).push({ left: r.left + scrollX, top: r.top + scrollY, right: r.right + scrollX, bottom: r.bottom + scrollY })
    }
  }
  textCache = { key, own, other }
  return textCache
}

/**
 * A block's toolbar where it hides the least: above it, inside its top edge (left or right) when it is
 * tall enough, or below it; never over its own text when another place is free, and on the screen
 * (under a header that stays at the top).
 */
function placeNested(node: BNode, host: DOMRect, rect: DOMRect, sticky: number) {
  if (!ui) return
  ui.bar.hidden = false
  const w = ui.bar.offsetWidth * k()
  const h = BAR_HEIGHT * k()
  const gap = 6 * k()
  const width = document.documentElement.clientWidth
  const clampX = (x: number) => Math.min(Math.max(x, 4 * k()), Math.max(4 * k(), width - w - 4 * k()))
  const tall = rect.height >= h * 2 + gap * 2
  const places: { left: number; top: number }[] = [
    { left: clampX(rect.left), top: rect.top - h - gap },
    ...(tall ? [{ left: clampX(rect.left + gap), top: rect.top + gap }, { left: clampX(rect.right - w - gap), top: rect.top + gap }] : []),
    { left: clampX(rect.left), top: rect.bottom + gap },
    // A block taller than the screen, scrolled past its top: at the top of what shows of it.
    ...(rect.top < sticky && rect.bottom > sticky + h * 3 ? [{ left: clampX(rect.left + gap), top: sticky + gap }] : []),
  ]
  const text = textAround(node)
  const doc = (b: Box): Box => ({ left: b.left - scrollX, top: b.top - scrollY, right: b.right - scrollX, bottom: b.bottom - scrollY })
  const covers = [...text.own.map((b) => ({ box: doc(b), weight: 4 })), ...text.other.map((b) => ({ box: doc(b), weight: 1 }))]
  const boxes = places.map((p) => ({ left: p.left, top: p.top, right: p.left + w, bottom: p.top + h }))
  const best = places[leastHidden(boxes, covers, { left: 0, top: sticky, right: width, bottom: innerHeight })]!
  ui.bar.style.left = `${best.left - host.left}px`
  ui.bar.style.top = `${best.top - host.top}px`
}

function drawHover(current: BNode | null, host: DOMRect, sticky: number) {
  if (!ui) return
  ui.hover.hidden = ui.chip.hidden = true
  if (hover && !hover.els.some((el) => el.isConnected)) hover = null
  if (!hover || drag) return
  // The block the next click would select.
  const chain = chainOf(hover)
  const next = chain[selectDepth(chain.map((n) => n.id), current?.path ?? null)] ?? null
  if (!next || next === current || (current && next.key === current.key)) return
  const rect = rectOf(next)
  place(ui.hover, host, rect)
  ui.hover.classList.toggle('sub', !!next.parent)
  ui.chip.textContent = nameOf(next)
  const list = siblingsOf(next)
  above(ui.chip, host, rect, 20, !next.parent && list[0] === next, sticky)
}

function drawPlus(host: DOMRect) {
  if (!ui) return
  ui.add.hidden = ui.line.hidden = true
  if (!plus || drag) return
  const items = nodes.filter((n) => !n.parent && n.list === plus!.list)
  const at = items.findIndex((n) => n.id === plus!.after)
  if (at < 0) return
  const y = boundaries(items)[at]!
  const { left, right } = listSpan(items)
  place(ui.line, host, { left, top: y, width: right - left, height: 0 })
  ui.add.hidden = false
  ui.add.style.left = `${(left + right) / 2 - 13 * k() - host.left}px`
  ui.add.style.top = `${y - 13 * k() - host.top}px`
}

/** The list the "+" of the selection add to: the selected block's own list when it has one, else the list it is in (inside a section). */
function addContext(current: BNode | null): { container: BNode, items: BNode[] } | null {
  if (!current) return null
  const own = listKindsOf(current)
  if (own) return { container: current, items: childrenOf(current) }
  return current.parent ? { container: current.parent, items: siblingsOf(current) } : null
}

function pool(list: HTMLButtonElement[], count: number, make: () => HTMLButtonElement) {
  while (list.length < count) list.push(make())
  list.forEach((b, i) => { b.hidden = i >= count })
}

/** A "+" at each place of the selected container's list, along its direction. */
function drawAdds(current: BNode | null, host: DOMRect) {
  if (!ui) return
  const context = drag || holding ? null : addContext(current)
  const list = context ? listKindsOf(context.container) : null
  const full = !!list && list.max !== null && (context?.items.length ?? 0) >= list.max
  const items = context && list && !full ? context.items : []
  const boxes = items.map(boxOf)
  const slots = items.length ? addSlots(slotsOf(boxes, axisOfList(items, boxes, context!.container)), items.length) : []
  pool(ui.adds, slots.length, () => {
    const b = tool(ui!.root, ICONS.plus, 'add small')
    b.addEventListener('click', () => { const p = (b as any).__place as CmsBuilderPlace | undefined; if (p) send({ type: 'cms:builder:add', place: p }) })
    return b
  })
  slots.forEach((s, i) => {
    const b = ui!.adds[i]!
    const ids = items.map((n) => n.id)
    ;(b as any).__place = placeInList(ids, s.index, context!.container.path)
    label(b, words?.insertHere)
    // Along a stack, at the right end of the line (the toolbar stands at the left); along a row, in the middle of the gap.
    const x = s.y1 === s.y2 ? s.x2 - 14 * k() : (s.x1 + s.x2) / 2
    b.style.left = `${inPage(x - scrollX - 12 * k(), 24 * k()) - host.left}px`
    b.style.top = `${(s.y1 + s.y2) / 2 - scrollY - 12 * k() - host.top}px`
  })
}

/** In every block whose list is empty (a new layout, a new group): "Add a block", which adds at the end of that list. */
function drawEmpties(host: DOMRect) {
  if (!ui) return
  const empty = drag ? [] : nodes.filter((n) => listKindsOf(n) && !nodes.some((c) => c.parent === n))
  pool(ui.empties, empty.length, () => {
    const b = make('button', 'empty', ui!.root) as HTMLButtonElement
    b.type = 'button'
    b.addEventListener('click', () => {
      const path = (b as any).__path as CmsBuilderPath | undefined
      if (!path) return
      if (!samePath(selected, path)) choose(path)
      send({ type: 'cms:builder:add', place: { end: true, in: path } })
    })
    return b
  })
  empty.forEach((n, i) => {
    const b = ui!.empties[i]!
    ;(b as any).__path = n.path
    b.innerHTML = `${svg(ICONS.plus)}<span>${escapeHtml(words?.addBlock ?? words?.insertHere ?? '+')}</span>`
    const r = rectOf(n)
    b.style.left = `${r.left + r.width / 2 - host.left}px`
    b.style.top = `${r.top + r.height / 2 - host.top}px`
  })
}

/** A left edge (viewport px) that keeps something `width` wide inside the page, so the tools never make it scroll sideways. */
const inPage = (left: number, width: number) => Math.min(Math.max(left, 2), document.documentElement.clientWidth - width - 2)

const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`)

/** Where the dragged block lands: in its own list of one line, the edge it settles against; else the nearest gap; in an empty list, the list itself. */
function drawDrop(host: DOMRect) {
  if (!ui) return
  ui.drop.hidden = ui.into.hidden = ui.from.hidden = ui.cell.hidden = true
  if (!drag) return
  const d = drag
  const at = (b: Box) => ({ left: b.left - scrollX, top: b.top - scrollY, width: b.right - b.left, height: b.bottom - b.top })
  // Another list takes the block: its outline lights (a group, a layout), with the line inside it.
  if (d.into !== d.own && d.into.area) {
    place(ui.into, host, at(d.into.area))
    if (!d.into.items.length) return
  }
  // A grid: the cell it lands in. A wrapping row of blocks of other sizes: where it came from.
  if (d.into === d.own && !d.own.single) {
    if (d.cells) {
      if (d.index !== d.from) place(ui.cell, host, at(d.own.boxes[d.index]!))
      return
    }
    place(ui.from, host, at(d.own.boxes[d.from]!))
  }
  if (d.into === d.own && d.own.single) {
    if (d.index === d.from) return
    const others = d.own.boxes.filter((_, i) => i !== d.from)
    const all = d.own.boxes
    const x = d.own.axis === 'x'
    const edge = d.index > d.from ? (x ? others[d.index - 1]!.right : others[d.index - 1]!.bottom) : (x ? others[d.index]!.left : others[d.index]!.top)
    const from = x ? Math.min(...all.map((b) => b.top)) : Math.min(...all.map((b) => b.left))
    const to = x ? Math.max(...all.map((b) => b.bottom)) : Math.max(...all.map((b) => b.right))
    const t = 3 * k()
    if (x) place(ui.drop, host, { left: edge - scrollX - t / 2, top: from - scrollY, width: t, height: to - from })
    else place(ui.drop, host, { left: from - scrollX, top: edge - scrollY - t / 2, width: to - from, height: t })
    return
  }
  const s = d.slot
  if (!s || (d.into === d.own && d.index === d.from)) return
  const t = 3 * k()
  if (s.x1 === s.x2) place(ui.drop, host, { left: s.x1 - scrollX - t / 2, top: s.y1 - scrollY, width: t, height: s.y2 - s.y1 })
  else place(ui.drop, host, { left: s.x1 - scrollX, top: s.y1 - scrollY - t / 2, width: s.x2 - s.x1, height: t })
}

/** Observe the marked blocks (and only them) for a change of size. */
function watchBlocks() {
  const els = new Set(nodes.flatMap((n) => n.els))
  for (const el of observed) if (!els.has(el as HTMLElement)) { sizes.unobserve(el); observed.delete(el) }
  for (const el of els) if (!observed.has(el)) { sizes.observe(el); observed.add(el) }
}

const sizes = new ResizeObserver(() => {
  textCache = null
  schedule()
})

// ---- pointer: hover, "+", select

function track(e: PointerEvent) {
  if (press || e.composedPath().includes(ui!.host)) return
  hover = nodeOf(e.composedPath()[0] as Node)
  plus = plusNear(e.clientX, e.clientY)
  schedule()
}

/** The "+" between two blocks of the page's list, near the pointer. */
function plusNear(x: number, y: number) {
  const top = nodes.filter((n) => !n.parent)
  for (const list of new Set(top.map((n) => n.list))) {
    const items = top.filter((n) => n.list === list)
    const { left, right } = listSpan(items)
    if (x < left || x > right) continue
    const at = nearestBoundary(y, boundaries(items), 24 * k())
    if (at !== null) return { list, after: items[at]!.id }
  }
  return null
}

function choose(path: CmsBuilderPath | null) {
  selected = path
  send(path ? { type: 'cms:builder:select', id: path[path.length - 1]!, path } : { type: 'cms:builder:select', id: null })
  schedule()
}

function onClick(e: MouseEvent) {
  if (e.composedPath().includes(ui!.host)) return
  e.preventDefault()
  e.stopImmediatePropagation()
  if (calledOff && performance.now() - calledOff < 400) {
    calledOff = 0
    return
  }
  nodes = scan()
  const node = nodeOf(e.composedPath()[0] as Node)
  if (!node) return choose(null)
  const chain = chainOf(node)
  const current = nodeAt(selected)
  choose(chain[selectDepth(chain.map((n) => n.id), current?.path ?? null)]!.path)
}

function stop(e: Event) {
  if (e.composedPath().includes(ui!.host)) return
  e.preventDefault()
  e.stopImmediatePropagation()
}

// ---- toolbar actions

function selectedNode() {
  nodes = scan()
  return nodeAt(selected)
}

/** Move the selected block one place back (-1) or on (1) within its list. */
function step(direction: -1 | 1) {
  const node = selectedNode()
  if (!node || holding) return
  const items = siblingsOf(node)
  const neighbour = items[items.indexOf(node) + direction]
  if (!neighbour) return
  const at = node.parent ? { in: node.parent.path } : {}
  send({ type: 'cms:builder:move', id: node.id, path: node.path, place: direction < 0 ? { before: neighbour.id, ...at } : { after: neighbour.id, ...at } })
}

function act(type: 'cms:builder:duplicate' | 'cms:builder:remove') {
  const node = selectedNode()
  if (!node || holding) return
  send({ type, id: node.id, path: node.path })
  // Nothing is selected after a delete: the toolbar never stays on the block around it.
  if (type === 'cms:builder:remove') choose(null)
}

function key(name: CmsBuilderKey | string, alt: boolean): boolean {
  if (name === 'Escape') {
    if (press) {
      // The button is still down: its release makes a click on the page, which is not one of the person's.
      window.addEventListener('pointerup', () => { calledOff = performance.now() }, { once: true, capture: true })
      cancelDrag()
    }
    else if (selected !== null) {
      const node = selectedNode()
      choose(node?.parent ? node.parent.path : null)
    }
    else return false
    return true
  }
  if (!alt || !selected) return false
  if (name === 'ArrowUp' || name === 'ArrowLeft') step(-1)
  else if (name === 'ArrowDown' || name === 'ArrowRight') step(1)
  else return false
  return true
}

/** Ctrl/⌘ Z (undo), Ctrl/⌘ ⇧ Z and Ctrl Y (redo), pressed in the page outside a text field: the admin keeps the history. */
function historyKey(e: KeyboardEvent): 'undo' | 'redo' | null {
  if (!(e.metaKey || e.ctrlKey) || e.altKey) return null
  const name = e.key.toLowerCase()
  const action = name === 'z' ? (e.shiftKey ? 'redo' : 'undo') : name === 'y' && e.ctrlKey && !e.metaKey ? 'redo' : null
  if (!action) return null
  const target = e.composedPath()[0]
  if (target instanceof Element && target.closest('input, textarea, select, [contenteditable=""], [contenteditable="true"]')) return null
  return action
}

function onKey(e: KeyboardEvent) {
  const action = historyKey(e)
  if (action) {
    e.preventDefault()
    if (!drag && !press) send({ type: 'cms:builder:history', action })
    return
  }
  if (key(e.key, e.altKey) && e.key !== 'Escape') e.preventDefault()
}

// ---- drag to reorder, and to another list

function startPress(e: PointerEvent) {
  const node = selectedNode()
  if (!node || holding || e.button !== 0) return
  e.preventDefault()
  press = { pointerId: e.pointerId, startX: e.clientX, startY: e.clientY, node }
  ui!.handle.setPointerCapture(e.pointerId)
  window.addEventListener('pointermove', movePress)
  window.addEventListener('pointerup', endPress)
  window.addEventListener('pointercancel', cancelDrag)
}

function movePress(e: PointerEvent) {
  if (!press || e.pointerId !== press.pointerId) return
  if (!drag) {
    if (Math.hypot(e.clientX - press.startX, e.clientY - press.startY) <= DRAG_START * k()) return
    beginDrag(press.node, press.startX, press.startY)
  }
  drag!.lastX = e.clientX
  drag!.lastY = e.clientY
  updateDrag()
}

/** A list as it stands now: its blocks' boxes, its direction and its places. */
function geoOf(container: BNode | null, items: BNode[]): ListGeo {
  const boxes = items.map(boxOf)
  const axis = axisOfList(items, boxes, container)
  return {
    container, path: container?.path ?? [], items, boxes, axis, single: oneLine(boxes, axis), slots: slotsOf(boxes, axis),
    area: container ? boxOf(container) : null, depth: container?.path.length ?? 0,
  }
}

/** The other lists a block may be dragged into: inside a section, the lists that take its type (the same definition) and have room. */
function candidatesFor(node: BNode): ListGeo[] {
  const kind = kindOf(node)
  if (!node.parent || !kind) return []
  const inside = (n: BNode) => n.path.length >= node.path.length && node.path.every((id, i) => n.path[i] === id)
  return nodes.filter((n) => {
    if (n === node.parent || inside(n)) return false
    const list = listKindsOf(n)
    const theirs = list?.types[node.type]
    return !!list && !!theirs && theirs.sig === kind.sig && (list.max === null || childrenOf(n).length < list.max)
  }).map((n) => geoOf(n, childrenOf(n)))
}

function beginDrag(node: BNode, x: number, y: number) {
  const items = siblingsOf(node)
  const own = geoOf(node.parent, items)
  const from = items.indexOf(node)
  const gaps = own.boxes.slice(1).map((b, i) => (own.axis === 'x' ? b.left - own.boxes[i]!.right : b.top - own.boxes[i]!.bottom)).filter((g) => g >= 0)
  const box = own.boxes[from]!
  const styles = new Map(items.flatMap((n) => n.els).map((el) => [el, el.getAttribute('style')]))
  drag = {
    node, own, from, into: own, index: from, slot: null, candidates: candidatesFor(node), cells: !own.single && sameSizes(own.boxes), dwell: null,
    step: (own.axis === 'x' ? box.right - box.left : box.bottom - box.top) + (gaps.length ? Math.min(...gaps) : 0),
    // A block of the page's list moves up and down only, as the page's blocks stand; one inside a section follows the pointer.
    free: !!node.parent,
    startX: x, startY: y, startScroll: scrollY, lastX: x, lastY: y, styles,
    shrink: node.parent ? Math.min(1, (280 * k()) / Math.max(1, box.right - box.left), (220 * k()) / Math.max(1, box.bottom - box.top)) : 1,
  }
  const motion = reduced() ? 'none' : `transform 200ms ${EASE}`
  for (const n of items) for (const el of n.els) el.style.transition = n === node ? 'none' : motion
  for (const el of node.els) {
    el.style.boxShadow = '0 26px 50px -18px rgba(40,30,15,.42),0 0 0 1px rgba(40,30,15,.06)'
    el.style.zIndex = '1000'
    // Most blocks have no background of their own: lifted, they would show the others through them.
    if (transparent(getComputedStyle(el).backgroundColor)) el.style.backgroundColor = backgroundBehind(el)
    if (getComputedStyle(el).position === 'static') el.style.position = 'relative'
    // Smaller around the point it was taken by.
    if (drag.shrink < 1) {
      const r = el.getBoundingClientRect()
      el.style.transformOrigin = `${x - r.left}px ${y - r.top}px`
    }
  }
  hover = null
  plus = null
  scrollLoop()
}

const transparent = (color: string) => color === 'transparent' || /^rgba\(.*,\s*0\)$/.test(color)

/** The colour the page shows behind an element: the first ancestor with a background of its own. */
function backgroundBehind(el: HTMLElement): string {
  for (let at = el.parentElement; at; at = at.parentElement) {
    const color = getComputedStyle(at).backgroundColor
    if (!transparent(color)) return color
  }
  return '#fff'
}

const within = (b: Box, x: number, y: number) => x >= b.left && x <= b.right && y >= b.top && y <= b.bottom
function updateDrag() {
  const d = drag!
  // The block follows the pointer, but never out of the page (which would make it scroll sideways).
  const box = d.own.boxes[d.from]!
  const dx = d.free ? Math.min(Math.max(d.lastX - d.startX, -box.left + scrollX), document.documentElement.clientWidth + scrollX - box.right) : 0
  const dy = d.lastY - d.startY + scrollY - d.startScroll
  for (const el of d.node.els) el.style.transform = `translate(${dx}px, ${dy}px)${d.shrink < 1 ? ` scale(${d.shrink})` : ''}`
  const x = d.lastX + scrollX
  const y = d.lastY + scrollY
  // The deepest list under the pointer that takes the block (its own list among them); else its own list.
  // A group (a list inside a section) takes it only in its inner area, or after the pointer stayed over
  // it for a moment: near its edges the block lands before or after the group.
  const under = [d.own, ...d.candidates].filter((c) => c.area && within(c.area, x, y)).sort((a, b) => b.depth - a.depth)
  const group = under.find((c) => c !== d.own && c.depth > 1) ?? null
  if (group !== d.dwell?.list) d.dwell = group ? { list: group, since: performance.now() } : null
  const takes = (c: ListGeo) => c === d.own || c.depth <= 1 || within(innerArea(c.area!, 24 * k()), x, y) || (d.dwell?.list === c && performance.now() - d.dwell.since >= DWELL)
  const over = under.find(takes)
  d.into = over ?? d.own
  if (d.into === d.own) {
    d.slot = nearestSlot(d.own.slots, x, y)
    d.index = d.slot ? targetAmongOthers(d.slot.index, d.from) : d.from
  }
  else {
    d.slot = nearestSlot(d.into.slots, x, y)
    d.index = d.slot?.index ?? 0
  }
  // In its own list of one line the others make room; in a grid they close the gap and open one at the
  // target; anywhere else they stay and a line shows the place.
  const home = d.into === d.own
  if (home && d.cells) {
    const shifts = cellShifts(d.own.boxes, d.from, d.index)
    d.own.items.forEach((n, i) => {
      if (n === d.node) return
      const [sx, sy] = shifts[i]!
      for (const el of n.els) el.style.transform = sx || sy ? `translate(${sx}px, ${sy}px)` : ''
    })
    schedule()
    return
  }
  const shifting = home && d.own.single
  const target = shifting ? d.index : d.from
  d.own.items.forEach((n, i) => {
    if (n === d.node) return
    const shift = shiftFor(i, d.from, target, d.step)
    for (const el of n.els) el.style.transform = shift ? (d.own.axis === 'x' ? `translateX(${shift}px)` : `translateY(${shift}px)`) : ''
  })
  schedule()
}

/** Scroll the page while the pointer is near the top or bottom of the viewport, so a block can be carried further. */
function scrollLoop() {
  if (!drag) return
  const speed = edgeSpeed(drag.lastY, innerHeight, 60 * k(), 22 * k())
  if (speed) {
    window.scrollBy({ top: speed, behavior: 'instant' as ScrollBehavior })
    updateDrag()
  }
  // Waiting over a group: it takes the block once the moment has passed, without the pointer moving.
  else if (drag.dwell && drag.into !== drag.dwell.list && performance.now() - drag.dwell.since >= DWELL) updateDrag()
  requestAnimationFrame(scrollLoop)
}

function endPress() {
  const d = drag
  releasePress()
  if (!d) return
  drag = null
  const inside = d.node.parent ? { in: d.node.parent.path } : {}
  if (d.into === d.own) {
    const ids = d.own.items.map((n) => n.id)
    const where = dropPlace(ids, d.from, d.index)
    if (!where) return settleBack(d)
    send({ type: 'cms:builder:move', id: d.node.id, path: d.node.path, place: { ...where, ...inside } as CmsBuilderPlace })
    if (d.cells) {
      const to = d.own.boxes[d.index]!
      const fromBox = d.own.boxes[d.from]!
      for (const el of d.node.els) {
        el.style.transition = reduced() ? 'none' : `transform 200ms ${EASE}`
        el.style.transform = `translate(${to.left - fromBox.left}px, ${to.top - fromBox.top}px)`
      }
    }
    else if (d.own.single) {
      // Carry the block to the place it lands on, then wait for the page to draw the new order.
      const others = d.own.boxes.filter((_, i) => i !== d.from)
      const x = d.own.axis === 'x'
      const end = (b: Box) => (x ? b.right : b.bottom)
      const start = (b: Box) => (x ? b.left : b.top)
      const by = d.index > d.from ? end(others[d.index - 1]!) - end(d.own.boxes[d.from]!) : start(others[d.index]!) - start(d.own.boxes[d.from]!)
      for (const el of d.node.els) {
        el.style.transition = reduced() ? 'none' : `transform 200ms ${EASE}`
        el.style.transform = x ? `translate(${by}px, 0px)` : `translate(0px, ${by}px)`
      }
    }
    const expected = droppedOrder(ids, d.from, d.index).join()
    settle(d, (done) => redrawn(() => {
      const now = nodes.length ? scanSiblings(d.node) : []
      return now.join() === expected
    }, done))
  }
  else {
    const ids = d.into.items.map((n) => n.id)
    const place = placeInList(ids, d.index, d.into.path)
    send({ type: 'cms:builder:move', id: d.node.id, path: d.node.path, place })
    const path = [...d.into.path, d.node.id]
    selected = path
    settle(d, (done) => redrawn(() => scan().some((n) => samePath(n.path, path)), done))
  }
  schedule()
}

/** The ids of a block's list as the page draws them now. */
function scanSiblings(node: BNode): string[] {
  const fresh = scan()
  const parentKey = node.parent?.key ?? null
  return fresh.filter((n) => (n.parent?.key ?? null) === parentKey && n.list === node.list).map((n) => n.id)
}

/** Call `done` once the page has redrawn so that `ready()` holds. */
function redrawn(ready: () => boolean, done: () => void): () => void {
  const observer = new MutationObserver(() => { if (ready()) done() })
  observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-cms-block'] })
  return () => observer.disconnect()
}

function cancelDrag() {
  const d = drag
  releasePress()
  drag = null
  if (d) settleBack(d)
  schedule()
}

function releasePress() {
  if (press && ui!.handle.hasPointerCapture(press.pointerId)) ui!.handle.releasePointerCapture(press.pointerId)
  press = null
  window.removeEventListener('pointermove', movePress)
  window.removeEventListener('pointerup', endPress)
  window.removeEventListener('pointercancel', cancelDrag)
}

/** Everything animates back to where it was, then the page's own styles are restored. */
function settleBack(d: Drag) {
  const moved = d.node.els.some((el) => el.style.transform !== 'translate(0px, 0px)' && el.style.transform !== '')
  for (const el of d.node.els) {
    el.style.transition = reduced() ? 'none' : `transform 200ms ${EASE}`
    el.style.transform = 'translate(0px, 0px)'
  }
  for (const n of d.own.items) if (n !== d.node) for (const el of n.els) el.style.transform = ''
  const first = d.node.els[0]!
  settle(d, (done) => {
    if (!moved || reduced()) { done(); return () => {} }
    const ended = (e: TransitionEvent) => { if (e.target === first) done() }
    first.addEventListener('transitionend', ended)
    return () => first.removeEventListener('transitionend', ended)
  })
  schedule()
}

/** Hold the dragged block's look until `trigger` calls done (or a fallback), then give every inline style back exactly. */
function settle(d: Drag, trigger: (done: () => void) => () => void) {
  holding = true
  let over = false
  let cleanup = () => {}
  const timer = setTimeout(() => done(), FALLBACK_MS)
  function done() {
    if (over) return
    over = true
    clearTimeout(timer)
    cleanup()
    for (const [el, style] of d.styles) {
      if (style === null) el.removeAttribute('style')
      else el.setAttribute('style', style)
    }
    holding = false
    schedule()
  }
  cleanup = trigger(done)
  if (over) cleanup()
}

// ---- the layer

const ICONS = {
  grip: '<circle cx="9" cy="12" r="1"/><circle cx="9" cy="5" r="1"/><circle cx="9" cy="19" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="15" cy="5" r="1"/><circle cx="15" cy="19" r="1"/>',
  up: '<path d="m5 12 7-7 7 7"/><path d="M12 19V5"/>',
  down: '<path d="M12 5v14"/><path d="m19 12-7 7-7-7"/>',
  left: '<path d="m12 19-7-7 7-7"/><path d="M19 12H5"/>',
  right: '<path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>',
  copy: '<rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>',
  trash: '<path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/>',
  plus: '<path d="M5 12h14"/><path d="M12 5v14"/>',
}
const svg = (icon: string) => `<svg viewBox="0 0 24 24" aria-hidden="true">${icon}</svg>`

const STYLE = `
:host{--k:1}
*{box-sizing:border-box}
[hidden]{display:none!important}
.o{position:absolute;pointer-events:none;border-radius:calc(3px * var(--k))}
.hover{outline:calc(1.5px * var(--k)) solid rgba(47,98,214,.5);outline-offset:calc(-1.5px * var(--k))}
.hover.sub{outline:calc(1px * var(--k)) dashed rgba(47,98,214,.6);outline-offset:calc(-1px * var(--k))}
.sel{outline:calc(2px * var(--k)) solid #2f62d6;outline-offset:calc(-2px * var(--k))}
.sel.sub{outline:calc(1.5px * var(--k)) solid #6b93ea;outline-offset:calc(-1.5px * var(--k))}
.ctx{outline:calc(1px * var(--k)) dashed rgba(47,98,214,.38);outline-offset:calc(-1px * var(--k))}
.into{border-radius:calc(6px * var(--k));background:rgba(47,98,214,.07);outline:calc(2px * var(--k)) solid #2f62d6;outline-offset:calc(-2px * var(--k));transition:opacity 150ms ease-out}
.from{border-radius:calc(6px * var(--k));background:repeating-linear-gradient(135deg,rgba(47,98,214,.07) 0 calc(6px * var(--k)),rgba(47,98,214,.02) calc(6px * var(--k)) calc(12px * var(--k)));outline:calc(1.5px * var(--k)) dashed rgba(47,98,214,.55);outline-offset:calc(-1.5px * var(--k))}
.cell{border-radius:calc(6px * var(--k));background:rgba(47,98,214,.06);outline:calc(2px * var(--k)) dashed #2f62d6;outline-offset:calc(-2px * var(--k))}
.chip,.bar,.add{transform-origin:0 0;transform:scale(var(--k))}
.chip{position:absolute;z-index:1;pointer-events:none;background:#fff;color:#2f62d6;font:600 11px/20px system-ui,sans-serif;border-radius:6px;padding:0 7px;white-space:nowrap;box-shadow:0 0 0 1px rgba(47,98,214,.35),0 2px 6px rgba(0,0,0,.08)}
.bar{position:absolute;z-index:2;pointer-events:auto;display:flex;align-items:center;gap:1px;height:30px;padding:0 3px;border-radius:9px;background:#1f1e1c;color:#f3f1ec;box-shadow:0 6px 18px -6px rgba(0,0,0,.4)}
.name{font:600 11.5px/1 system-ui,sans-serif;padding:0 8px;white-space:nowrap}
.rule{width:1px;height:16px;margin:0 3px;background:rgba(255,255,255,.2)}
.tool{display:grid;place-items:center;width:26px;height:24px;padding:0;border:0;border-radius:6px;background:none;color:inherit;cursor:pointer;transition:background-color 150ms ease-out}
.tool:hover:not(:disabled){background:rgba(255,255,255,.16)}
.tool:disabled{opacity:.35;cursor:default}
.tool:focus-visible,.add:focus-visible,.empty:focus-visible{outline:2px solid #8fb0f5;outline-offset:1px}
.tool.grab{cursor:grab;touch-action:none}
.tool.grab:active{cursor:grabbing}
svg{width:15px;height:15px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
.line{position:absolute;pointer-events:none;border-top:calc(1.5px * var(--k)) dashed #2f62d6}
.add{position:absolute;pointer-events:auto;display:grid;place-items:center;width:26px;height:26px;padding:0;border-radius:50%;border:1px solid rgba(47,98,214,.5);background:#fff;color:#2f62d6;cursor:pointer;box-shadow:0 2px 8px rgba(0,0,0,.14);transition:background-color 150ms ease-out,color 150ms ease-out,transform 150ms ease-out}
.add.small{width:24px;height:24px}
.add.small svg{width:13px;height:13px}
.add:hover{background:#2f62d6;color:#fff;transform:scale(calc(var(--k) * 1.08))}
.empty{position:absolute;pointer-events:auto;transform:translate(-50%,-50%) scale(var(--k));display:inline-flex;align-items:center;gap:6px;height:30px;padding:0 12px 0 9px;border-radius:999px;border:1px solid rgba(47,98,214,.45);background:#fff;color:#2f62d6;font:600 12px/1 system-ui,sans-serif;white-space:nowrap;cursor:pointer;box-shadow:0 2px 8px rgba(0,0,0,.1);transition:background-color 150ms ease-out,color 150ms ease-out}
.empty:hover{background:#2f62d6;color:#fff}
.empty svg{width:14px;height:14px}
.drop{position:absolute;pointer-events:none;border-radius:calc(3px * var(--k));background:#2f62d6;box-shadow:0 0 0 calc(2px * var(--k)) rgba(255,255,255,.75)}
@media (prefers-reduced-motion:reduce){*{transition:none!important}}
`

function make<K extends keyof HTMLElementTagNameMap>(tag: K, className: string, parent: Node, text?: string): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag)
  el.className = className
  if (text) el.textContent = text
  parent.appendChild(el)
  return el
}

function tool(parent: Node, icon: string, className: string): HTMLButtonElement {
  const button = make('button', className, parent)
  button.type = 'button'
  button.innerHTML = svg(icon)
  return button
}

function label(button: HTMLButtonElement, word: string | undefined) {
  if (!word) return
  button.setAttribute('aria-label', word)
  button.title = word
}

function build(): Ui {
  const host = document.createElement('div')
  host.style.cssText = 'position:absolute;left:0;top:0;width:0;height:0;z-index:2147483000;pointer-events:none'
  const root = host.attachShadow({ mode: 'open' })
  make('style', '', root, STYLE)
  const context = make('div', 'o ctx', root)
  const hoverBox = make('div', 'o hover', root)
  const box = make('div', 'o sel', root)
  const from = make('div', 'o from', root)
  const cell = make('div', 'o cell', root)
  const into = make('div', 'o into', root)
  const drop = make('div', 'drop', root)
  const line = make('div', 'line', root)
  const chip = make('div', 'chip', root)
  const bar = make('div', 'bar', root)
  const handle = tool(bar, ICONS.grip, 'tool grab')
  const name = make('span', 'name', bar)
  make('span', 'rule', bar)
  const prev = tool(bar, ICONS.up, 'tool')
  const next = tool(bar, ICONS.down, 'tool')
  const duplicate = tool(bar, ICONS.copy, 'tool')
  const remove = tool(bar, ICONS.trash, 'tool')
  const add = tool(root, ICONS.plus, 'add')
  for (const el of [context, hoverBox, chip, box, into, from, cell, drop, line, bar, add]) el.hidden = true
  document.body.appendChild(host)
  handle.addEventListener('pointerdown', startPress)
  prev.addEventListener('click', () => step(-1))
  next.addEventListener('click', () => step(1))
  duplicate.addEventListener('click', () => act('cms:builder:duplicate'))
  remove.addEventListener('click', () => act('cms:builder:remove'))
  add.addEventListener('click', () => { if (plus) send({ type: 'cms:builder:add', place: { after: plus.after } }) })
  return { host, root, hover: hoverBox, chip, context, box, bar, name, prev, next, duplicate, remove, handle, line, add, drop, into, from, cell, adds: [], empties: [] }
}

function start() {
  ui = build()
  window.addEventListener('click', onClick, true)
  window.addEventListener('submit', stop, true)
  window.addEventListener('pointermove', track)
  window.addEventListener('pointerdown', track)
  window.addEventListener('keydown', onKey)
  window.addEventListener('resize', () => {
    keepInView = true
    schedule()
  })
  document.documentElement.addEventListener('pointerleave', () => { hover = null; plus = null; schedule() })
  sizes.observe(document.documentElement)
  new MutationObserver(() => {
    textCache = null
    for (const mark of cmsBuilderMarkers) mark()
    schedule()
  }).observe(document.body, { childList: true, subtree: true })
}

function setTexts(t: CmsBuilderTexts) {
  words = t
  label(ui!.handle, t.drag)
  label(ui!.duplicate, t.duplicate)
  label(ui!.remove, t.remove)
  label(ui!.add, t.insertHere)
}

/** The admin's messages: switch the tool on (once), keep what it says about the selection, take a key pressed in the admin. */
export function handleCmsBuilderMessage(message: CmsBuilderToPage) {
  if (message.type === 'cms:builder:on') {
    if (!ui) start()
    labels = message.labels
    kinds = message.lists ?? null
    setTexts(message.texts)
    selected = message.selectedPath ?? (message.selected === null ? null : [message.selected])
    if (message.scale) scale = message.scale
  }
  else if (message.type === 'cms:builder:view') {
    scale = message.scale
  }
  else if (message.type === 'cms:builder:select') {
    if (!ui) return
    selected = message.id === null ? null : message.path ?? [message.id]
    scrollToSelected = message.scroll && message.id !== null
  }
  else {
    if (!ui) return
    key(message.key, message.key !== 'Escape')
  }
  schedule()
}
