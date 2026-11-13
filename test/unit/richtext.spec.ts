import { describe, expect, it } from 'vitest'
import { richTextSchema, sanitizeRichText } from '@my-cms/core'

const link = (href: string) => ({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'x', marks: [{ type: 'link', attrs: { href } }] }] }] })
const linkKept = (href: string) => (sanitizeRichText(link(href) as any) as any).content[0].content[0].marks.length === 1
const image = (src: string) => ({ type: 'doc', content: [{ type: 'image', attrs: { src } }] })
const imageSrc = (src: string) => (sanitizeRichText(image(src) as any) as any).content[0].attrs.src

describe('rich-text sanitiser', () => {
  it.each(['https://example.com', 'http://example.com', 'mailto:a@b.cz', 'tel:+420123', '/relative', '#anchor'])('keeps a safe link: %s', (href) => {
    expect(linkKept(href)).toBe(true)
  })

  it.each(['javascript:alert(1)', 'JaVaScRiPt:alert(1)', ' javascript:alert(1)', 'data:text/html,<script>', 'java\tscript:alert(1)', 'vbscript:x'])('drops an unsafe link but keeps the text: %s', (href) => {
    const out: any = sanitizeRichText(link(href) as any)
    expect(out.content[0].content[0].marks).toEqual([])
    expect(out.content[0].content[0].text).toBe('x')
  })

  it('keeps http(s) images and blanks anything else', () => {
    expect(imageSrc('https://cdn.example.com/a.png')).toBe('https://cdn.example.com/a.png')
    expect(imageSrc('javascript:alert(1)')).toBe('')
    expect(imageSrc('data:image/svg+xml,<svg onload=alert(1)>')).toBe('')
  })

  it('clamps heading levels to 1–6', () => {
    const doc: any = { type: 'doc', content: [
      { type: 'heading', attrs: { level: 99 } },
      { type: 'heading', attrs: { level: -3 } },
      { type: 'heading', attrs: { level: 'script' } },
    ] }
    sanitizeRichText(doc)
    expect(doc.content.map((n: any) => n.attrs.level)).toEqual([6, 1, 2])
  })

  it('sanitises nested content and runs on every write through the schema', () => {
    const nested = { type: 'doc', content: [{ type: 'blockquote', content: [link('javascript:alert(1)').content[0]] }] }
    const parsed: any = richTextSchema.parse(nested)
    expect(parsed.content[0].content[0].content[0].marks).toEqual([])
  })

  it('rejects something that is not a doc', () => {
    expect(richTextSchema.safeParse({ type: 'paragraph' }).success).toBe(false)
    expect(richTextSchema.safeParse('<p>html</p>').success).toBe(false)
  })
})
