/**
 * Markdown and the rich-text document (ProseMirror JSON), both ways, for the MCP tools: a tool
 * may give a rich-text field as Markdown, and read one as Markdown. Only what the editor has:
 * paragraphs, headings, bullet and numbered lists, quotes, code blocks, rules, hard breaks and
 * images; bold, italic, strike, code and links. The result is sanitised by the field's own
 * schema on write, like any other document.
 *
 * Images keep their library file in the title: `![alt](src "media:<id>")`.
 */

type Node = { type: string; attrs?: Record<string, any>; content?: Node[]; text?: string; marks?: { type: string; attrs?: Record<string, any> }[] }

// ── Markdown → document ─────────────────────────────────────────────────────────

const INLINE = /(\*\*|__)(.+?)\1|(\*|_)(?!\s)(.+?)(?<!\s)\3|~~(.+?)~~|`([^`]+)`|!\[([^\]]*)\]\(([^)\s]+)(?:\s+"([^"]*)")?\)|\[([^\]]+)\]\(([^)\s]+)(?:\s+"([^"]*)")?\)| {2,}\n|\\\n/

type Mark = NonNullable<Node['marks']>[number]

function inline(text: string, marks: Mark[] = []): Node[] {
  const out: Node[] = []
  let rest = text
  while (rest) {
    const m = INLINE.exec(rest)
    if (!m) {
      out.push(textNode(rest, marks))
      break
    }
    if (m.index) out.push(textNode(rest.slice(0, m.index), marks))
    if (m[2] !== undefined) out.push(...inline(m[2], [...marks, { type: 'bold' }]))
    else if (m[4] !== undefined) out.push(...inline(m[4], [...marks, { type: 'italic' }]))
    else if (m[5] !== undefined) out.push(...inline(m[5], [...marks, { type: 'strike' }]))
    else if (m[6] !== undefined) out.push(textNode(m[6], [...marks, { type: 'code' }]))
    else if (m[8] !== undefined) {
      const mediaId = /^media:([0-9a-f-]{36})$/i.exec(m[9] ?? '')?.[1]
      out.push({ type: 'image', attrs: { src: m[8], alt: m[7] || null, title: mediaId ? null : m[9] ?? null, ...(mediaId ? { mediaId } : {}) } })
    }
    else if (m[10] !== undefined) out.push(...inline(m[10], [...marks, { type: 'link', attrs: { href: m[11], ...(m[12] ? { title: m[12] } : {}) } }]))
    else out.push({ type: 'hardBreak' })
    rest = rest.slice(m.index + m[0].length)
  }
  return out.filter((n) => n.type !== 'text' || n.text)
}

const textNode = (text: string, marks: Mark[]): Node => (marks.length ? { type: 'text', text, marks } : { type: 'text', text })

const paragraph = (text: string): Node => {
  const content = inline(text.trim())
  return content.length ? { type: 'paragraph', content } : { type: 'paragraph' }
}

const LIST_ITEM = /^(\s*)([-*+]|(\d+)[.)])\s+(.*)$/

/** A Markdown string as a rich-text document. */
export function markdownToDoc(md: string): Node {
  const lines = md.replace(/\r\n?/g, '\n').split('\n')
  const content: Node[] = []
  let i = 0
  const blank = (l: string | undefined) => l === undefined || !l.trim()
  while (i < lines.length) {
    const line = lines[i]!
    if (blank(line)) { i++; continue }
    const fence = /^```\s*([\w-]*)\s*$/.exec(line)
    if (fence) {
      const code: string[] = []
      i++
      while (i < lines.length && !/^```\s*$/.test(lines[i]!)) code.push(lines[i++]!)
      i++
      content.push({ type: 'codeBlock', attrs: { language: fence[1] || null }, content: code.length ? [{ type: 'text', text: code.join('\n') }] : [] })
      continue
    }
    const heading = /^(#{1,6})\s+(.*?)\s*#*\s*$/.exec(line)
    if (heading) {
      content.push({ type: 'heading', attrs: { level: heading[1]!.length }, content: inline(heading[2]!) })
      i++
      continue
    }
    if (/^\s*([-*_])(\s*\1){2,}\s*$/.test(line)) {
      content.push({ type: 'horizontalRule' })
      i++
      continue
    }
    if (/^\s*>/.test(line)) {
      const quoted: string[] = []
      while (i < lines.length && /^\s*>/.test(lines[i]!)) quoted.push(lines[i++]!.replace(/^\s*>\s?/, ''))
      content.push({ type: 'blockquote', content: markdownToDoc(quoted.join('\n')).content ?? [] })
      continue
    }
    if (LIST_ITEM.test(line)) {
      const [node, next] = list(lines, i)
      content.push(node)
      i = next
      continue
    }
    const para: string[] = []
    while (i < lines.length && !blank(lines[i]) && !/^(#{1,6}\s|```|\s*>)/.test(lines[i]!) && !LIST_ITEM.test(lines[i]!)) para.push(lines[i++]!)
    content.push(paragraph(para.join('\n')))
  }
  return { type: 'doc', content }
}

/** A list starting at line `start`: its items (with nested lists), and the line after it. */
function list(lines: string[], start: number): [Node, number] {
  const first = LIST_ITEM.exec(lines[start]!)!
  const indent = first[1]!.length
  const ordered = first[3] !== undefined
  const items: Node[] = []
  let i = start
  while (i < lines.length) {
    const m = LIST_ITEM.exec(lines[i]!)
    if (!m || m[1]!.length !== indent || (m[3] !== undefined) !== ordered) break
    const body: string[] = [m[4]!]
    i++
    // Lines that continue the item, or a deeper list inside it.
    const inner: Node[] = []
    while (i < lines.length && lines[i]!.trim()) {
      const deeper = LIST_ITEM.exec(lines[i]!)
      if (deeper && deeper[1]!.length > indent) {
        const [node, next] = list(lines, i)
        inner.push(node)
        i = next
        continue
      }
      if (deeper) break
      body.push(lines[i++]!.trim())
    }
    items.push({ type: 'listItem', content: [paragraph(body.join('\n')), ...inner] })
    if (i < lines.length && !lines[i]!.trim() && LIST_ITEM.exec(lines[i + 1] ?? '')?.[1]?.length === indent) i++
  }
  const node: Node = ordered
    ? { type: 'orderedList', attrs: { start: Number(first[3]) || 1 }, content: items }
    : { type: 'bulletList', content: items }
  return [node, i]
}

// ── document → Markdown ─────────────────────────────────────────────────────────

function marked(n: Node): string {
  if (n.type === 'hardBreak') return '\\\n'
  if (n.type === 'image') return image(n)
  let text = n.text ?? ''
  for (const m of n.marks ?? []) {
    if (m.type === 'bold') text = `**${text}**`
    else if (m.type === 'italic') text = `*${text}*`
    else if (m.type === 'strike') text = `~~${text}~~`
    else if (m.type === 'code') text = `\`${text}\``
    else if (m.type === 'link' && m.attrs?.href) text = `[${text}](${m.attrs.href}${m.attrs.title ? ` "${m.attrs.title}"` : ''})`
  }
  return text
}

const image = (n: Node) => {
  const a = n.attrs ?? {}
  const title = a.mediaId ? `media:${a.mediaId}` : a.title
  return `![${a.alt ?? ''}](${a.src ?? ''}${title ? ` "${title}"` : ''})`
}

const inlineText = (nodes: Node[] | undefined) => (nodes ?? []).map(marked).join('')

function block(n: Node, indent = ''): string {
  switch (n.type) {
    case 'paragraph': return indent + inlineText(n.content).replace(/\n/g, `\n${indent}`)
    case 'heading': return `${indent}${'#'.repeat(Math.min(6, Math.max(1, Number(n.attrs?.level) || 1)))} ${inlineText(n.content)}`
    case 'horizontalRule': return `${indent}---`
    case 'image': return indent + image(n)
    case 'codeBlock': return `${indent}\`\`\`${n.attrs?.language ?? ''}\n${(n.content ?? []).map((c) => c.text ?? '').join('')}\n${indent}\`\`\``
    case 'blockquote': return (n.content ?? []).map((c) => block(c)).join('\n\n').split('\n').map((l) => `${indent}> ${l}`.trimEnd()).join('\n')
    case 'bulletList':
    case 'orderedList': {
      let k = Number(n.attrs?.start) || 1
      return (n.content ?? []).map((item) => {
        const bullet = n.type === 'bulletList' ? '- ' : `${k++}. `
        const [head, ...rest] = item.content ?? []
        const first = head ? block(head).trimStart() : ''
        const more = rest.map((c) => block(c, indent + ' '.repeat(bullet.length)))
        return [indent + bullet + first, ...more].join('\n')
      }).join('\n')
    }
    default: return n.content ? (n.content.some((c) => c.type === 'text') ? indent + inlineText(n.content) : n.content.map((c) => block(c, indent)).join('\n\n')) : ''
  }
}

/** A rich-text document as Markdown (what does not fit, like underline, is left as plain text). */
export function docToMarkdown(doc: unknown): string {
  const d = doc as Node | null
  if (!d || !Array.isArray(d.content)) return ''
  return d.content.map((n) => block(n)).filter((s) => s !== '').join('\n\n')
}
