import { describe, expect, it } from 'vitest'
import { docToMarkdown, markdownToDoc } from '../../packages/cms/server/utils/cmsMarkdown'
import { sanitizeRichText } from '../../packages/cms/src/richtext'

// The MCP tools take and give rich text as Markdown (cmsMarkdown.ts): the editor's nodes and marks only.
describe('markdown and the rich-text document', () => {
  it('reads headings, paragraphs, marks, links and breaks', () => {
    const doc = markdownToDoc('# Title\n\nSome **bold**, *italic*, ~~gone~~ and `code`.\nNext line\\\nafter a break, [a link](https://example.com "Example").')
    expect(doc.content![0]).toEqual({ type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'Title' }] })
    const p = doc.content![1]!
    expect(p.type).toBe('paragraph')
    expect(p.content).toEqual(expect.arrayContaining([
      { type: 'text', text: 'bold', marks: [{ type: 'bold' }] },
      { type: 'text', text: 'italic', marks: [{ type: 'italic' }] },
      { type: 'text', text: 'gone', marks: [{ type: 'strike' }] },
      { type: 'text', text: 'code', marks: [{ type: 'code' }] },
      { type: 'hardBreak' },
      { type: 'text', text: 'a link', marks: [{ type: 'link', attrs: { href: 'https://example.com', title: 'Example' } }] },
    ]))
  })

  it('reads lists (nested, numbered), quotes, code blocks, rules and images', () => {
    const doc = markdownToDoc('- one\n- two\n  1. inner\n  2. more\n\n3. three\n4. four\n\n> quoted\n\n```js\nlet a = 1\n```\n\n---\n\n![A dot](/x.png "media:0b7a3f3e-1c2d-4e5f-8a9b-0c1d2e3f4a5b")')
    const types = doc.content!.map((n) => n.type)
    expect(types).toEqual(['bulletList', 'orderedList', 'blockquote', 'codeBlock', 'horizontalRule', 'paragraph'])
    expect(doc.content![0]!.content![1]!.content![1]!.type).toBe('orderedList')
    expect(doc.content![1]!.attrs).toEqual({ start: 3 })
    expect(doc.content![3]).toEqual({ type: 'codeBlock', attrs: { language: 'js' }, content: [{ type: 'text', text: 'let a = 1' }] })
    expect(doc.content![5]!.content![0]).toEqual({ type: 'image', attrs: { src: '/x.png', alt: 'A dot', title: null, mediaId: '0b7a3f3e-1c2d-4e5f-8a9b-0c1d2e3f4a5b' } })
  })

  it('goes back to the same Markdown', () => {
    const md = '## Hello\n\nSome **bold** text and a [link](https://example.com).\n\n- one\n- two\n  - deeper\n\n1. first\n2. second\n\n> said\n\n```\ncode\n```\n\n---\n\n![A dot](/x.png "media:0b7a3f3e-1c2d-4e5f-8a9b-0c1d2e3f4a5b")'
    expect(docToMarkdown(markdownToDoc(md))).toBe(md)
  })

  it('makes nothing the sanitiser has to drop, and an unsafe link is still dropped by it', () => {
    const doc = markdownToDoc('[bad](javascript:alert(1)) and [good](/about)') as any
    const clean = sanitizeRichText(structuredClone(doc)) as any
    const links = JSON.stringify(clean)
    expect(links).toContain('/about')
    expect(links).not.toContain('javascript:')
  })
})
