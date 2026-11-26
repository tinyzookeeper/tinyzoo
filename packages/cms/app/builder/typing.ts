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
import { nextTick } from 'vue'
import { cmsBuilderFieldValue, cmsTextClip, cmsTextOf, type CmsBuilderPath, type CmsBuilderToAdmin } from '../../shared/builder'
import { cmsBuilderDraft, cmsBuilderHold } from './state'

/** A text being typed: the element, its twin, the field and what was last sent. */
interface Typing {
  el: HTMLElement
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
  off: () => void
  /** Send the value when it changed (`end`: always, and the typing ended). */
  push: (end: boolean) => void
}

/** A twin whose typing ended, shown until the page has the new text. */
interface Ended {
  el: HTMLElement
  twin: HTMLElement
  style: string | null
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

/** The twin being typed in, if any. */
export const typingEl = (): HTMLElement | null => current?.twin ?? null

const STYLE_ID = 'cms-builder-typing'
const PAGE_STYLE = `
[data-cms-typing]{outline:none!important;cursor:text!important;user-select:text!important;-webkit-user-select:text!important;caret-color:auto}
[data-cms-typing][data-cms-empty]::before{content:attr(data-cms-placeholder);float:left;height:0;opacity:.42;pointer-events:none;white-space:nowrap}
`

/** The text of an element as a visitor reads it, when the draft does not have the field's value. */
function shownText(el: HTMLElement): string {
  return (el.textContent ?? '').replace(/ /g, ' ').replace(/\s+/g, ' ').trim()
}

/** The offset in an element's text of the place under the pointer, or null. */
function offsetAt(el: HTMLElement, x: number, y: number): number | null {
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
  el: HTMLElement
  path: CmsBuilderPath
  field: string
  item: string | null
  lines: boolean
  max?: number
  /** The click that started it, for the cursor's place. */
  x: number
  y: number
}

/** Start typing in a marked element. */
export function startTyping(o: StartTyping) {
  endTyping()
  if (!document.getElementById(STYLE_ID)) {
    const style = document.createElement('style')
    style.id = STYLE_ID
    style.textContent = PAGE_STYLE
    document.head.appendChild(style)
  }
  const { el } = o
  const stored = cmsBuilderFieldValue(cmsBuilderDraft.data, o.path, o.field, o.item)
  // The field's own value (an empty field is null); what the element shows only when the draft does not have it.
  const raw = typeof stored === 'string' ? stored : stored === null ? '' : shownText(el)
  const text = cmsTextClip(raw, { lines: o.lines, max: o.max })
  const at = offsetAt(el, o.x, o.y)

  const twin = el.cloneNode(false) as HTMLElement
  for (const name of ['id', 'aria-hidden', 'data-cms-hidden']) twin.removeAttribute(name)
  // Decorations at its start that hold no text (an icon, a stroke) stay, out of the way of the cursor.
  for (const child of el.childNodes) {
    if (child.nodeType === 3 && child.nodeValue?.trim()) break
    if (child.nodeType !== 1) continue
    const element = child as HTMLElement
    if (element.textContent?.trim() || element.getAttribute('aria-hidden') !== 'true') break
    const copy = element.cloneNode(true) as HTMLElement
    copy.setAttribute('contenteditable', 'false')
    twin.appendChild(copy)
  }
  // A text drawn as paragraphs is typed in one paragraph of the same kind (a blank line between paragraphs).
  const paragraphs = [...el.children].filter((c) => !c.hasAttribute('aria-hidden'))
  const directText = [...el.childNodes].some((n) => n.nodeType === 3 && n.nodeValue?.trim())
  const box = !directText && paragraphs.length && paragraphs.every((c) => c.nodeName === 'P') ? (paragraphs[0]!.cloneNode(false) as HTMLElement) : twin
  if (box !== twin) {
    box.removeAttribute('id')
    twin.appendChild(box)
    box.style.whiteSpace = 'pre-wrap'
  }
  fill(box, text)
  if (!text && shownText(el)) twin.setAttribute('data-cms-placeholder', shownText(el))
  twin.toggleAttribute('data-cms-empty', !text)
  twin.setAttribute('data-cms-typing', '')
  twin.style.whiteSpace = 'pre-wrap'
  twin.spellcheck = true
  editable(twin)

  const style = el.getAttribute('style')
  el.before(twin)
  el.style.setProperty('display', 'none', 'important')
  el.setAttribute('data-cms-hidden', '')
  twin.focus({ preventScroll: true })
  caretAt(box, Math.min(at ?? text.length, text.length))
  cmsBuilderHold.count++

  const t: Typing = { el, twin, box, path: o.path, field: o.field, item: o.item, lines: o.lines, max: o.max, last: text, composing: false, style, off: () => {}, push: () => {} }
  current = t

  t.push = (end: boolean) => {
    const value = read(t)
    twin.toggleAttribute('data-cms-empty', !value)
    if (value === t.last && !end) return
    t.last = value
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
export function endTyping() {
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
  ended.push({ el: t.el, twin: t.twin, style: t.style })
  void cameBack(t, value).then(() => {
    cmsBuilderHold.count = Math.max(0, cmsBuilderHold.count - 1)
    return release()
  })
  redraw()
}

/** Resolves once the admin's draft holds the typed value (or after a while, whatever it holds). */
function cameBack(t: Typing, value: string): Promise<void> {
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
    if (e.el.isConnected) {
      if (e.style === null) e.el.removeAttribute('style')
      else e.el.setAttribute('style', e.style)
      e.el.removeAttribute('data-cms-hidden')
    }
    e.twin.remove()
  }
  redraw()
}
