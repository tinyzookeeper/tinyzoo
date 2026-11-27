import { cpSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import { matchEntry, searchTerms } from 'tinyzoo'
import { buildDocs } from '../../site/modules/docs/build'
import { czechSpaces, renderPage } from '../../site/modules/docs/render'
import { DOCS_LANGS, docsPath, type DocsNav, type DocsPage } from '../../site/shared/docs'

// The documentation on the website (site/modules/docs): docs/ rendered once per website
// language. Every page and link resolves, the translations of the editors' guide line up
// with the Czech one, and pictures and clips fall back to Czech.
const root = join(import.meta.dirname, '../..')
const built = buildDocs({ root, clipsDir: join(root, 'site/public/docs/clips') })
const pages = (lang: string) => [...built.files].filter(([k]) => k.startsWith(`${lang}/pages/`)).map(([, v]) => v as DocsPage)
/** Every page of every website, by its address (a Czech page may link to an English developer page). */
const everyPage = new Map(DOCS_LANGS.flatMap((l) => pages(l)).map((p) => [p.path, p]))
const htmlOf = (p: DocsPage) => p.body.map((s) => ('html' in s ? s.html : '')).join('')

const ctx = {
  text: { copy: 'Copy', copied: 'Copied', zoom: 'Enlarge' },
  link: (href: string) => ({ href, external: href.startsWith('http') }),
  image: (src: string) => ({ src }),
  clip: (name: string) => (name === 'roles' ? '/docs/clips/roles.en.mp4' : null),
}

describe('the docs on the website', () => {
  it('has the editors in every language and the developers in English, on the English website only', () => {
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
      // The Czech and German contents lead to the English developer pages; those websites have none of their own.
      const devPaths = [nav.sections.developers.path, ...nav.sections.developers.groups.flatMap((g) => g.pages).map((p) => p.path)]
      for (const path of devPaths) expect(everyPage.get(path)?.textLang, path).toBe('en')
      expect(devPaths.every((p) => p.startsWith(docsPath('en', 'developers'))), lang).toBe(true)
      if (lang !== 'en') expect(pages(lang).filter((p) => p.section === 'developers'), lang).toEqual([])
    }
    // A developer page is the same text everywhere: it names no other language's address.
    for (const p of pages('en').filter((x) => x.section === 'developers')) expect(p.alternates, p.path).toEqual({ en: p.path })
  })

  it('finds the developer pages from the Czech and German search, at their English address', () => {
    for (const lang of ['cs', 'de'] as const) {
      const search = built.files.get(`${lang}/search.json`) as { path: string; section: string; text: string }[]
      const dev = search.filter((s) => s.section === 'developers')
      expect(dev.length, lang).toBeGreaterThan(50)
      expect(dev.every((s) => s.path.startsWith('/en/docs/developers')), lang).toBe(true)
      expect(dev.some((s) => s.path === '/en/docs/developers/plugin-reference'), lang).toBe(true)
    }
  })

  it('gives the Czech search plain spaces, while the pages keep their non-breaking ones', () => {
    // czechSpaces puts U+00A0 after one-letter words; a visitor types a normal space. plainText collapses
    // every \s (U+00A0 included) into a plain space, so headings and text in search.json match the query
    // as typed, and the whole-phrase bonus applies. (tinyzoo's foldSearchText folds U+00A0 too.)
    const search = built.files.get('cs/search.json') as { heading: string; page: string; text: string }[]
    expect(JSON.stringify(search)).not.toContain('\u00a0')
    expect(pages('cs').some((p) => htmlOf(p).includes('\u00a0'))).toBe(true)
    const s = search.find((x) => /^\S+ [aikosuvz] \S+/.test(x.heading))!
    expect(s, 'a heading with a one-letter word').toBeTruthy()
    const terms = searchTerms(s.heading)
    const withNbsp = czechSpaces(s.heading)
    expect(withNbsp).not.toBe(s.heading)
    expect(matchEntry(withNbsp, [s.text], terms, s.heading)!.score).toBe(matchEntry(s.heading, [s.text], terms, s.heading)!.score)
  })

  it('pairs each translated chapter with the Czech one: same pictures, same clips, same place', () => {
    const cs = (built.files.get('cs/nav.json') as DocsNav).sections.editors.groups[0]!.pages
    const media = (p: DocsPage) => ({
      // docs/screenshots/<version>/<lang>/x.png and the Czech <version>/x.png count as the same picture.
      pictures: [...htmlOf(p).matchAll(/<img src="\/docs\/img\/([^"]+)"/g)].map((m) => m[1]!.replace(/^(\d+\.\d+\/)(?:en|de)\//, '$1')),
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
      const byPath = everyPage
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

  it('has a place in the sidebar and in previous/next for every developer page, the generated ones included', () => {
    for (const lang of DOCS_LANGS) {
      const nav = built.files.get(`${lang}/nav.json`) as DocsNav
      const listed = nav.sections.developers.groups.flatMap((g) => g.pages)
      // The sidebar's order is the reading order: walking "next" from the part's first page visits each page once.
      const byPath = everyPage
      const walked: string[] = []
      for (let p: DocsPage | undefined = byPath.get(nav.sections.developers.path); p; p = p.next ? byPath.get(p.next.path) : undefined) walked.push(p.path)
      expect(walked.slice(1), lang).toEqual(listed.map((p) => p.path))
    }
    for (const p of pages('en').filter((x) => x.section === 'developers')) expect(p.title, p.path).toBeTruthy()
    // The reference's worked example follows the reference, and is made from the OpenAPI document, in English everywhere.
    const en = built.files.get('en/nav.json') as DocsNav
    const slugs = en.sections.developers.groups.flatMap((g) => g.pages).map((p) => p.slug)
    expect(slugs.indexOf('api-example')).toBe(slugs.indexOf('content-api-reference') + 1)
    const page = built.files.get('en/pages/developers/api-example.json') as DocsPage
    expect(page.textLang).toBe('en')
    expect(page.source).toBe('test/contracts/openapi.playground.json')
    expect(htmlOf(page)).toContain('/api/content/post')
    expect(slugs).toContain('plugins')
    // The plugin reference follows the plugins guide.
    expect(slugs.indexOf('plugin-reference')).toBe(slugs.indexOf('plugins') + 1)
    expect(slugs).toContain('api-surface')
    expect(slugs).toContain('stability')
  })

  it('publishes every page of docs/guide and docs/ for developers, except the ones for people working on tinyzoo', () => {
    // A new page is either in docs/README.md's table (so on the website) or named here as not for site builders.
    const forContributors = new Set(['README', 'development', 'roadmap', 'production-plan', 'pilot-plan', 'ui-foundation', 'multi-tenant-plan', 'one-app-plan', 'custom-types-plan', 'model-file-plan', 'look-as-data-plan'])
    const published = new Set((built.files.get('en/nav.json') as DocsNav).sections.developers.groups.flatMap((g) => g.pages).map((p) => p.slug))
    const files = [...readdirSync(join(root, 'docs/guide')), ...readdirSync(join(root, 'docs'))].filter((n) => n.endsWith('.md')).map((n) => n.replace(/\.md$/, ''))
    expect(files.filter((n) => !published.has(n) && !forContributors.has(n))).toEqual([])
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
    // The page generated from the OpenAPI document needs its document.
    mkdirSync(join(dir, 'test/contracts'), { recursive: true })
    cpSync(join(root, 'test/contracts/openapi.playground.json'), join(dir, 'test/contracts/openapi.playground.json'))
    // The repository's own English and German screenshots would decide the case: start from none.
    for (const lang of ['en', 'de']) rmSync(join(dir, 'docs/screenshots/0.6', lang), { recursive: true, force: true })
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

describe('the developer pages in the Czech and German contents', () => {
  const dir = mkdtempSync(join(tmpdir(), 'docs-site-nav-'))
  afterAll(() => rmSync(dir, { recursive: true, force: true }))

  it('take a description docs/README.md leaves empty from the English page, as the English contents do', () => {
    cpSync(join(root, 'docs'), join(dir, 'docs'), { recursive: true })
    mkdirSync(join(dir, 'test/contracts'), { recursive: true })
    cpSync(join(root, 'test/contracts/openapi.playground.json'), join(dir, 'test/contracts/openapi.playground.json'))
    const readme = join(dir, 'docs/README.md')
    const row = /^\| \[Content model\]\(guide\/content-model\.md\) \| .* \|$/m
    expect(readFileSync(readme, 'utf8')).toMatch(row)
    writeFileSync(readme, readFileSync(readme, 'utf8').replace(row, '| [Content model](guide/content-model.md) | |'))
    const b = buildDocs({ root: dir, clipsDir: join(root, 'site/public/docs/clips') })
    const english = b.files.get('en/pages/developers/content-model.json') as DocsPage
    expect(english.description).toBeTruthy()
    for (const lang of DOCS_LANGS) {
      const entry = (b.files.get(`${lang}/nav.json`) as DocsNav).sections.developers.groups.flatMap((g) => g.pages).find((p) => p.slug === 'content-model')
      expect(entry, lang).toMatchObject({ title: 'Content model', description: english.description, path: english.path })
    }
  })
})

describe('rendering one page', () => {
  it('keeps a Czech one-letter word on the line of the word after it, outside code and links', () => {
    const nb = '\u00A0'
    expect(czechSpaces('Klikněte v menu a k tomu i s obrázkem')).toBe(`Klikněte v${nb}menu a${nb}k${nb}tomu i${nb}s${nb}obrázkem`)
    expect(czechSpaces('V menu, (a) b, bod a.')).toBe(`V${nb}menu, (a) b, bod a.`)
    const cs = renderPage('# T\n\n## Co je v menu\n\nOtevřete v adminu `a b` a [s odkazem](x.md) a\nkonec.\n\n- k seznamu\n', { ...ctx, lang: 'cs' })
    const html = cs.body.map((s) => ('html' in s ? s.html : '')).join('')
    expect(html).toContain(`Otevřete v${nb}adminu <code>a b</code> a${nb}<a href="x.md">s${nb}odkazem</a> a${nb}konec.`)
    expect(html).toContain(`<li>k${nb}seznamu</li>`)
    // The anchor stays GitHub's, made from the source.
    expect(cs.toc[0]!.id).toBe('co-je-v-menu')
    // English (and German) text is left alone.
    const en = renderPage('# T\n\nA b and a c.\n', { ...ctx, lang: 'en' })
    expect(en.body.map((s) => ('html' in s ? s.html : '')).join('')).toContain('A b and a c.')
  })

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
    expect(html).toMatch(/<figure class="doc-figure">/)
  })

  it('makes a plain box of a quote with any other bold lead, and leaves a real quote alone', () => {
    const r = renderPage('# T\n\n> **What you have to do**\n>\n> 1. Update.\n\n> Said someone.\n', ctx)
    const html = r.body.map((s) => ('html' in s ? s.html : '')).join('')
    expect(html).toMatch(/<aside class="doc-note"><p><strong>What you have to do<\/strong><\/p>\n<ol>/)
    expect(html).toContain('<blockquote><p>Said someone.</p>')
  })

  it('draws pictures on their own line as figures', () => {
    const r = renderPage('# T\n\n![A screen](../x.png)\n', ctx)
    const html = r.body.map((s) => ('html' in s ? s.html : '')).join('')
    expect(html).toMatch(/<figure class="doc-figure"><button type="button" class="doc-zoom"[^>]*><img src="..\/x.png" alt="A screen"/)
    expect(html).not.toMatch(/<p><figure/)
  })
})
