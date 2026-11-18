import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { createRenderer, defineComponent, h } from 'vue'
import { CMS_KEYS_ATTR, cmsRadioArrow, cmsRadioGroupKey, cmsTrackKeys, cmsTrackKeysWhileMounted } from '../../packages/cms/app/utils/cmsKeys'

// A select menu and the search keep the focus in their search box and mark the option the arrow keys reach
// (data-highlighted), as the pointer does. cms-admin.css rings a marked option only while <html> carries
// data-cms-keys, which cmsTrackKeys sets on a key and clears when the pointer moves or presses. While the
// keyboard is in use it also scrolls a control that takes the focus off screen into view (a dialog's
// focus trap moves the focus without scrolling when Tab wraps round).

/** A document with just what cmsTrackKeys touches: events and the attributes of <html>. */
function fakeDocument() {
  const attrs = new Map<string, string>()
  const doc = new EventTarget() as EventTarget & { documentElement: Pick<Element, 'hasAttribute' | 'setAttribute' | 'removeAttribute'>, defaultView: { innerWidth: number, innerHeight: number } }
  doc.defaultView = { innerWidth: 390, innerHeight: 844 }
  doc.documentElement = {
    hasAttribute: (n: string) => attrs.has(n),
    setAttribute: (n: string, v: string) => { attrs.set(n, v) },
    removeAttribute: (n: string) => { attrs.delete(n) },
  }
  const key = (k: string) => doc.dispatchEvent(Object.assign(new Event('keydown'), { key: k }))
  const pointer = (type: 'pointermove' | 'pointerdown') => doc.dispatchEvent(new Event(type))
  /** An element taking the focus at `top`..`bottom` (px from the top of the screen); how often it was scrolled into view. */
  const focusAt = (top: number, bottom: number) => {
    const scrolled: unknown[] = []
    const el = { getBoundingClientRect: () => ({ top, bottom, left: 16, right: 200, width: 184, height: bottom - top }), scrollIntoView: (o: unknown) => { scrolled.push(o) } }
    doc.dispatchEvent(Object.defineProperty(new Event('focusin'), 'target', { value: el }))
    return scrolled
  }
  return { doc: doc as unknown as Document, attrs, key, pointer, focusAt }
}

describe('cmsTrackKeys: the keyboard was the last thing used', () => {
  it('a key sets data-cms-keys; the pointer moving or pressing clears it', () => {
    const { doc, attrs, key, pointer } = fakeDocument()
    const stop = cmsTrackKeys(doc)
    expect(attrs.has(CMS_KEYS_ATTR)).toBe(false)
    key('ArrowDown')
    expect(attrs.get(CMS_KEYS_ATTR)).toBe('')
    pointer('pointermove')
    expect(attrs.has(CMS_KEYS_ATTR)).toBe(false)
    key('a') // typing in a search box counts: the option it marks is what Enter picks
    expect(attrs.has(CMS_KEYS_ATTR)).toBe(true)
    pointer('pointerdown')
    expect(attrs.has(CMS_KEYS_ATTR)).toBe(false)
    stop()
  })

  it('a lone modifier (Shift, Control, Alt, Meta) does not count', () => {
    const { doc, attrs, key } = fakeDocument()
    const stop = cmsTrackKeys(doc)
    for (const k of ['Shift', 'Control', 'Alt', 'Meta']) key(k)
    expect(attrs.has(CMS_KEYS_ATTR)).toBe(false)
    key('Tab')
    expect(attrs.has(CMS_KEYS_ATTR)).toBe(true)
    stop()
  })

  it('stopping removes the attribute and the listeners', () => {
    const { doc, attrs, key } = fakeDocument()
    const stop = cmsTrackKeys(doc)
    key('Enter')
    stop()
    expect(attrs.has(CMS_KEYS_ATTR)).toBe(false)
    key('ArrowDown')
    expect(attrs.has(CMS_KEYS_ATTR)).toBe(false)
  })

  it('keyboard focus that lands off screen (Tab wrapping round a dialog) is scrolled into view; the pointer\'s is not', () => {
    const { doc, key, pointer, focusAt } = fakeDocument()
    const stop = cmsTrackKeys(doc)
    key('Tab')
    expect(focusAt(-103, -71)).toEqual([{ block: 'nearest', inline: 'nearest' }]) // above the screen (the review's first button)
    expect(focusAt(900, 940)).toHaveLength(1) // below it
    expect(focusAt(400, 440)).toHaveLength(0) // in view: left alone
    expect(focusAt(-20, 30)).toHaveLength(0) // partly in view: left alone
    pointer('pointerdown')
    expect(focusAt(-103, -71)).toHaveLength(0) // a click never scrolls
    stop()
    key('Tab')
    expect(focusAt(-103, -71)).toHaveLength(0)
  })

  it('the stylesheet rings a marked option only under the same attribute', () => {
    const css = readFileSync(join(import.meta.dirname, '../../packages/cms/app/assets/css/cms-admin.css'), 'utf8')
    expect(css).toContain(`html[data-cms-admin][${CMS_KEYS_ATTR}] `)
  })
})

// Mounting the admin layout or the publish review needs Nuxt UI, the admin's auto-imports and a DOM, none of
// which the unit tests have (no @vue/test-utils or DOM library in the repository). What they do from the
// keyboard is in plain functions of app/utils/cmsKeys.ts, tested here; the lifecycle runs in a real Vue
// component, mounted with a renderer that keeps its nodes in plain objects.
const { createApp } = createRenderer<any, any>({
  createElement: (type) => ({ type, children: [] }),
  createText: (text) => ({ text }),
  createComment: (text) => ({ text }),
  setText: () => {},
  setElementText: () => {},
  insert: (child, parent) => { parent.children.push(child) },
  remove: () => {},
  parentNode: () => null,
  nextSibling: () => null,
  patchProp: () => {},
})

describe('cmsTrackKeysWhileMounted: what the admin layout calls in its setup', () => {
  it('tracks the keyboard from mounting until unmounting, then leaves nothing behind', () => {
    const { doc, attrs, key } = fakeDocument()
    const listening = vi.spyOn(doc, 'addEventListener')
    const app = createApp(defineComponent({ setup() { cmsTrackKeysWhileMounted(doc); return () => h('div') } }))
    expect(listening).not.toHaveBeenCalled() // set up, not yet in the page (nothing runs on the server)
    app.mount({ children: [] })
    expect(listening).toHaveBeenCalledTimes(4)
    key('ArrowDown')
    expect(attrs.has(CMS_KEYS_ATTR)).toBe(true)
    app.unmount()
    expect(attrs.has(CMS_KEYS_ATTR)).toBe(false)
    key('ArrowDown')
    expect(attrs.has(CMS_KEYS_ATTR)).toBe(false)
  })

  it('is what the layout uses', () => {
    const layout = readFileSync(join(import.meta.dirname, '../../packages/cms/app/layouts/admin.vue'), 'utf8')
    expect(layout).toMatch(/^cmsTrackKeysWhileMounted\(\)$/m)
  })
})

describe('the publish review\'s "when" choice is a radio group from the keyboard', () => {
  it('the arrow keys move to the next or previous option, wrapping round; other keys do nothing', () => {
    const when = ['now', 'schedule'] as const
    for (const key of ['ArrowDown', 'ArrowRight', 'ArrowUp', 'ArrowLeft']) {
      expect(cmsRadioArrow(key, when, 'now'), key).toBe('schedule')
      expect(cmsRadioArrow(key, when, 'schedule'), key).toBe('now')
    }
    const three = ['a', 'b', 'c']
    expect([cmsRadioArrow('ArrowDown', three, 'c'), cmsRadioArrow('ArrowUp', three, 'a'), cmsRadioArrow('ArrowRight', three, 'a')]).toEqual(['a', 'c', 'b'])
    for (const key of ['Tab', ' ', 'Enter', 'Home', 'a']) expect(cmsRadioArrow(key, when, 'now'), key).toBeNull()
  })

  /** Two radio cards in a group; the group finds the one whose aria-checked follows the choice. */
  function radioGroup() {
    let chosen: 'now' | 'schedule' = 'now'
    const focused: string[] = []
    const card = (opt: typeof chosen) => ({ opt, focus: () => { focused.push(opt) } })
    const cards = { now: card('now'), schedule: card('schedule') }
    const group = { querySelector: (sel: string) => (sel === '[aria-checked="true"]' ? cards[chosen] : null) }
    const pending: (() => void)[] = []
    const press = (key: string) => {
      const e = { key, currentTarget: { parentElement: group }, preventDefault: vi.fn() }
      cmsRadioGroupKey(e as unknown as KeyboardEvent, ['now', 'schedule'] as const, chosen, (v) => { chosen = v }, (fn) => { pending.push(fn) })
      return e
    }
    const draw = () => { for (const fn of pending.splice(0)) fn() }
    return { press, draw, focused, chosen: () => chosen }
  }

  it('an arrow key changes the choice, keeps the page from scrolling, and moves the focus to the new choice once drawn', () => {
    const r = radioGroup()
    const e = r.press('ArrowDown')
    expect(e.preventDefault).toHaveBeenCalled()
    expect(r.chosen()).toBe('schedule')
    expect(r.focused).toEqual([]) // not before the change is drawn
    r.draw()
    expect(r.focused).toEqual(['schedule'])
    r.press('ArrowLeft')
    r.draw()
    expect([r.chosen(), r.focused]).toEqual(['now', ['schedule', 'now']])
  })

  it('Tab, Space and Enter are left to the browser (Tab leaves the group from its one stop)', () => {
    const r = radioGroup()
    for (const key of ['Tab', ' ', 'Enter']) {
      const e = r.press(key)
      expect(e.preventDefault, key).not.toHaveBeenCalled()
    }
    r.draw()
    expect([r.chosen(), r.focused]).toEqual(['now', []])
  })

  it('is what the review\'s cards use, with the chosen card the one Tab stop', () => {
    const review = readFileSync(join(import.meta.dirname, '../../packages/cms/app/components/CmsPublishReview.vue'), 'utf8')
    expect(review).toContain('role="radiogroup"')
    expect(review).toContain(':tabindex="when === opt ? 0 : -1"')
    expect(review).toContain('@keydown="onWhenKey"')
    expect(review).toMatch(/cmsRadioGroupKey\(e, WHEN, when\.value,/)
  })

  it('its focus ring sits 2 px off the card, so it never reads as the chosen card\'s border', () => {
    const review = readFileSync(join(import.meta.dirname, '../../packages/cms/app/components/CmsPublishReview.vue'), 'utf8')
    expect(review).toMatch(/role="radio"[\s\S]*?focus-visible:outline-2 focus-visible:outline-offset-2/)
  })
})
