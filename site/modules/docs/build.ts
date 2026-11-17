// docs/ → the documentation on the website, once per website language: every page as
// JSON (title, headings, HTML, the same page in the other languages, previous and next),
// the table of contents, the text for the search, and the pictures the pages show.
//
// What is published and in which order comes from the Markdown itself:
//  - editors: docs/editors/<lang>/README.md and the chapters its numbered list links, in
//    that order; a language without its own guide shows the Czech one. The chapters pair
//    up across languages by their place in that list.
//  - developers: the table under the first heading of docs/README.md (English for now).
import { existsSync, readFileSync, statSync } from 'node:fs'
import { dirname, extname, join, posix } from 'node:path'
import { Marked, type Tokens } from 'marked'
import {
  DOCS_LANGS, DOCS_SECTIONS, docsPath,
  type DocsLang, type DocsNav, type DocsNavGroup, type DocsPage, type DocsSearchSection, type DocsSection,
} from '../../shared/docs'
import { plainText, renderPage } from './render'

const GITHUB = 'https://github.com/tinyzookeeper/tinyzoo'
const DEFAULT: DocsLang = 'cs'

/** The texts the build writes into pages (the rest of the chrome is in app/lib/site-i18n.ts). */
const TEXT: Record<DocsLang, { copy: string; copied: string; zoom: string; editors: string; developers: string; chapters: string; guides: string; reference: string }> = {
  cs: { copy: 'Kopírovat', copied: 'Zkopírováno', zoom: 'Zvětšit obrázek', editors: 'Pro editory', developers: 'Pro vývojáře', chapters: 'Kapitoly', guides: 'Návody', reference: 'Reference' },
  en: { copy: 'Copy', copied: 'Copied', zoom: 'Enlarge picture', editors: 'For editors', developers: 'For developers', chapters: 'Chapters', guides: 'Guides', reference: 'Reference' },
  de: { copy: 'Kopieren', copied: 'Kopiert', zoom: 'Bild vergrößern', editors: 'Für die Redaktion', developers: 'Für Entwickler', chapters: 'Kapitel', guides: 'Anleitungen', reference: 'Referenz' },
}

export interface DocsBuildOptions {
  /** The repository (docs/ is in it). */
  root: string
  /** Where clips are: <name>.<lang>.mp4, served at `clipsUrl`. */
  clipsDir: string
  clipsUrl?: string
  /** Where pictures are served (docs/screenshots/x.png → <imagesUrl>/x.png). */
  imagesUrl?: string
}

export interface DocsBuild {
  /** JSON files to serve: '<lang>/nav.json', '<lang>/search.json', '<lang>/pages/<section>/<slug or _index>.json'. */
  files: Map<string, unknown>
  /** Pictures to publish: their path under `imagesUrl` → the file in the repository. */
  images: Map<string, string>
  /** Every Markdown file read (for the dev watcher and the tests). */
  sources: string[]
}

interface Source {
  section: DocsSection
  /** Index in the part's order (0 = its README / index page). */
  index: number
  slug: string
  /** Repository path, e.g. docs/editors/cs/preklady.md (null: the developers' index, made from docs/README.md). */
  file: string
  /** Short title for menus (the link text in the list or table). */
  navTitle: string
  /** The sentence beside it there. */
  navDescription: string
  group: string
  textLang: DocsLang
}

const marked = new Marked({ gfm: true })
const read = (file: string) => readFileSync(file, 'utf8')

/** The editors' chapters in one language: README.md's numbered list of links. */
function editorSources(root: string, lang: DocsLang): Source[] | null {
  const readme = join(root, 'docs/editors', lang, 'README.md')
  if (!existsSync(readme)) return null
  const tokens = marked.lexer(read(readme))
  const list = tokens.find((t): t is Tokens.List => t.type === 'list' && t.ordered && t.items.some((i: Tokens.ListItem) => /\]\([^)]+\.md\)/.test(i.text)))
  if (!list) throw new Error(`docs/editors/${lang}/README.md: no numbered list of chapters`)
  const out: Source[] = [{
    section: 'editors', index: 0, slug: '', file: `docs/editors/${lang}/README.md`, navTitle: '', navDescription: '', group: 'chapters', textLang: lang,
  }]
  for (const item of list.items) {
    const m = /^\[([^\]]+)\]\(([^)#]+\.md)\)\s*:?\s*([\s\S]*)$/.exec(item.text.trim())
    if (!m) throw new Error(`docs/editors/${lang}/README.md: "${item.text}" is not "[Title](file.md): what it is about"`)
    const file = `docs/editors/${lang}/${m[2]}`
    if (!existsSync(join(root, file))) throw new Error(`docs/editors/${lang}/README.md links ${m[2]}, which does not exist`)
    out.push({
      section: 'editors', index: out.length, slug: m[2]!.replace(/\.md$/, ''), file,
      navTitle: m[1]!, navDescription: plainText(marked.parseInline(m[3]!.replace(/\.$/, '')) as string), group: 'chapters', textLang: lang,
    })
  }
  return out
}

/** The developer pages: the table under the first heading of docs/README.md. */
function developerSources(root: string): Source[] {
  const tokens = marked.lexer(read(join(root, 'docs/README.md')))
  const table = tokens.find((t): t is Tokens.Table => t.type === 'table')
  if (!table) throw new Error('docs/README.md: no table of developer pages')
  const out: Source[] = [{
    section: 'developers', index: 0, slug: '', file: 'docs/README.md', navTitle: '', navDescription: '', group: 'guides', textLang: 'en',
  }]
  for (const row of table.rows) {
    const m = /^\[([^\]]+)\]\(([^)#]+\.md)\)$/.exec(row[0]!.text.trim())
    // Only pages in docs/ (not AGENTS.md or llms.txt, which live elsewhere).
    if (!m || m[2]!.startsWith('..')) continue
    out.push({
      section: 'developers', index: out.length, slug: posix.basename(m[2]!, '.md'), file: `docs/${m[2]}`,
      navTitle: m[1]!, navDescription: plainText(marked.parseInline(row[1]!.text) as string),
      group: m[2]!.startsWith('guide/') ? 'guides' : 'reference', textLang: 'en',
    })
  }
  return out
}

/** A PNG's size from its header (no image library needed). */
function pngSize(file: string): { width: number; height: number } | undefined {
  try {
    const b = readFileSync(file)
    if (b.toString('ascii', 1, 4) !== 'PNG') return undefined
    return { width: b.readUInt32BE(16), height: b.readUInt32BE(20) }
  } catch { return undefined }
}

export function buildDocs(opts: DocsBuildOptions): DocsBuild {
  const { root, clipsDir } = opts
  const clipsUrl = opts.clipsUrl ?? '/docs/clips'
  const imagesUrl = opts.imagesUrl ?? '/docs/img'
  const files = new Map<string, unknown>()
  const images = new Map<string, string>()
  const sources = new Set<string>(['docs/README.md'])

  const editorsCs = editorSources(root, DEFAULT)
  if (!editorsCs) throw new Error('docs/editors/cs/README.md is missing')
  const editorsBy: Record<DocsLang, Source[]> = { cs: editorsCs, en: editorsCs, de: editorsCs }
  for (const lang of DOCS_LANGS) {
    if (lang === DEFAULT) continue
    const own = editorSources(root, lang)
    if (own && own.length !== editorsCs.length) throw new Error(`docs/editors/${lang}/README.md lists ${own.length - 1} chapters, the Czech one ${editorsCs.length - 1}: they pair up by their place in the list`)
    if (own) editorsBy[lang] = own
  }
  const developers = developerSources(root)
  const partsOf = (lang: DocsLang): Record<DocsSection, Source[]> => ({ editors: editorsBy[lang], developers })

  // Every Markdown file that is a page → which page it is (to turn links into website addresses).
  const pageOfFile = new Map<string, Source>()
  for (const lang of DOCS_LANGS) for (const s of [...editorsBy[lang], ...developers]) pageOfFile.set(s.file, s)

  for (const lang of DOCS_LANGS) {
    const parts = partsOf(lang)
    const text = TEXT[lang]
    const nav: DocsNav = { lang, sections: {} as DocsNav['sections'] }
    const search: DocsSearchSection[] = []
    const rendered = new Map<Source, DocsPage>()

    for (const section of DOCS_SECTIONS) {
      const list = parts[section]
      for (const src of list) {
        sources.add(src.file)
        const abs = join(root, src.file)
        const dir = dirname(src.file)

        const ctx = {
          text,
          link(href: string) {
            if (/^[a-z][a-z0-9+.-]*:/i.test(href) || href.startsWith('//')) return { href, external: !href.startsWith('mailto:') }
            if (href.startsWith('#')) return { href, external: false }
            const [path = '', hash = ''] = href.split('#') as [string, string?]
            const target = posix.normalize(posix.join(dir, decodeURI(path)))
            const page = pageOfFile.get(target)
            if (page) {
              // The page in this website's language; an anchor only when it is the same text.
              const same = parts[page.section][page.index]!
              const to = docsPath(lang, page.section, same.slug || undefined)
              return { href: hash && same.file === target ? `${to}#${hash}` : to, external: false }
            }
            const img = target.startsWith('docs/screenshots/') ? ctx.image(href) : null
            if (img) return { href: img.src, external: false }
            const full = join(root, target)
            const kind = existsSync(full) && statSync(full).isDirectory() ? 'tree' : 'blob'
            return { href: `${GITHUB}/${kind}/main/${target}${hash ? `#${hash}` : ''}`, external: true }
          },
          image(href: string) {
            if (/^[a-z]+:/i.test(href)) return { src: href }
            const target = posix.normalize(posix.join(dir, decodeURI(href)))
            if (!target.startsWith('docs/screenshots/')) return null
            // docs/screenshots/0.6/<lang>/x.png when there is one, else the Czech docs/screenshots/0.6/x.png.
            const own = lang === DEFAULT ? null : posix.join(posix.dirname(target), lang, posix.basename(target))
            const file = own && existsSync(join(root, own)) ? own : target
            if (!existsSync(join(root, file))) return null
            const rel = posix.relative('docs/screenshots', file)
            images.set(rel, join(root, file))
            return { src: `${imagesUrl}/${rel}`, ...(extname(file) === '.png' ? pngSize(join(root, file)) : {}) }
          },
          clip(name: string) {
            for (const l of [lang, DEFAULT]) if (existsSync(join(clipsDir, `${name}.${l}.mp4`))) return `${clipsUrl}/${name}.${l}.mp4`
            return null
          },
        }

        let markdown = read(abs)
        if (src.file === 'docs/README.md') markdown = developersIndexMarkdown(markdown)
        else if (src.slug === '' && section === 'editors') markdown = withoutContentsList(markdown)
        const page = renderPage(markdown, ctx)
        const title = src.slug === '' && section === 'developers' ? text.developers : page.title
        const path = docsPath(lang, section, src.slug || undefined)
        const alternates = Object.fromEntries(DOCS_LANGS.map((l) => [l, docsPath(l, section, partsOf(l)[section][src.index]!.slug || undefined)])) as Record<DocsLang, string>
        const doc: DocsPage = {
          section, slug: src.slug, path, textLang: src.textLang, title,
          description: page.description, toc: page.toc, body: page.body, alternates,
          prev: null, next: null, source: src.file,
        }
        rendered.set(src, doc)
        for (const s of page.sections) search.push({ ...s, path, page: title, section })
      }
      // Previous and next, in the part's order.
      list.forEach((src, i) => {
        const doc = rendered.get(src)!
        const at = (j: number) => { const s = list[j]; return s ? { title: rendered.get(s)!.title, path: rendered.get(s)!.path } : null }
        doc.prev = at(i - 1)
        doc.next = at(i + 1)
        files.set(`${lang}/pages/${section}/${src.slug || '_index'}.json`, doc)
      })
      const groups: DocsNavGroup[] = []
      for (const src of list.slice(1)) {
        let g = groups.find((x) => x.id === src.group)
        if (!g) groups.push(g = { id: src.group, title: text[src.group as 'chapters' | 'guides' | 'reference'] ?? src.group, pages: [] })
        const doc = rendered.get(src)!
        g.pages.push({ slug: src.slug, title: src.navTitle || doc.title, description: src.navDescription || doc.description, path: doc.path })
      }
      nav.sections[section] = { section, title: text[section], path: docsPath(lang, section), textLang: list[0]!.textLang, groups }
    }
    files.set(`${lang}/nav.json`, nav)
    files.set(`${lang}/search.json`, search)
  }
  return { files, images, sources: [...sources] }
}

/** The editors' README without its list of chapters (the website shows them as cards). */
function withoutContentsList(md: string): string {
  const tokens = marked.lexer(md)
  let out = ''
  let skipping = false
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i]!
    if (t.type === 'heading' && t.depth === 2) {
      // The heading whose section holds the numbered list of chapters.
      const next = tokens.slice(i + 1).find((x) => x.type !== 'space' && x.type !== 'paragraph')
      skipping = next?.type === 'list' && (next as Tokens.List).ordered && /\]\([^)]+\.md\)/.test(next.raw)
    }
    if (!skipping) out += t.raw
  }
  return out
}

/** docs/README.md → the developers' index: its first section's introduction (the table becomes cards). */
function developersIndexMarkdown(md: string): string {
  const tokens = marked.lexer(md)
  const start = tokens.findIndex((t) => t.type === 'heading' && t.depth === 2)
  let out = '# Developers\n\n'
  for (const t of tokens.slice(start + 1)) {
    if ((t.type === 'heading' && t.depth <= 2) || t.type === 'table') break
    out += t.raw
  }
  return out
}

