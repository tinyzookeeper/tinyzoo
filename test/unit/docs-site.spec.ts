import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import { buildDocs } from '../../site/modules/docs/build'
import { renderPage } from '../../site/modules/docs/render'
import { DOCS_LANGS, docsPath, type DocsNav, type DocsPage } from '../../site/shared/docs'

// The documentation on the website (site/modules/docs): docs/ rendered once per website
// language. Every page and link resolves, the translations of the editors' guide line up
// with the Czech one, and pictures and clips fall back to Czech.
const root = join(import.meta.dirname, '../..')
const built = buildDocs({ root, clipsDir: join(root, 'site/public/docs/clips') })
const pages = (lang: string) => [...built.files].filter(([k]) => k.startsWith(`${lang}/pages/`)).map(([, v]) => v as DocsPage)
const htmlOf = (p: DocsPage) => p.body.map((s) => ('html' in s ? s.html : '')).join('')

const ctx = {
  text: { copy: 'Copy', copied: 'Copied', zoom: 'Enlarge' },
  link: (href: string) => ({ href, external: href.startsWith('http') }),
  image: (src: string) => ({ src }),
  clip: (name: string) => (name === 'roles' ? '/docs/clips/roles.en.mp4' : null),
}

describe('the docs on the website', () => {
  it('has every page in every language, the editors in their own language and the developers in English', () => {
    for (const lang of DOCS_LANGS) {
      const nav = built.files.get(`${lang}/nav.json`) as DocsNav
      expect(nav.sections.editors.textLang).toBe(lang)
      expect(nav.sections.developers.textLang).toBe('en')
      expect(nav.sections.editors.groups[0]!.pages).toHaveLength(11)
      expect(nav.sections.developers.groups.flatMap((g) => g.pages).map((p) => p.slug)).toContain('getting-started')
      for (const p of pages(lang)) {
        expect(p.title, p.source).toBeTruthy()
        expect(p.path.startsWith(docsPath(lang as any)), p.path).toBe(true)
      }
    }
  })

  it('pairs each translated chapter with the Czech one: same pictures, same clips, same place', () => {
    const cs = (built.files.get('cs/nav.json') as DocsNav).sections.editors.groups[0]!.pages
    const media = (p: DocsPage) => ({
      pictures: [...htmlOf(p).matchAll(/<img src="\/docs\/img\/(?:0\.6\/(?:en|de)\/)?([^"]+)"/g)].map((m) => m[1]!.replace(/^0\.6\//, '')),
      // The clips the Markdown places (shown only once their file exists).
      clips: [...readFileSync(join(root, p.source), 'utf8').matchAll(/<!--\s*clip:\s*([a-z0-9-]+)/g)].map((m) => m[1]),
    })
    for (const lang of ['en', 'de'] as const) {
      const nav = (built.files.get(`${lang}/nav.json`) as DocsNav).sections.editors.groups[0]!.pages
      nav.forEach((p, i) => {
        const own = built.files.get(`${lang}/pages/editors/${p.slug}.json`) as DocsPage
        const czech = built.files.get(`cs/pages/editors/${cs[i]!.slug}.json`) as DocsPage
        expect(own.textLang).toBe(lang)
        expect(media(own), `${lang}/${p.slug} ↔ cs/${cs[i]!.slug}`).toEqual(media(czech))
        expect(own.alternates.cs).toBe(czech.path)
        expect(czech.alternates[lang]).toBe(own.path)
      })
    }
  })

  it('turns every link between pages into a website address that exists, with its anchor', () => {
    for (const lang of DOCS_LANGS) {
      const byPath = new Map(pages(lang).map((p) => [p.path, p]))
      const broken: string[] = []
      for (const p of pages(lang)) {
        for (const [, href] of htmlOf(p).matchAll(/href="([^"]+)"/g)) {
          if (/^(https?:|mailto:)/.test(href!)) continue
          if (href!.startsWith('/docs/img/')) { if (!built.images.has(href!.slice('/docs/img/'.length))) broken.push(`${p.path} → ${href}`); continue }
          const [path, hash] = href!.split('#') as [string, string?]
          const target = path ? byPath.get(path) : p
          if (!target) { broken.push(`${p.path} → ${href}`); continue }
          if (hash && !htmlOf(target).includes(` id="${hash}"`)) broken.push(`${p.path} → ${href} (no such heading)`)
        }
        expect(htmlOf(p), p.path).not.toMatch(/href="(?!https?:)[^"]*\.md(#|")/)
      }
      expect(broken, lang).toEqual([])
    }
  })

  it('serves every picture the pages show, and the search has their text', () => {
    for (const [rel] of built.images) expect(rel).toMatch(/\.(png|jpe?g|gif|webp|svg)$/)
    expect(built.images.size).toBeGreaterThan(10)
    const search = built.files.get('en/search.json') as { path: string; text: string }[]
    expect(search.some((s) => s.path === '/en/docs/editors/translations' && /original/i.test(s.text))).toBe(true)
  })
})

describe('pictures and clips per language', () => {
  const dir = mkdtempSync(join(tmpdir(), 'docs-site-'))
  afterAll(() => rmSync(dir, { recursive: true, force: true }))

  it('use the language’s own file when there is one, the Czech one when not, and leave out a clip with no file', () => {
    cpSync(join(root, 'docs'), join(dir, 'docs'), { recursive: true })
    mkdirSync(join(dir, 'docs/screenshots/0.6/en'), { recursive: true })
    writeFileSync(join(dir, 'docs/screenshots/0.6/en/team.png'), 'x')
    const clips = join(dir, 'clips')
    mkdirSync(clips)
    writeFileSync(join(clips, 'roles.cs.mp4'), 'x')
    writeFileSync(join(clips, 'roles.de.mp4'), 'x')
    const b = buildDocs({ root: dir, clipsDir: clips })
    const page = (key: string) => b.files.get(key) as DocsPage
    const en = page('en/pages/editors/roles-and-permissions.json')
    const de = page('de/pages/editors/rollen-und-berechtigungen.json')
    expect(htmlOf(en)).toContain('src="/docs/img/0.6/en/team.png"')
    expect(htmlOf(en)).toContain('src="/docs/img/0.6/roles-overview.png"')
    expect(htmlOf(de)).toContain('src="/docs/img/0.6/team.png"')
    expect(en.body.find((s) => 'clip' in s)).toMatchObject({ clip: { src: '/docs/clips/roles.cs.mp4' } })
    expect(de.body.find((s) => 'clip' in s)).toMatchObject({ clip: { src: '/docs/clips/roles.de.mp4' } })
    // No translate clip yet: nothing in its place.
    expect(page('cs/pages/editors/preklady.json').body.some((s) => 'clip' in s)).toBe(false)
  })
})

describe('rendering one page', () => {
  it('takes the title, the first paragraph, the headings (GitHub anchors) and a clip', () => {
    const r = renderPage('# Překlady\n\nJak na to.\n\n## Překládání s originálem\n\ntext\n\n<!-- clip: roles | Short video -->\n\n### Na telefonu\n\n<!-- clip: translate -->\n', ctx)
    expect(r.title).toBe('Překlady')
    expect(r.description).toBe('Jak na to.')
    expect(r.toc).toEqual([{ id: 'překládání-s-originálem', text: 'Překládání s originálem', level: 2 }, { id: 'na-telefonu', text: 'Na telefonu', level: 3 }])
    expect(r.body.filter((s) => 'clip' in s)).toEqual([{ clip: { src: '/docs/clips/roles.en.mp4', label: 'Short video' } }])
    expect(r.sections.map((s) => s.anchor)).toEqual(['', 'překládání-s-originálem', 'na-telefonu'])
  })

  it('draws code with a copy button and the file name from the check marker, and escapes HTML', () => {
    const r = renderPage('# T\n\n<!-- check: blog/app/pages/a.vue -->\n```vue\n<template><b>x</b></template>\n```\n\nA <script>alert(1)</script> tag.\n', ctx)
    const html = r.body.map((s) => ('html' in s ? s.html : '')).join('')
    expect(html).toContain('<span>a.vue</span>')
    expect(html).toContain('class="doc-copy"')
    expect(html).not.toContain('<script>')
    expect(html).not.toContain('<b>x</b>')
  })

  it('makes callouts of Tip and Pozor quotes, and figures of pictures on their own line', () => {
    const r = renderPage('# T\n\n> **Tip:** easier.\n\n> **Pozor:** careful.\n\n![A screen](../x.png)\n', ctx)
    const html = r.body.map((s) => ('html' in s ? s.html : '')).join('')
    expect(html).toContain('doc-note--tip')
    expect(html).toContain('doc-note--warn')
    expect(html).toMatch(/<figure class="doc-figure"><button type="button" class="doc-zoom"[^>]*><img src="..\/x.png" alt="A screen"/)
    expect(html).not.toMatch(/<p><figure/)
  })
})
