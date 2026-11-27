// The editor in the preview: a plain text typed right in the page (since 2d). A site marks the element
// that shows a field with `cmsField()`; the overlay (overlay.ts) starts typing in it on the click that
// goes one level deeper than the selected block.
//
// The element itself is Vue's, and Vue may draw it anew (a refetch, an empty heading that becomes a
// real one). So the page types in a twin: a shallow copy of the element (same tag, classes and
// attributes) put right before it, holding the field's own value as plain text, while the element is
// hidden. Nothing redraws under the cursor: the page's refetch is held while a text is typed
// (state.ts). When the typing ends, the page waits for its value to come back in the admin's draft,
// refetches, and only then shows the element again (now with the new text) and drops the twin, in
// one go, so nothing flickers.
//
// What goes into the value is the twin's text, never its HTML (cmsTextOf in shared/builder.ts): a
// paste is plain text, a field of one line stays one line, and a field's maximum holds.
//
// Since 2e a field may be shown by a text node beside other content of its element (`<strong>Title.</strong>
// text`): its twin is a `<span>` put before it, and the text node is emptied (but for the space after it)
// until the page has the new text; then it gets its text back, unless the page has drawn a new one.
//
// Since 3e the admin hears when a text starts and stops being typed (`cms:builder:typing`): the phone-sized
// admin's sheet steps aside for the keyboard meanwhile.
//
// Since 2g the text may be an entry's or a global's (`entry`): it is sent as `cms:builder:entry-text`, with
// where it is inside the entry, and the page waits for it among the changes the editor holds
// (`cmsBuilderPending`) before it loads its content anew.
import { nextTick } from 'vue'
import { cmsBuilderFieldValue, cmsTextClip, cmsTextOf, type CmsBuilderPath, type CmsBuilderToAdmin } from '../../shared/builder'
import { cmsMatchOffset } from '../../shared/builder-match'
import { cmsValueAt } from '../../shared/builder-values'
import { cmsBuilderDraft, cmsBuilderHold, cmsBuilderPending } from './state'

/** A text being typed: the element (or text node), its twin, the field and what was last sent. */
interface Typing {
  el: HTMLElement | Text
  twin: HTMLElement
  /** Where the text goes in the twin: the twin, or a paragraph inside it. */
  box: HTMLElement
  path: CmsBuilderPath
  field: string
  item: string | null
  lines: boolean
  max: number | undefined
  last: string
  composing: boolean
  style: string | null
  /** For a text node: its text, and the space put before the twin. */
  saved: { text: string; rest: string; lead: Text | null } | null
  /** Since 2g: the entry or global whose text it is, and where in it; the value it started from; whether it was changed. */
  entry: { entity: string; id: string; at: string[] } | null
  initial: string
  changed: boolean
  off: () => void
  /** Send the value when it changed (`end`: always, and the typing ended). */
  push: (end: boolean) => void
}

/** A twin whose typing ended, shown until the page has the new text. */
interface Ended {
  el: HTMLElement | Text
  twin: HTMLElement
  style: string | null
  saved: Typing['saved']
}

let current: Typing | null = null
const ended: Ended[] = []
let post: (message: CmsBuilderToAdmin) => void = () => {}
let redraw: () => void = () => {}
/** How long the page waits for its text to come back in the draft before it refetches anyway (ms). */
const WAIT = 2500

/** The overlay's way to send a message and to redraw its tools. */
export function setupTyping(send: (message: CmsBuilderToAdmin) => void, schedule: () => void) {
  post = send
  redraw = schedule
}

/** Since 3e: whether the admin was told a text is being typed (once on, once off, never two of a kind in a row). */
let announced = false
function announce(on: boolean) {
  if (announced === on) return
  announced = on
  post({ type: 'cms:builder:typing', on })
}

/** The twin being typed in, if any. */
export const typingEl = (): HTMLElement | null => current?.twin ?? null

const STYLE_ID = 'cms-builder-typing'
const PAGE_STYLE = `
[data-cms-typing]{outline:none!important;cursor:text!important;user-select:text!important;-webkit-user-select:text!important;caret-color:auto}
[data-cms-typing][data-cms-empty]::before{content:attr(data-cms-placeholder);float:left;height:0;opacity:.42;pointer-events:none;white-space:nowrap}
`

/** The text of an element as a visitor reads it, when the draft does not have the field's value. */
function shownText(el: HTMLElement | Text): string {
  return (el.textContent ?? '').replace(/ /g, ' ').replace(/\s+/g, ' ').trim()
}

/** The offset in an element's text (or a text node's) of the place under the pointer, or null. */
function offsetAt(el: HTMLElement | Text, x: number, y: number): number | null {
  const doc = document as Document & {
    caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node; offset: number } | null
    caretRangeFromPoint?: (x: number, y: number) => Range | null
  }
  let node: Node | null = null
  let offset = 0
  if (doc.caretPositionFromPoint) {
    const p = doc.caretPositionFromPoint(x, y)
    node = p?.offsetNode ?? null
    offset = p?.offset ?? 0
  }
  else if (doc.caretRangeFromPoint) {
    const r = doc.caretRangeFromPoint(x, y)
    node = r?.startContainer ?? null
    offset = r?.startOffset ?? 0
  }
  if (!node || !el.contains(node)) return null
  if (el.nodeType === 3) return node === el ? offset : null
  if (node.nodeType !== 3) {
    // An element and the index of a child: the text before that child.
    const child = node.childNodes[offset] ?? null
    let count = 0
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT)
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      if (child && (child === n || child.compareDocumentPosition(n) & Node.DOCUMENT_POSITION_FOLLOWING)) break
      count += n.nodeValue?.length ?? 0
    }
    return count
  }
  let count = 0
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT)
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    if (n === node) return count + offset
    count += n.nodeValue?.length ?? 0
  }
  return null
}

/** Put a plain text into an element: its lines as text, a `<br>` between them, one more at the end so an empty last line shows. */
function fill(box: HTMLElement, text: string) {
  box.replaceChildren()
  const lines = text.split('\n')
  lines.forEach((line, i) => {
    if (i) box.appendChild(document.createElement('br'))
    if (line) box.appendChild(document.createTextNode(line))
  })
  if (text === '' || text.endsWith('\n')) box.appendChild(document.createElement('br'))
}

/** Put the cursor at `offset` of the text in `box` (a line break counts one). */
function caretAt(box: HTMLElement, offset: number) {
  const selection = getSelection()
  if (!selection) return
  const range = document.createRange()
  let left = offset
  for (let i = 0; i < box.childNodes.length; i++) {
    const n = box.childNodes[i]!
    const size = n.nodeType === 3 ? n.nodeValue?.length ?? 0 : n.nodeName === 'BR' ? 1 : 0
    if (n.nodeType === 3 && left <= size) {
      range.setStart(n, left)
      range.collapse(true)
      selection.removeAllRanges()
      selection.addRange(range)
      return
    }
    if (n.nodeName === 'BR' && left === 0) {
      range.setStartBefore(n)
      range.collapse(true)
      selection.removeAllRanges()
      selection.addRange(range)
      return
    }
    left -= size
  }
  range.selectNodeContents(box)
  range.collapse(false)
  selection.removeAllRanges()
  selection.addRange(range)
}

/** Whether the browser edits plain text only (no formatting, plain paste); else a contenteditable of its own kind. */
function editable(el: HTMLElement) {
  el.setAttribute('contenteditable', 'plaintext-only')
  if (el.contentEditable !== 'plaintext-only') el.setAttribute('contenteditable', 'true')
}

function read(t: Typing): string {
  return cmsTextOf(t.twin, { lines: t.lines, max: t.max })
}

/** The length of what is selected inside the twin (it is replaced by what is typed). */
function selectedLength(t: Typing): number {
  const selection = getSelection()
  if (!selection || !selection.rangeCount) return 0
  const range = selection.getRangeAt(0)
  return t.twin.contains(range.commonAncestorContainer) ? range.toString().length : 0
}

function insertText(text: string) {
  // The browser's own command keeps its undo (Ctrl/⌘ Z inside the text) and the cursor.
  document.execCommand('insertText', false, text)
}

export interface StartTyping {
  /** The element that shows the field, or a text node beside other content of its element. */
  el: HTMLElement | Text
  /** For a text node: the field is this part of its text (the rest stays around it while it is typed). */
  range?: [number, number]
  /** The field's value as the page drew it (the block's values), when the admin has not sent its draft yet. */
  drawn?: unknown
  path: CmsBuilderPath
  field: string
  item: string | null
  lines: boolean
  max?: number
  /** The click that started it, for the cursor's place. */
  x: number
  y: number
  /** Since 2g: the text is an entry's or a global's: which, and where the value is in it. */
  entry?: { entity: string; id: string; at: string[] }
}

/** Start typing in a marked element. */
export function startTyping(o: StartTyping) {
  // Another text typed straight after one: the typing never stopped, the admin hears nothing between.
  endTyping(true)
  if (!document.getElementById(STYLE_ID)) {
    const style = document.createElement('style')
    style.id = STYLE_ID
    style.textContent = PAGE_STYLE
    document.head.appendChild(style)
  }
  const { el } = o
  // An entry's text: what the editor holds of it and has not saved, else as the page loaded it.
  const stored = o.entry
    ? cmsValueAt(cmsBuilderPending.entries.get(`${o.entry.entity}\n${o.entry.id}`), o.entry.at)
    : cmsBuilderFieldValue(cmsBuilderDraft.data, o.path, o.field, o.item)
  // The field's own value (an empty field is null): from the admin's draft, else as the page drew it (the
  // admin sends its draft only after a first change), and what the element shows only when neither has it.
  const raw = typeof stored === 'string' ? stored : stored === null ? '' : typeof o.drawn === 'string' ? o.drawn : o.drawn === null ? '' : shownText(el)
  const text = cmsTextClip(raw, { lines: o.lines, max: o.max })
  // Where the click was in the text the page shows, and so in the raw value (its asterisks, its line breaks).
  const part = el.nodeType === 3 && o.range ? o.range : null
  const shownAt = offsetAt(el, o.x, o.y)
  const seen = part ? (el.nodeValue ?? '').slice(part[0], part[1]) : el.textContent ?? ''
  const at = shownAt === null ? null : cmsMatchOffset(seen, text, Math.max(0, shownAt - (part?.[0] ?? 0)))

  let twin: HTMLElement
  let box: HTMLElement
  let saved: Typing['saved'] = null
  const style = el.nodeType === 1 ? (el as HTMLElement).getAttribute('style') : null
  if (el.nodeType === 3) {
    // A text node: a span in its place, the text node emptied but for the space after it (and the one before it kept before the span).
    const value = el.nodeValue ?? ''
    const lead = part ? value.slice(0, part[0]) : /^\s*/.exec(value)![0]
    const rest = part ? value.slice(part[1]) : /\s*$/.exec(value)![0]
    twin = box = document.createElement('span')
    fill(box, text)
    const before = lead ? document.createTextNode(lead) : null
    saved = { text: value, rest, lead: before }
    if (before) el.before(before)
    el.before(twin)
    el.nodeValue = rest
  }
  else {
    const element = el as HTMLElement
    twin = element.cloneNode(false) as HTMLElement
    for (const name of ['id', 'aria-hidden', 'data-cms-hidden', 'data-cms-hint']) twin.removeAttribute(name)
    // Decorations at its start that hold no text (an icon, a stroke) stay, out of the way of the cursor.
    for (const child of element.childNodes) {
      if (child.nodeType === 3 && child.nodeValue?.trim()) break
      if (child.nodeType !== 1) continue
      const decoration = child as HTMLElement
      if (decoration.textContent?.trim() || decoration.getAttribute('aria-hidden') !== 'true') break
      const copy = decoration.cloneNode(true) as HTMLElement
      copy.setAttribute('contenteditable', 'false')
      twin.appendChild(copy)
    }
    // A text drawn as paragraphs is typed in one paragraph of the same kind (a blank line between paragraphs).
    const paragraphs = [...element.children].filter((c) => !c.hasAttribute('aria-hidden'))
    const directText = [...element.childNodes].some((n) => n.nodeType === 3 && n.nodeValue?.trim())
    box = !directText && paragraphs.length && paragraphs.every((c) => c.nodeName === 'P') ? (paragraphs[0]!.cloneNode(false) as HTMLElement) : twin
    if (box !== twin) {
      box.removeAttribute('id')
      twin.appendChild(box)
      box.style.whiteSpace = 'pre-wrap'
    }
    fill(box, text)
  }
  if (!text && shownText(el)) twin.setAttribute('data-cms-placeholder', shownText(el))
  twin.toggleAttribute('data-cms-empty', !text)
  twin.setAttribute('data-cms-typing', '')
  twin.style.whiteSpace = 'pre-wrap'
  twin.spellcheck = true
  editable(twin)

  if (el.nodeType === 1) {
    const element = el as HTMLElement
    element.before(twin)
    element.style.setProperty('display', 'none', 'important')
    element.setAttribute('data-cms-hidden', '')
  }
  twin.focus({ preventScroll: true })
  const placed = Math.min(at ?? text.length, text.length)
  caretAt(box, placed)
  // A double tap on a touch screen selects the word under the finger after the cursor was put there (a touch's
  // press is not one the page can prevent), and the first letter typed would replace it. For a moment a selection
  // nobody made with the keys goes back to the cursor (since 3e).
  const keepUntil = performance.now() + 700
  const keepCaret = () => {
    const sel = document.getSelection()
    if (performance.now() > keepUntil) document.removeEventListener('selectionchange', keepCaret)
    else if (sel && !sel.isCollapsed && sel.anchorNode && twin.contains(sel.anchorNode)) caretAt(box, placed)
  }
  const stopKeeping = () => document.removeEventListener('selectionchange', keepCaret)
  document.addEventListener('selectionchange', keepCaret)
  twin.addEventListener('keydown', stopKeeping, { once: true })
  setTimeout(stopKeeping, 800)
  cmsBuilderHold.count++

  const t: Typing = {
    el, twin, box, path: o.path, field: o.field, item: o.item, lines: o.lines, max: o.max, last: text, composing: false, style, saved,
    entry: o.entry ?? null, initial: text, changed: false, off: () => {}, push: () => {},
  }
  current = t
  announce(true)

  t.push = (end: boolean) => {
    const value = read(t)
    twin.toggleAttribute('data-cms-empty', !value)
    if (value === t.last && !end) return
    if (value !== t.last) t.changed = true
    t.last = value
    if (t.entry) {
      // Nothing was typed at all: the editor is not asked to load the entry.
      if (t.changed) post({ type: 'cms:builder:entry-text', entity: t.entry.entity, id: t.entry.id, at: t.entry.at, value, ...(end ? { end: true } : {}) })
      redraw()
      return
    }
    const id = t.path[t.path.length - 1]!
    post({ type: 'cms:builder:text', id, path: t.path, field: t.field, ...(t.item ? { item: t.item } : {}), value, ...(end ? { end: true } : {}) })
    redraw()
  }
  const inSummary = !!twin.closest('summary')
  const onInput = () => { if (!t.composing) t.push(false) }
  const onKeyUp = (e: KeyboardEvent) => { if (e.key === ' ' && inSummary) e.preventDefault() }
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault()
      e.stopPropagation()
      endTyping()
      return
    }
    // Inside a <summary> (a folded question) a space would open and close the answer: it is typed instead.
    if (e.key === ' ' && !e.isComposing && inSummary) {
      e.preventDefault()
      insertText(' ')
      return
    }
    if (e.key !== 'Enter' || e.isComposing || e.keyCode === 229) return
    e.preventDefault()
    e.stopPropagation()
    if (!t.lines) endTyping()
    else if (t.max === undefined || read(t).length - selectedLength(t) < t.max) document.execCommand('insertLineBreak')
  }
  const onBeforeInput = (e: InputEvent) => {
    if (t.max === undefined || t.composing || !e.inputType.startsWith('insert') || e.inputType === 'insertCompositionText' || e.inputType === 'insertFromPaste') return
    const data = e.data ?? (e.inputType === 'insertLineBreak' || e.inputType === 'insertParagraph' ? '\n' : '')
    const room = t.max - (read(t).length - selectedLength(t))
    if (data.length <= room) return
    e.preventDefault()
    if (room > 0 && e.inputType === 'insertText' && data) insertText(cmsTextClip(data, { lines: t.lines, max: room }))
  }
  const onPaste = (e: ClipboardEvent) => {
    e.preventDefault()
    let text = (e.clipboardData?.getData('text/plain') ?? '').replace(/\r\n?/g, '\n')
    if (!t.lines) text = text.replace(/\s*\n\s*/g, ' ')
    if (t.max !== undefined) text = cmsTextClip(text, { lines: t.lines, max: Math.max(0, t.max - (read(t).length - selectedLength(t))) })
    if (text) insertText(text)
  }
  const onDrop = (e: DragEvent) => e.preventDefault()
  const onCompositionStart = () => { t.composing = true }
  const onCompositionEnd = () => {
    t.composing = false
    // What the composition gave may be longer than the field takes.
    const value = read(t)
    if (t.max !== undefined && cmsTextOf(t.twin, { lines: t.lines }).length > t.max) {
      fill(t.box, value)
      caretAt(t.box, value.length)
    }
    t.push(false)
  }
  const onBlur = () => { if (current === t) endTyping() }
  const onDown = (e: PointerEvent) => { if (!e.composedPath().includes(twin)) endTyping() }
  twin.addEventListener('input', onInput)
  twin.addEventListener('keydown', onKey)
  twin.addEventListener('keyup', onKeyUp)
  twin.addEventListener('beforeinput', onBeforeInput)
  twin.addEventListener('paste', onPaste)
  twin.addEventListener('drop', onDrop)
  twin.addEventListener('compositionstart', onCompositionStart)
  twin.addEventListener('compositionend', onCompositionEnd)
  twin.addEventListener('blur', onBlur)
  window.addEventListener('blur', onBlur)
  document.addEventListener('pointerdown', onDown, true)
  t.off = () => {
    twin.removeEventListener('input', onInput)
    twin.removeEventListener('keydown', onKey)
    twin.removeEventListener('keyup', onKeyUp)
    twin.removeEventListener('beforeinput', onBeforeInput)
    twin.removeEventListener('paste', onPaste)
    twin.removeEventListener('drop', onDrop)
    twin.removeEventListener('compositionstart', onCompositionStart)
    twin.removeEventListener('compositionend', onCompositionEnd)
    twin.removeEventListener('blur', onBlur)
    window.removeEventListener('blur', onBlur)
    document.removeEventListener('pointerdown', onDown, true)
  }
  redraw()
}

/** End the typing (Enter in a field of one line, Escape, a click elsewhere, the page losing focus): the text stays. */
export function endTyping(next = false) {
  const t = current
  if (!t) return
  current = null
  t.off()
  const value = read(t)
  t.push(true)
  t.twin.removeAttribute('contenteditable')
  t.twin.removeAttribute('data-cms-typing')
  t.twin.removeAttribute('data-cms-empty')
  const selection = getSelection()
  if (selection?.rangeCount && t.twin.contains(selection.getRangeAt(0).commonAncestorContainer)) selection.removeAllRanges()
  ended.push({ el: t.el, twin: t.twin, style: t.style, saved: t.saved })
  // After the last value, so the admin has the text before it hears the typing is over (`next`: another one starts).
  if (!next) announce(false)
  void cameBack(t, value).then(() => {
    cmsBuilderHold.count = Math.max(0, cmsBuilderHold.count - 1)
    return release()
  })
  redraw()
}

/** Resolves once the admin's draft holds the typed value (or after a while, whatever it holds). */
function cameBack(t: Typing, value: string): Promise<void> {
  if (t.entry) return entryCameBack(t, t.entry, value)
  const holds = (data: unknown) => {
    const v = cmsBuilderFieldValue(data, t.path, t.field, t.item)
    return (typeof v === 'string' ? v : v === null || v === undefined ? '' : null) === value
  }
  return new Promise((done) => {
    let timer: ReturnType<typeof setTimeout> | undefined
    const listener = (data: unknown) => { if (holds(data)) finish() }
    function finish() {
      clearTimeout(timer)
      cmsBuilderDraft.listeners.delete(listener)
      done()
    }
    // A text typed back to what it was: the draft holds it already, and no change will come.
    if (value === cmsTextClip(String(cmsBuilderFieldValue(cmsBuilderDraft.data, t.path, t.field, t.item) ?? ''), { lines: t.lines, max: t.max }) && !cmsBuilderHold.missed) return finish()
    timer = setTimeout(finish, WAIT)
    cmsBuilderDraft.listeners.add(listener)
  })
}

/**
 * The same for an entry's text: resolves once the changes the editor holds have the typed value (the
 * preview's draft has it then), or have nothing there when the text is back to what it started from.
 */
function entryCameBack(t: Typing, entry: { entity: string; id: string; at: string[] }, value: string): Promise<void> {
  if (!t.changed) return Promise.resolve()
  const holds = () => {
    const v = cmsValueAt(cmsBuilderPending.entries.get(`${entry.entity}\n${entry.id}`), entry.at)
    // Open in the sheet beside the page: its form has the text, and says when its draft is at the server.
    const sheet = cmsBuilderPending.sheet
    if (sheet && sheet.entity === entry.entity && (sheet.id === null || sheet.id === entry.id)) return true
    return v === undefined ? value === t.initial : (typeof v === 'string' ? v : v === null ? '' : null) === value
  }
  return new Promise((done) => {
    let timer: ReturnType<typeof setTimeout> | undefined
    const listener = () => { if (holds()) finish() }
    function finish() {
      clearTimeout(timer)
      cmsBuilderPending.listeners.delete(listener)
      // What the page shows of the entry is older than what was typed: it loads its content anew.
      cmsBuilderHold.missed = true
      done()
    }
    timer = setTimeout(finish, WAIT)
    cmsBuilderPending.listeners.add(listener)
  })
}

/** No text is typed any more: refetch what was held, then show the elements again (with their new text) and drop the twins. */
async function release() {
  if (cmsBuilderHold.count > 0) return
  if (cmsBuilderHold.missed) {
    cmsBuilderHold.missed = false
    try {
      await cmsBuilderHold.refresh()
    }
    catch { /* the page keeps what it has */ }
    // Vue draws the new content on its next tick; the twins go in the same task, so nothing flickers.
    await nextTick()
  }
  for (const e of ended.splice(0)) {
    if (e.saved) {
      // The text node gets its text back, unless the page drew a new one in it.
      if (e.el.isConnected && e.el.nodeValue === e.saved.rest) e.el.nodeValue = e.saved.text
      e.saved.lead?.remove()
    }
    else if (e.el.isConnected) {
      const element = e.el as HTMLElement
      if (e.style === null) element.removeAttribute('style')
      else element.setAttribute('style', e.style)
      element.removeAttribute('data-cms-hidden')
    }
    e.twin.remove()
  }
  redraw()
}
