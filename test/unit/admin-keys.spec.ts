import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { CMS_KEYS_ATTR, cmsTrackKeys } from '../../packages/cms/app/utils/cmsKeys'

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

  it('the admin layout starts it and stops it with the layout; the stylesheet reads the same attribute', () => {
    const layout = readFileSync(join(import.meta.dirname, '../../packages/cms/app/layouts/admin.vue'), 'utf8')
    expect(layout).toContain('onMounted(() => onBeforeUnmount(cmsTrackKeys()))')
    const css = readFileSync(join(import.meta.dirname, '../../packages/cms/app/assets/css/cms-admin.css'), 'utf8')
    expect(css).toContain(`html[data-cms-admin][${CMS_KEYS_ATTR}] `)
  })
})

describe('the publish review\'s "when" choice is a radio group from the keyboard', () => {
  const review = readFileSync(join(import.meta.dirname, '../../packages/cms/app/components/CmsPublishReview.vue'), 'utf8')

  it('one Tab stop (the chosen card), the arrow keys change the choice and move the focus with it', () => {
    expect(review).toContain('role="radiogroup"')
    expect(review).toContain(':tabindex="when === opt ? 0 : -1"')
    expect(review).toContain('@keydown="onWhenKey"')
    for (const key of ['ArrowDown', 'ArrowRight', 'ArrowUp', 'ArrowLeft']) expect(review).toContain(`'${key}'`)
    expect(review).toMatch(/querySelector<HTMLElement>\('\[aria-checked="true"\]'\)\?\.focus\(\)/)
  })

  it('its focus ring sits 2 px off the card, so it never reads as the chosen card\'s border', () => {
    expect(review).toMatch(/role="radio"[\s\S]*?focus-visible:outline-2 focus-visible:outline-offset-2/)
  })
})
