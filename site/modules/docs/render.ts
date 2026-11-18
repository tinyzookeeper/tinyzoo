// One Markdown page of docs/ → what the website shows: its title, description, headings,
// the HTML in pieces (a clip between two pieces is drawn by ClipVideo) and its text by
// heading for the search. Links and pictures are resolved by the caller (build.ts), which
// knows where every page lives on the website.
import { Marked, type Token, type Tokens } from 'marked'
import type { DocsHeading, DocsSearchSection, DocsSegment } from '../../shared/docs'

export interface RenderContext {
  /** A link's href (as written in the Markdown) → its address on the website. */
  link(href: string): { href: string; external: boolean }
  /** A picture's src → its address on the website and its size, or null when the file is missing. */
  image(src: string): { src: string; width?: number; height?: number } | null
  /** A clip's name → its address, or null when there is no file for it (yet). */
  clip(name: string): string | null
  text: { copy: string; copied: string; zoom: string }
}

export interface RenderedPage {
  title: string
  description: string
  toc: DocsHeading[]
  body: DocsSegment[]
  /** The text under each heading (anchor '' = before the first one). */
  sections: Omit<DocsSearchSection, 'path' | 'page' | 'section'>[]
}

/** GitHub's heading anchor: lowercase, punctuation dropped, spaces to dashes (as test/unit/doc-links.spec.ts). */
export function slug(heading: string): string {
  return heading.toLowerCase().replace(/<[^>]*>/g, '').replace(/[^\p{L}\p{N}\s-]/gu, '').trim().replace(/\s/g, '-')
}

export const escapeHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', '#39': "'", nbsp: ' ' }
/** HTML → the text a reader sees (tags gone, entities decoded, spaces collapsed). */
export const plainText = (html: string) => html
  .replace(/<[^>]*>/g, ' ')
  .replace(/&(amp|lt|gt|quot|#39|nbsp);/g, (_, e: string) => ENTITIES[e]!)
  .replace(/\s+/g, ' ')
  .trim()

/** `<!-- clip: roles | Short video: … -->`: a looping clip, see docs/README.md. */
export const CLIP = /^<!--\s*clip:\s*([a-z0-9-]+)\s*(?:\|\s*([\s\S]*?))?\s*-->\s*$/
/** `<!-- check: group/path -->` before a code block (scripts/docs-check.ts): the file the code is. */
const CHECK = /^<!--\s*check:\s*[^\s/]+\/(\S+?)(?:\s+\S+)?\s*-->\s*$/
/**
 * A callout: a quote that starts with a bold lead. **Tip:**, **Pozor:** and the like get their colour;
 * any other lead (**What you have to do**, **Not covered by tests yet:**) is a plain box. A quote
 * without a bold lead stays a quote.
 */
const NOTES: Record<string, 'tip' | 'warn'> = { 'tip': 'tip', 'tipp': 'tip', 'pozor': 'warn', 'watch out': 'warn', 'achtung': 'warn' }

const LANGUAGE_NAMES: Record<string, string> = {
  ts: 'TypeScript', typescript: 'TypeScript', js: 'JavaScript', vue: 'Vue', json: 'JSON', jsonc: 'JSON',
  bash: 'Terminal', sh: 'Terminal', shell: 'Terminal', sql: 'SQL', diff: 'Diff', dockerfile: 'Dockerfile', yaml: 'YAML', yml: 'YAML',
}

export function renderPage(source: string, ctx: RenderContext): RenderedPage {
  let title = ''
  let description = ''
  const toc: DocsHeading[] = []
  const body: DocsSegment[] = []
  const sections: RenderedPage['sections'] = [{ anchor: '', heading: '', text: '' }]
  const seen = new Map<string, number>()
  let codeFile: string | null = null
  let html = ''

  const marked = new Marked({ gfm: true })
  marked.use({
    renderer: {
      heading(this: any, { tokens, depth, text }: Tokens.Heading) {
        const inner = this.parser.parseInline(tokens)
        const base = slug(text.replace(/\[([^\]]*)\]\([^)]*\)/g, '$1'))
        const n = seen.get(base) ?? 0
        seen.set(base, n + 1)
        const id = n ? `${base}-${n}` : base
        if (depth === 2 || depth === 3) {
          toc.push({ id, text: plainText(inner), level: depth })
          sections.push({ anchor: id, heading: plainText(inner), text: '' })
        }
        const level = Math.min(depth, 6)
        return `<h${level} id="${escapeHtml(id)}"><a class="doc-anchor" href="#${escapeHtml(id)}">${inner}</a></h${level}>\n`
      },
      code({ text, lang }: Tokens.Code) {
        const language = (lang ?? '').trim().split(/\s+/)[0]!.toLowerCase()
        const name = codeFile ?? LANGUAGE_NAMES[language] ?? ''
        codeFile = null
        return `<div class="doc-code"><div class="doc-code-bar"><span>${escapeHtml(name)}</span>`
          + `<button type="button" class="doc-copy" data-copied="${escapeHtml(ctx.text.copied)}">${escapeHtml(ctx.text.copy)}</button></div>`
          + `<pre><code${language ? ` data-lang="${escapeHtml(language)}"` : ''}>${highlight(text, language)}</code></pre></div>\n`
      },
      html({ text }: Tokens.HTML | Tokens.Tag) {
        // Comments (check markers, notes to authors) are not for readers; other HTML is shown as written.
        return /^\s*<!--[\s\S]*-->\s*$/.test(text) ? '' : escapeHtml(text)
      },
      link(this: any, { href, title: linkTitle, tokens }: Tokens.Link) {
        const to = ctx.link(href)
        const attrs = to.external ? ' rel="noopener" class="doc-external"' : ''
        return `<a href="${escapeHtml(to.href)}"${linkTitle ? ` title="${escapeHtml(linkTitle)}"` : ''}${attrs}>${this.parser.parseInline(tokens)}</a>`
      },
      image({ href, text }: Tokens.Image) {
        const img = ctx.image(href)
        if (!img) return ''
        const size = img.width && img.height ? ` width="${img.width}" height="${img.height}"` : ''
        return `<figure class="doc-figure"><button type="button" class="doc-zoom" aria-label="${escapeHtml(ctx.text.zoom)}">`
          + `<img src="${escapeHtml(img.src)}" alt="${escapeHtml(text)}"${size} loading="lazy" decoding="async"></button></figure>`
      },
      paragraph(this: any, { tokens }: Tokens.Paragraph) {
        // A picture on its own line is a figure, not a picture inside a paragraph.
        if (tokens.length && tokens.every((t) => t.type === 'image' || (t.type === 'text' && !t.raw.trim()) || t.type === 'br')) {
          return `${this.parser.parseInline(tokens)}\n`
        }
        return `<p>${this.parser.parseInline(tokens)}</p>\n`
      },
      blockquote(this: any, { tokens }: Tokens.Blockquote) {
        const inner = this.parser.parse(tokens)
        const first = tokens[0]
        const lead = first?.type === 'paragraph' ? /^\*\*([^*]+?)\*\*/.exec(first.raw) : null
        if (!lead) return `<blockquote>${inner}</blockquote>\n`
        const kind = NOTES[lead[1]!.replace(/:\s*$/, '').trim().toLowerCase()]
        return `<aside class="doc-note${kind ? ` doc-note--${kind}` : ''}">${inner}</aside>\n`
      },
      table(this: any, token: Tokens.Table) {
        const cell = (c: Tokens.TableCell, tag: 'th' | 'td') => {
          const align = c.align ? ` style="text-align:${c.align}"` : ''
          return `<${tag}${align}>${this.parser.parseInline(c.tokens)}</${tag}>`
        }
        const head = token.header.some((c) => c.text.trim())
          ? `<thead><tr>${token.header.map((c) => cell(c, 'th')).join('')}</tr></thead>`
          : ''
        const rows = token.rows.map((r) => `<tr>${r.map((c) => cell(c, 'td')).join('')}</tr>`).join('')
        return `<div class="doc-table"><table>${head}<tbody>${rows}</tbody></table></div>\n`
      },
    },
  })

  const tokens = marked.lexer(source)
  const flush = () => { if (html) { body.push({ html }); html = '' } }
  const parse = (t: Token) => marked.parser(Object.assign([t], { links: tokens.links }) as any)

  for (const token of tokens) {
    if (token.type === 'heading' && token.depth === 1 && !title) {
      title = plainText(marked.parseInline(token.text) as string)
      continue
    }
    if (token.type === 'html') {
      const clip = CLIP.exec(token.text.trim())
      if (clip) {
        const src = ctx.clip(clip[1]!)
        if (src) { flush(); body.push({ clip: { src, label: (clip[2] ?? '').trim() || clip[1]! } }) }
        continue
      }
      const check = CHECK.exec(token.text.trim())
      if (check) { codeFile = check[1]!.split('/').pop()!; continue }
    }
    const out = parse(token)
    html += out
    if (token.type === 'paragraph' && !description && title) description = plainText(out)
    if (token.type !== 'heading' && token.type !== 'code' && token.type !== 'space') {
      const text = plainText(out)
      if (text) { const s = sections[sections.length - 1]!; s.text += (s.text ? '\n' : '') + text }
    }
  }
  flush()
  return { title, description, toc, body, sections: sections.filter((s) => s.anchor || s.text) }
}

// ── a small highlighter: comments, strings, keywords, tags, calls ──────────────────────

const JS_KEYWORDS = 'import|from|export|const|let|var|await|async|return|if|else|default|true|false|null|undefined|new|function|type|interface|extends|as|for|of|in|throw|try|catch'
const SQL_KEYWORDS = 'SELECT|FROM|WHERE|AND|OR|INSERT|INTO|VALUES|UPDATE|SET|DELETE|CREATE|ALTER|TABLE|INDEX|EXTENSION|IF|NOT|EXISTS|ON|USING|DROP|ADD|COLUMN|PRIMARY|KEY|REFERENCES|NULL|DEFAULT|GRANT|TO|ALL|BEGIN|COMMIT'
/** Per family: a pattern whose numbered groups are, in order, the classes listed. */
const GRAMMARS: Record<string, { re: RegExp; classes: string[] }> = {
  js: {
    re: new RegExp(String.raw`(\/\/[^\n]*|\/\*[\s\S]*?\*\/|<!--[\s\S]*?-->)|('(?:[^'\\\n]|\\.)*'|"(?:[^"\\\n]|\\.)*"|\`(?:[^\`\\]|\\.)*\`)|(<\/?[A-Za-z][\w.-]*|\/?>)|\b(${JS_KEYWORDS})\b|\b([A-Za-z_$][\w$]*)(?=\()`, 'g'),
    classes: ['c', 's', 't', 'k', 'f'],
  },
  sh: {
    re: /((?:^|(?<=\s))#[^\n]*)|('[^'\n]*'|"(?:[^"\\\n]|\\.)*")|((?<=\s)--?[A-Za-z][\w-]*)|((?:^|(?<=\n))(?:pnpm|npm|npx|node|docker|git|cd|cp|mv|rm|mkdir|psql|pg_dump|export|curl|tinyzoo|FROM|RUN|COPY|WORKDIR|ENV|CMD|EXPOSE|USER)\b)/g,
    classes: ['c', 's', 't', 'f'],
  },
  sql: { re: new RegExp(String.raw`(--[^\n]*)|('(?:[^'\n]|'')*')|\b(${SQL_KEYWORDS})\b`, 'gi'), classes: ['c', 's', 'k'] },
}
const FAMILY: Record<string, string> = {
  ts: 'js', typescript: 'js', js: 'js', javascript: 'js', vue: 'js', json: 'js', jsonc: 'js',
  bash: 'sh', sh: 'sh', shell: 'sh', dockerfile: 'sh', sql: 'sql',
}

export function highlight(code: string, language: string): string {
  if (language === 'diff') {
    return code.split('\n').map((l) => (l.startsWith('+') ? `<span class="tk-add">${escapeHtml(l)}</span>` : l.startsWith('-') ? `<span class="tk-del">${escapeHtml(l)}</span>` : escapeHtml(l))).join('\n')
  }
  const grammar = GRAMMARS[FAMILY[language] ?? '']
  if (!grammar) return escapeHtml(code)
  let out = ''
  let last = 0
  for (const m of code.matchAll(new RegExp(grammar.re.source, grammar.re.flags))) {
    const all = m[0]
    if (!all) continue
    const group = m.findIndex((g, i) => i > 0 && g !== undefined)
    const cls = group > 0 ? grammar.classes[group - 1] : undefined
    out += escapeHtml(code.slice(last, m.index))
    out += cls ? `<span class="tk-${cls}">${escapeHtml(all)}</span>` : escapeHtml(all)
    last = m.index! + all.length
  }
  return out + escapeHtml(code.slice(last))
}
