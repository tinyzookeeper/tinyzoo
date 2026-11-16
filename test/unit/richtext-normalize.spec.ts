import { describe, expect, it } from 'vitest'
import { formJson, withoutTrailingEmpty } from '../../packages/cms/shared/richtext-normalize'
import { isEmptyRichText, sameRichText } from '../../packages/cms/app/utils/cmsJson'

const p = (text?: string) => (text ? { type: 'paragraph', content: [{ type: 'text', text }] } : { type: 'paragraph' })
const h = (text: string) => ({ type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text }] })
const doc = (...content: any[]) => ({ type: 'doc', content })

describe('rich text compared as a person reads it', () => {
  it('ignores the empty paragraph the editor adds after a last heading, list or quote', () => {
    expect(sameRichText(doc(p('Úvod'), h('Konec')), doc(p('Úvod'), h('Konec'), p()))).toBe(true)
    expect(sameRichText(doc(p('Úvod'), h('Konec')), doc(p('Úvod'), h('Konec'), p(), p()))).toBe(true)
    expect(formJson({ body: doc(h('Konec')) })).toBe(formJson({ body: doc(h('Konec'), p()) }))
  })

  it('still sees a real change, also an empty paragraph in the middle', () => {
    expect(sameRichText(doc(p('Úvod')), doc(p('Úvod'), p('Dál')))).toBe(false)
    expect(sameRichText(doc(p('a'), p(), p('b')), doc(p('a'), p('b')))).toBe(false)
  })

  it('trims documents nested inside blocks and groups too', () => {
    const before = [{ type: 'text', body: doc(h('A')) }]
    const after = [{ type: 'text', body: doc(h('A'), p()) }]
    expect(formJson(before)).toBe(formJson(after))
    expect(withoutTrailingEmpty(doc(p()))).toEqual({ type: 'doc', content: [] })
  })

  it('treats empty text as no text', () => {
    expect(isEmptyRichText(doc(p()))).toBe(true)
    expect(sameRichText(null, doc(p()))).toBe(true)
  })
})
