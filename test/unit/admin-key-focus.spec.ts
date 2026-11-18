import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { CMS_KEY_FOCUS_ATTR, CMS_KEYS_ATTR, cmsTrackKeys } from '../../packages/cms/app/utils/cmsKeys'

// The writing column (the Write layout's big title, summary and text) shows its focus ring only when the
// keyboard put the focus there (decided after review B, 2026-11-18). A text field always matches
// :focus-visible, and typing sets data-cms-keys, so neither tells a click from Tab. cmsTrackKeys notes
// where the focus came from instead: data-cms-key-focus on <html>, set when a control takes the focus
// while data-cms-keys is set, cleared when the pointer presses.

/** A document with what cmsTrackKeys touches: events and the attributes of <html>. */
function fakeDocument() {
  const attrs = new Map<string, string>()
  const doc = new EventTarget() as EventTarget & { documentElement: Pick<Element, 'hasAttribute' | 'setAttribute' | 'removeAttribute'>, defaultView: { innerWidth: number, innerHeight: number } }
  doc.defaultView = { innerWidth: 1280, innerHeight: 800 }
  doc.documentElement = {
    hasAttribute: (n: string) => attrs.has(n),
    setAttribute: (n: string, v: string) => { attrs.set(n, v) },
    removeAttribute: (n: string) => { attrs.delete(n) },
  }
  const key = (k: string) => doc.dispatchEvent(Object.assign(new Event('keydown'), { key: k }))
  const pointer = (type: 'pointermove' | 'pointerdown') => doc.dispatchEvent(new Event(type))
  const focus = () => {
    const el = { getBoundingClientRect: () => ({ top: 200, bottom: 240, left: 16, right: 600, width: 584, height: 40 }), scrollIntoView: () => {} }
    doc.dispatchEvent(Object.defineProperty(new Event('focusin'), 'target', { value: el }))
  }
  return { doc: doc as unknown as Document, attrs, key, pointer, focus }
}

describe('cmsTrackKeys: where the focus came from', () => {
  it('a click into the text, then typing: never focus from the keyboard', () => {
    const { doc, attrs, key, pointer, focus } = fakeDocument()
    const stop = cmsTrackKeys(doc)
    pointer('pointerdown')
    focus()
    expect(attrs.has(CMS_KEY_FOCUS_ATTR)).toBe(false)
    key('a'); key('b')
    expect(attrs.has(CMS_KEYS_ATTR)).toBe(true) // the keyboard is in use…
    expect(attrs.has(CMS_KEY_FOCUS_ATTR)).toBe(false) // …but it did not put the focus there
    stop()
  })

  it('Tab into the text: focus from the keyboard, and it stays while typing or when the mouse moves', () => {
    const { doc, attrs, key, pointer, focus } = fakeDocument()
    const stop = cmsTrackKeys(doc)
    key('Tab')
    focus()
    expect(attrs.get(CMS_KEY_FOCUS_ATTR)).toBe('')
    key('x')
    pointer('pointermove')
    expect(attrs.has(CMS_KEYS_ATTR)).toBe(false)
    expect(attrs.has(CMS_KEY_FOCUS_ATTR)).toBe(true)
    stop()
  })

  it('a press of the pointer clears it, and so does focus that arrives without the keyboard', () => {
    const { doc, attrs, key, pointer, focus } = fakeDocument()
    const stop = cmsTrackKeys(doc)
    key('Tab'); focus()
    pointer('pointerdown')
    expect(attrs.has(CMS_KEY_FOCUS_ATTR)).toBe(false)
    key('Tab'); focus()
    expect(attrs.has(CMS_KEY_FOCUS_ATTR)).toBe(true)
    pointer('pointermove') // the keyboard is no longer in use
    focus() // focus moved by the page itself
    expect(attrs.has(CMS_KEY_FOCUS_ATTR)).toBe(false)
    stop()
  })

  it('stopping removes it', () => {
    const { doc, attrs, key, focus } = fakeDocument()
    const stop = cmsTrackKeys(doc)
    key('Tab'); focus()
    stop()
    expect(attrs.has(CMS_KEY_FOCUS_ATTR)).toBe(false)
    key('Tab'); focus()
    expect(attrs.has(CMS_KEY_FOCUS_ATTR)).toBe(false)
  })
})

describe('the writing column rings only for the keyboard', () => {
  const css = readFileSync(join(import.meta.dirname, '../../packages/cms/app/assets/css/cms-admin.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')
  const editor = readFileSync(join(import.meta.dirname, '../../packages/cms/app/pages/admin/[entity]/[id].vue'), 'utf8')

  it('the stylesheet takes the ring off the Write layout\'s title, summary and text unless the keyboard put the focus there', () => {
    const rule = /([^{}]*)\{\s*outline: none;\s*\}/g
    const quiet = [...css.matchAll(rule)].map((m) => m[1]!.trim()).find((s) => s.includes(`:not([${CMS_KEY_FOCUS_ATTR}])`))
    expect(quiet).toBeDefined()
    expect(quiet).toContain(`html[data-cms-admin]:not([${CMS_KEY_FOCUS_ATTR}]) .cms-write :is(.cms-title-input:not(.cms-title-input--address), .cms-lead-input):focus-visible`)
    expect(quiet).toContain(`html[data-cms-admin]:not([${CMS_KEY_FOCUS_ATTR}]) .cms-write .cms-rte:has(.ProseMirror:focus-visible)`)
  })

  it('only the Write layout\'s column carries .cms-write; the form layout\'s title keeps its ring on a click', () => {
    expect(editor.match(/class="cms-write[ "]/g)).toHaveLength(1)
    expect(editor).toMatch(/<!-- write:[^\n]*-->\s*<div v-else class="cms-write /)
  })
})
