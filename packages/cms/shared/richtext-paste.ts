/**
 * Tidying HTML pasted into the rich-text editor, before the editor reads it.
 *
 * Word (and Outlook) put lists in as plain paragraphs marked with `mso-list`, with the
 * bullet or number as text inside a hidden span, and tables as `<table>`. The editor
 * has real lists and no table, and silently turns those paragraphs into text starting
 * with a Symbol bullet. This turns them into what a person meant:
 *
 *  - runs of list paragraphs become `<ul>` / `<ol>` with nested levels;
 *  - a table becomes one paragraph per row, its cells separated by " · " (the text is
 *    kept, nothing runs together);
 *  - an image that cannot be kept (a `file://` path on the other person's computer, a
 *    `data:` blob, no source) is dropped and counted, so the editor can say so instead
 *    of leaving an empty image.
 *
 * Works on the HTML text (no DOM), so it runs the same in a test. Only structure is
 * rebuilt; the editor's own schema still decides what is kept, so scripts, styles and
 * event handlers never get through (they are not in the schema), and text is copied
 * through as it was, never rewritten into markup.
 */

export interface PastedHtml {
  html: string
  /** Images left out (not a web address the page could show). */
  droppedImages: number
}

const NAMED: Record<string, string> = {
  nbsp: ' ', middot: '·', bull: '•', ndash: '–', mdash: '—', hellip: '…', lsquo: '‘', rsquo: '’', ldquo: '“', rdquo: '”',
  bdquo: '„', sbquo: '‚', laquo: '«', raquo: '»', copy: '©', reg: '®', trade: '™', euro: '€', deg: '°', times: '×',
}
const decode = (s: string) => s
  .replace(/&#160;|&#xa0;/gi, ' ')
  .replace(/&([a-z]+);/gi, (m, name: string) => NAMED[name.toLowerCase()] ?? m)
  .replace(/&#(\d+);/g, (_m, n) => String.fromCodePoint(Number(n)))
  .replace(/&#x([0-9a-f]+);/gi, (_m, n) => String.fromCodePoint(parseInt(n, 16)))
  .replace(/&lt;/gi, '<').replace(/&gt;/gi, '>').replace(/&quot;/gi, '"').replace(/&amp;/gi, '&')
// An entity the editor can read stays one (an unknown "&foo;" is not doubled into "&amp;foo;").
const escapeText = (s: string) => s.replace(/&(?!(?:#\d+|#x[0-9a-f]+|[a-z]+);)/gi, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const textOf = (html: string) => decode(html.replace(/<(?:br|\/p|\/div|\/li|\/h[1-6])\b[^>]*>/gi, ' ').replace(/<[^>]*>/g, '')).replace(/\s+/g, ' ').trim()

/** Marker text that numbers an item ("1.", "a)", "iv.") rather than bullets it ("·", "o", "§"). */
const isNumbering = (marker: string) => /^\(?(?:\d{1,3}|[a-zA-Z]|[ivxlcdmIVXLCDM]{1,6})[.)]$/.test(marker) || /^\d{1,3}$/.test(marker)

/** Remove the first `<span … mso-list:Ignore>…</span>` (with whatever it nests) and return its text. */
function takeMarker(html: string): { marker: string; rest: string } {
  const open = /<span\b[^>]*mso-list:\s*Ignore[^>]*>/i.exec(html)
  if (!open) return { marker: '', rest: html }
  const tags = /<\/?span\b[^>]*>/gi
  tags.lastIndex = open.index + open[0].length
  let depth = 1
  let end = html.length
  for (let m = tags.exec(html); m; m = tags.exec(html)) {
    depth += m[0].startsWith('</') ? -1 : 1
    if (depth === 0) {
      end = m.index + m[0].length
      break
    }
  }
  const inner = html.slice(open.index + open[0].length, end)
  const marker = textOf(inner.replace(/<span\b[\s\S]*$/i, '')).replace(/\s+/g, '')
  return { marker, rest: html.slice(0, open.index) + html.slice(end) }
}

interface Item { level: number; ordered: boolean; html: string }

function listHtml(items: Item[]): string {
  let out = ''
  const stack: { tag: 'ul' | 'ol'; open: boolean }[] = []
  const close = () => {
    const top = stack.pop()!
    out += `${top.open ? '</li>' : ''}</${top.tag}>`
  }
  for (const it of items) {
    const level = Math.max(1, Math.min(8, it.level))
    while (stack.length > level) close()
    if (stack.length === level) {
      const top = stack[stack.length - 1]!
      if (top.open) out += '</li>'
      top.open = false
    }
    while (stack.length < level) {
      const tag = stack.length === level - 1 && it.ordered ? 'ol' : 'ul'
      out += `<${tag}>`
      stack.push({ tag, open: false })
    }
    out += `<li>${it.html}`
    stack[stack.length - 1]!.open = true
  }
  while (stack.length) close()
  return out
}

const LIST_PARAGRAPH = /<p\b[^>]*mso-list:\s*l\d+\s+level\d+[^>]*>[\s\S]*?<\/p>/gi

function convertLists(html: string): string {
  const run = new RegExp(`(?:${LIST_PARAGRAPH.source}\\s*)+`, 'gi')
  return html.replace(run, (chunk) => {
    const items: Item[] = []
    for (const p of chunk.match(new RegExp(LIST_PARAGRAPH.source, 'gi')) ?? []) {
      const level = Number(/mso-list:\s*l\d+\s+level(\d+)/i.exec(p)?.[1] ?? 1)
      const inner = p.replace(/^<p\b[^>]*>/i, '').replace(/<\/p>$/i, '')
      const { marker, rest } = takeMarker(inner)
      // Without Word's marker (and the empty wrapper it leaves) and its blank space.
      const body = rest.replace(/<\/?o:p\b[^>]*>/gi, '').replace(/<span\b[^>]*>\s*<\/span>/gi, '').replace(/^(?:\s|&nbsp;|&#160;)+/i, '')
      // Nothing but the marker (an empty item): not worth a bullet.
      if (!textOf(body)) continue
      items.push({ level, ordered: isNumbering(marker), html: body })
    }
    return items.length ? listHtml(items) : ''
  })
}

function convertTables(html: string): string {
  let out = html
  // Innermost first, so a table inside a cell is flattened before its cell is read.
  for (let guard = 0; guard < 20 && /<table\b/i.test(out); guard++) {
    out = out.replace(/<table\b(?:(?!<table\b)[\s\S])*?<\/table>/gi, (table) => {
      const rows = table.match(/<tr\b[\s\S]*?<\/tr>/gi) ?? []
      return rows.map((tr) => {
        const cells = (tr.match(/<t[dh]\b[\s\S]*?<\/t[dh]>/gi) ?? []).map(textOf).filter(Boolean)
        return cells.length ? `<p>${escapeText(cells.join(' · '))}</p>` : ''
      }).join('')
    })
  }
  return out
}

function dropUnusableImages(html: string): { html: string; dropped: number } {
  let dropped = 0
  const out = html.replace(/<img\b[^>]*>/gi, (tag) => {
    const src = /\bsrc\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i.exec(tag)
    const value = decode((src?.[1] ?? src?.[2] ?? src?.[3] ?? '').trim())
    // Only a web address can be shown on the page; a path on the sender's computer, an embedded blob or nothing cannot.
    if (/^https?:\/\//i.test(value) || value.startsWith('/')) return tag
    dropped++
    return ''
  })
  return { html: out, dropped }
}

/** Make pasted HTML (Word and the like) say what its author meant. See the top of this file. */
export function cleanPastedHtml(html: string): PastedHtml {
  let out = String(html ?? '')
  // Word's conditional comments: the hidden kind goes with its content, the "revealed" kind only its markers.
  out = out.replace(/<!--\[if[\s\S]*?<!\[endif\]-->/gi, '').replace(/<!\[(?:if [^\]]*|endif)\]>/gi, '')
  if (/mso-list:/i.test(out)) out = convertLists(out)
  if (/<table\b/i.test(out)) out = convertTables(out)
  const { html: withoutImages, dropped } = dropUnusableImages(out)
  return { html: withoutImages, droppedImages: dropped }
}
