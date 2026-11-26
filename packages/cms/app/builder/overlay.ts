// The editor in the preview, drawn over the site's page: hover names, a selected block with its
// toolbar, "+" between blocks and drag to reorder. Plain DOM in a shadow root, so the site's
// CSS and the tool's cannot touch each other. It changes nothing in the page but the marked
// blocks' transforms while one is dragged, and it only reports what the owner did: the admin
// decides, changes the content and the page redraws (see shared/builder.ts for the messages).
// Loaded on the first `cms:builder:on` only (plugins/cmsLivePreview.client.ts).
import type { CmsBuilderTexts, CmsBuilderToAdmin, CmsBuilderToPage } from '../../shared/builder'
import { cmsBuilderMarkers } from './state'
import { dropPlace, droppedOrder, edgeSpeed, nearestBoundary, shiftFor, targetIndex } from './geometry'

const BLOCK = '[data-cms-block]'
const EASE = 'cubic-bezier(.2,.7,.2,1)'
const DRAG_START = 4
const FALLBACK_MS = 2000

let labels: Record<string, string> = {}
let selected: string | null = null
let scrollToSelected = false
let hover: HTMLElement | null = null
let plus: { list: string, after: string } | null = null
let press: { pointerId: number, startY: number, el: HTMLElement } | null = null
let drag: Drag | null = null
let holding = false
let frame = 0
let ui: Ui | null = null
const observed = new Set<Element>()

interface Ui {
  host: HTMLElement
  hover: HTMLElement
  chip: HTMLElement
  box: HTMLElement
  bar: HTMLElement
  name: HTMLElement
  up: HTMLButtonElement
  down: HTMLButtonElement
  duplicate: HTMLButtonElement
  remove: HTMLButtonElement
  handle: HTMLButtonElement
  line: HTMLElement
  add: HTMLButtonElement
  drop: HTMLElement
}

interface Drag {
  el: HTMLElement
  id: string
  list: string
  items: HTMLElement[]
  ids: string[]
  from: number
  target: number
  top: number[]
  bottom: number[]
  mids: number[]
  step: number
  startY: number
  startScroll: number
  lastY: number
  styles: Map<HTMLElement, string | null>
}

const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches
const send = (message: CmsBuilderToAdmin) => window.parent.postMessage(message, location.origin)

// ---- the blocks of the page

/** The marked blocks that are not inside another marked block, in document order. */
function topBlocks(): HTMLElement[] {
  return [...document.querySelectorAll<HTMLElement>(BLOCK)].filter((el) => !el.parentElement?.closest(BLOCK))
}

function topBlockOf(node: Node | null): HTMLElement | null {
  let block = (node instanceof Element ? node : node?.parentElement)?.closest<HTMLElement>(BLOCK) ?? null
  while (block?.parentElement?.closest(BLOCK)) block = block.parentElement.closest<HTMLElement>(BLOCK)
  return block
}

const listOf = (el: HTMLElement) => el.dataset.cmsBlockList ?? ''
const idOf = (el: HTMLElement) => el.dataset.cmsBlock ?? ''
const nameOf = (el: HTMLElement) => labels[el.dataset.cmsBlockType ?? ''] ?? el.dataset.cmsBlockType ?? ''
const blocksOfList = (list: string) => topBlocks().filter((el) => listOf(el) === list)

/** The left and right edge (viewport px) of a list's blocks together. */
function listSpan(items: HTMLElement[]) {
  const rects = items.map((el) => el.getBoundingClientRect())
  return { left: Math.min(...rects.map((r) => r.left)), right: Math.max(...rects.map((r) => r.right)) }
}

/** Where "+" sits after each block: the middle of the gap to the next block, or the last block's bottom edge. */
function boundaries(items: HTMLElement[]): number[] {
  const rects = items.map((el) => el.getBoundingClientRect())
  return rects.map((r, i) => (rects[i + 1] ? (r.bottom + rects[i + 1]!.top) / 2 : r.bottom))
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

/** Above the block's top edge, or inside it when the page has no room above (near its top). */
function above(el: HTMLElement, host: DOMRect, rect: DOMRect, height: number) {
  const top = rect.top - host.top
  el.hidden = false
  el.style.left = `${Math.max(rect.left - host.left, 4)}px`
  el.style.top = `${top >= height + 6 ? top - height - 6 : top + 6}px`
}

function render() {
  frame = 0
  if (!ui) return
  const host = ui.host.getBoundingClientRect()
  const blocks = topBlocks()
  watchBlocks(blocks)
  const current = blocks.find((el) => idOf(el) === selected) ?? null
  drawSelection(current, blocks, host)
  drawHover(current, host)
  drawPlus(host)
  drawDrop(host)
  if (current && scrollToSelected) {
    scrollToSelected = false
    // Only this page scrolls: scrollIntoView would scroll the admin around the frame too.
    const r = current.getBoundingClientRect()
    const top = r.height < innerHeight ? r.top + scrollY - (innerHeight - r.height) / 2 : r.top + scrollY - 24
    window.scrollTo({ top: Math.max(0, top), behavior: reduced() ? 'auto' : 'smooth' })
  }
}

function drawSelection(current: HTMLElement | null, blocks: HTMLElement[], host: DOMRect) {
  if (!ui) return
  ui.box.hidden = ui.bar.hidden = true
  if (!current) return
  const rect = current.getBoundingClientRect()
  place(ui.box, host, rect)
  if (drag) return
  const list = blocks.filter((el) => listOf(el) === listOf(current))
  const at = list.indexOf(current)
  ui.name.textContent = nameOf(current)
  ui.up.disabled = at <= 0
  ui.down.disabled = at >= list.length - 1
  above(ui.bar, host, rect, 30)
}

function drawHover(current: HTMLElement | null, host: DOMRect) {
  if (!ui) return
  ui.hover.hidden = ui.chip.hidden = true
  if (hover && !hover.isConnected) hover = null
  if (!hover || hover === current || drag) return
  const rect = hover.getBoundingClientRect()
  place(ui.hover, host, rect)
  ui.chip.textContent = nameOf(hover)
  above(ui.chip, host, rect, 20)
}

function drawPlus(host: DOMRect) {
  if (!ui) return
  ui.add.hidden = ui.line.hidden = true
  if (!plus || drag) return
  const items = blocksOfList(plus.list)
  const at = items.findIndex((el) => idOf(el) === plus!.after)
  if (at < 0) return
  const y = boundaries(items)[at]!
  const { left, right } = listSpan(items)
  place(ui.line, host, { left, top: y, width: right - left, height: 0 })
  ui.add.hidden = false
  ui.add.style.left = `${(left + right) / 2 - 13 - host.left}px`
  ui.add.style.top = `${y - 13 - host.top}px`
}

/** The drop line at the edge the dragged block would settle against. */
function drawDrop(host: DOMRect) {
  if (!ui) return
  ui.drop.hidden = true
  if (!drag || drag.target === drag.from) return
  const others = drag.items.filter((_, i) => i !== drag!.from)
  const edge = drag.target > drag.from ? drag.bottom[drag.items.indexOf(others[drag.target - 1]!)]! : drag.top[drag.items.indexOf(others[drag.target]!)]!
  const { left, right } = listSpan(drag.items)
  place(ui.drop, host, { left, top: edge - window.scrollY - 1.5, width: right - left, height: 3 })
}

/** Observe the marked blocks (and only them) for a change of size. */
function watchBlocks(blocks: HTMLElement[]) {
  for (const el of observed) if (!blocks.includes(el as HTMLElement)) { sizes.unobserve(el); observed.delete(el) }
  for (const el of blocks) if (!observed.has(el)) { sizes.observe(el); observed.add(el) }
}

const sizes = new ResizeObserver(schedule)

// ---- pointer: hover, "+", select

function track(e: PointerEvent) {
  if (press || e.composedPath().includes(ui!.host)) return
  const target = e.composedPath()[0] as Node
  hover = topBlockOf(target)
  plus = plusNear(e.clientX, e.clientY)
  schedule()
}

function plusNear(x: number, y: number) {
  const blocks = topBlocks()
  for (const list of new Set(blocks.map(listOf))) {
    const items = blocks.filter((el) => listOf(el) === list)
    const { left, right } = listSpan(items)
    if (x < left || x > right) continue
    const at = nearestBoundary(y, boundaries(items))
    if (at !== null) return { list, after: idOf(items[at]!) }
  }
  return null
}

function choose(id: string | null) {
  selected = id
  send({ type: 'cms:builder:select', id })
  schedule()
}

function onClick(e: MouseEvent) {
  if (e.composedPath().includes(ui!.host)) return
  e.preventDefault()
  e.stopImmediatePropagation()
  const block = topBlockOf(e.composedPath()[0] as Node)
  choose(block ? idOf(block) : null)
}

function stop(e: Event) {
  if (e.composedPath().includes(ui!.host)) return
  e.preventDefault()
  e.stopImmediatePropagation()
}

// ---- toolbar actions

function selectedBlock() {
  return topBlocks().find((el) => idOf(el) === selected) ?? null
}

/** Move the selected block one place up (-1) or down (1) within its list. */
function step(direction: -1 | 1) {
  const el = selectedBlock()
  if (!el || holding) return
  const items = blocksOfList(listOf(el))
  const neighbour = items[items.indexOf(el) + direction]
  if (!neighbour) return
  send({ type: 'cms:builder:move', id: idOf(el), place: direction < 0 ? { before: idOf(neighbour) } : { after: idOf(neighbour) } })
}

function act(type: 'cms:builder:duplicate' | 'cms:builder:remove') {
  if (selected && !holding) send({ type, id: selected })
}

function onKey(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    if (press) cancelDrag()
    else if (selected !== null) choose(null)
  } else if (e.altKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown') && selected) {
    e.preventDefault()
    step(e.key === 'ArrowUp' ? -1 : 1)
  }
}

// ---- drag to reorder

function startPress(e: PointerEvent) {
  const el = selectedBlock()
  if (!el || holding || e.button !== 0) return
  e.preventDefault()
  press = { pointerId: e.pointerId, startY: e.clientY, el }
  ui!.handle.setPointerCapture(e.pointerId)
  window.addEventListener('pointermove', movePress)
  window.addEventListener('pointerup', endPress)
  window.addEventListener('pointercancel', cancelDrag)
}

function movePress(e: PointerEvent) {
  if (!press || e.pointerId !== press.pointerId) return
  if (!drag) {
    if (Math.abs(e.clientY - press.startY) <= DRAG_START) return
    beginDrag(press.el, e.clientY)
  }
  drag!.lastY = e.clientY
  updateDrag()
}

function beginDrag(el: HTMLElement, y: number) {
  const list = listOf(el)
  const items = blocksOfList(list)
  const from = items.indexOf(el)
  const rects = items.map((b) => b.getBoundingClientRect())
  const top = rects.map((r) => r.top + window.scrollY)
  const bottom = rects.map((r) => r.bottom + window.scrollY)
  const neighbour = rects[from + 1] ? from : from - 1
  const gap = neighbour >= 0 && rects[neighbour + 1] ? rects[neighbour + 1]!.top - rects[neighbour]!.bottom : 0
  const styles = new Map(items.map((b) => [b, b.getAttribute('style')]))
  drag = {
    el, id: idOf(el), list, items, ids: items.map(idOf), from, target: from, top, bottom, step: rects[from]!.height + Math.max(0, gap),
    mids: items.map((_, i) => (top[i]! + bottom[i]!) / 2).filter((_, i) => i !== from),
    startY: y, startScroll: window.scrollY, lastY: y, styles,
  }
  const motion = reduced() ? 'none' : `transform 200ms ${EASE}`
  for (const b of items) b.style.transition = b === el ? 'none' : motion
  el.style.boxShadow = '0 26px 50px -18px rgba(40,30,15,.42),0 0 0 1px rgba(40,30,15,.06)'
  el.style.zIndex = '1000'
  // Most blocks have no background of their own: lifted, they would show the others through them.
  if (transparent(getComputedStyle(el).backgroundColor)) el.style.backgroundColor = backgroundBehind(el)
  if (getComputedStyle(el).position === 'static') el.style.position = 'relative'
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

function updateDrag() {
  const d = drag!
  const dy = d.lastY - d.startY + window.scrollY - d.startScroll
  d.el.style.transform = `translateY(${dy}px)`
  d.target = targetIndex(d.lastY + window.scrollY, d.mids)
  d.items.forEach((b, i) => {
    const shift = shiftFor(i, d.from, d.target, d.step)
    if (i !== d.from) b.style.transform = shift ? `translateY(${shift}px)` : ''
  })
  schedule()
}

/** Scroll the page while the pointer is near the top or bottom of the viewport, so a block can be carried further. */
function scrollLoop() {
  if (!drag) return
  const speed = edgeSpeed(drag.lastY, innerHeight)
  if (speed) {
    window.scrollBy({ top: speed, behavior: 'instant' as ScrollBehavior })
    updateDrag()
  }
  requestAnimationFrame(scrollLoop)
}

function endPress() {
  const d = drag
  releasePress()
  if (!d) return
  drag = null
  const where = dropPlace(d.ids, d.from, d.target)
  if (!where) return settleBack(d)
  send({ type: 'cms:builder:move', id: d.id, place: where })
  const others = d.items.filter((_, i) => i !== d.from)
  const dy = d.target > d.from
    ? d.bottom[d.items.indexOf(others[d.target - 1]!)]! - d.bottom[d.from]!
    : d.top[d.items.indexOf(others[d.target]!)]! - d.top[d.from]!
  d.el.style.transition = reduced() ? 'none' : `transform 200ms ${EASE}`
  d.el.style.transform = `translateY(${dy}px)`
  const expected = droppedOrder(d.ids, d.from, d.target)
  settle(d, (done) => {
    const redrawn = new MutationObserver(() => {
      if (blocksOfList(d.list).map(idOf).join() === expected.join()) done()
    })
    redrawn.observe(document.body, { childList: true, subtree: true })
    return () => redrawn.disconnect()
  })
  schedule()
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
  const moved = d.el.style.transform !== 'translateY(0px)' && d.el.style.transform !== ''
  d.el.style.transition = reduced() ? 'none' : `transform 200ms ${EASE}`
  d.el.style.transform = 'translateY(0px)'
  for (const b of d.items) if (b !== d.el) b.style.transform = ''
  settle(d, (done) => {
    if (!moved || reduced()) { done(); return () => {} }
    const ended = (e: TransitionEvent) => { if (e.target === d.el) done() }
    d.el.addEventListener('transitionend', ended)
    return () => d.el.removeEventListener('transitionend', ended)
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
  copy: '<rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>',
  trash: '<path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/>',
  plus: '<path d="M5 12h14"/><path d="M12 5v14"/>',
}

const STYLE = `
*{box-sizing:border-box}
[hidden]{display:none!important}
.o{position:absolute;pointer-events:none;border-radius:3px}
.hover{outline:1.5px solid rgba(47,98,214,.5);outline-offset:-1.5px}
.sel{outline:2px solid #2f62d6;outline-offset:-2px}
.chip{position:absolute;pointer-events:none;background:#fff;color:#2f62d6;font:600 11px/20px system-ui,sans-serif;border-radius:6px;padding:0 7px;white-space:nowrap;box-shadow:0 0 0 1px rgba(47,98,214,.35),0 2px 6px rgba(0,0,0,.08)}
.bar{position:absolute;pointer-events:auto;display:flex;align-items:center;gap:1px;height:30px;padding:0 3px;border-radius:9px;background:#1f1e1c;color:#f3f1ec;box-shadow:0 6px 18px -6px rgba(0,0,0,.4)}
.name{font:600 11.5px/1 system-ui,sans-serif;padding:0 8px;white-space:nowrap}
.rule{width:1px;height:16px;margin:0 3px;background:rgba(255,255,255,.2)}
.tool{display:grid;place-items:center;width:26px;height:24px;padding:0;border:0;border-radius:6px;background:none;color:inherit;cursor:pointer;transition:background-color 150ms ease-out}
.tool:hover:not(:disabled){background:rgba(255,255,255,.16)}
.tool:disabled{opacity:.35;cursor:default}
.tool.grab{cursor:grab;touch-action:none}
.tool.grab:active{cursor:grabbing}
svg{width:15px;height:15px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
.line{position:absolute;pointer-events:none;border-top:1.5px dashed #2f62d6}
.add{position:absolute;pointer-events:auto;display:grid;place-items:center;width:26px;height:26px;padding:0;border-radius:50%;border:1px solid rgba(47,98,214,.5);background:#fff;color:#2f62d6;cursor:pointer;box-shadow:0 2px 8px rgba(0,0,0,.14);transition:background-color 150ms ease-out,color 150ms ease-out,transform 150ms ease-out}
.add:hover{background:#2f62d6;color:#fff;transform:scale(1.08)}
.drop{position:absolute;pointer-events:none;height:3px;border-radius:3px;background:#2f62d6;box-shadow:0 0 0 2px rgba(255,255,255,.75)}
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
  button.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true">${icon}</svg>`
  return button
}

function build(): Ui {
  const host = document.createElement('div')
  host.style.cssText = 'position:absolute;left:0;top:0;width:0;height:0;z-index:2147483000;pointer-events:none'
  const root = host.attachShadow({ mode: 'open' })
  make('style', '', root, STYLE)
  const hoverBox = make('div', 'o hover', root)
  const chip = make('div', 'chip', root)
  const box = make('div', 'o sel', root)
  const drop = make('div', 'drop', root)
  const line = make('div', 'line', root)
  const bar = make('div', 'bar', root)
  const handle = tool(bar, ICONS.grip, 'tool grab')
  const name = make('span', 'name', bar)
  make('span', 'rule', bar)
  const up = tool(bar, ICONS.up, 'tool')
  const down = tool(bar, ICONS.down, 'tool')
  const duplicate = tool(bar, ICONS.copy, 'tool')
  const remove = tool(bar, ICONS.trash, 'tool')
  const add = tool(root, ICONS.plus, 'add')
  for (const el of [hoverBox, chip, box, drop, line, bar, add]) el.hidden = true
  document.body.appendChild(host)
  handle.addEventListener('pointerdown', startPress)
  up.addEventListener('click', () => step(-1))
  down.addEventListener('click', () => step(1))
  duplicate.addEventListener('click', () => act('cms:builder:duplicate'))
  remove.addEventListener('click', () => act('cms:builder:remove'))
  add.addEventListener('click', () => { if (plus) send({ type: 'cms:builder:add', place: { after: plus.after } }) })
  return { host, hover: hoverBox, chip, box, bar, name, up, down, duplicate, remove, handle, line, add, drop }
}

function start() {
  ui = build()
  window.addEventListener('click', onClick, true)
  window.addEventListener('submit', stop, true)
  window.addEventListener('pointermove', track)
  window.addEventListener('pointerdown', track)
  window.addEventListener('keydown', onKey)
  window.addEventListener('resize', schedule)
  document.documentElement.addEventListener('pointerleave', () => { hover = null; plus = null; schedule() })
  sizes.observe(document.documentElement)
  new MutationObserver(() => {
    for (const mark of cmsBuilderMarkers) mark()
    schedule()
  }).observe(document.body, { childList: true, subtree: true })
}

function setTexts(t: CmsBuilderTexts) {
  const words: [HTMLButtonElement, string][] = [
    [ui!.handle, t.drag], [ui!.up, t.moveUp], [ui!.down, t.moveDown], [ui!.duplicate, t.duplicate], [ui!.remove, t.remove], [ui!.add, t.insertHere],
  ]
  for (const [button, word] of words) {
    button.setAttribute('aria-label', word)
    button.title = word
  }
}

/** The admin's messages: switch the tool on (once) and keep what it says about the selection. */
export function handleCmsBuilderMessage(message: CmsBuilderToPage) {
  if (message.type === 'cms:builder:on') {
    if (!ui) start()
    labels = message.labels
    setTexts(message.texts)
    selected = message.selected
  } else {
    if (!ui) return
    selected = message.id
    scrollToSelected = message.scroll && message.id !== null
  }
  schedule()
}
