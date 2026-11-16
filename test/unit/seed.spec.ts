import { describe, expect, it } from 'vitest'
import { buildRegistry, defineSeed, isSeed } from 'tinyzoo'
import * as playground from '../../playground/cms.config'
import { Author, Navigation, Page, Post, SiteSettings, Tag } from '../../playground/cms.config'
import {
  changedKeys, covers, resetDeclared, runSeed, stableId, SeedError,
  type MediaRow, type Row, type SeedBackend, type SeedOp,
} from '../../packages/cms/cli/seed-engine'
import { formatOp, summarize } from '../../packages/cms/cli/seed'

// The seed builder against an in-memory site. The fake does what the server does to a
// stored value that matters here: ids and timestamps, a `v` stamped on every block,
// relations answered as ids, translations kept apart — and counts every write.

const reg = buildRegistry(playground)

function fakeSite() {
  let n = 0
  const tables = new Map<string, Row[]>()
  const tr = new Map<string, Row>()
  const globals = new Map<string, Row>()
  const gtr = new Map<string, Row>()
  const media: MediaRow[] = []
  const writes: string[] = []
  const rowsOf = (e: string) => { if (!tables.has(e)) tables.set(e, []); return tables.get(e)! }
  const stamp = (v: any): any => {
    if (Array.isArray(v)) return v.map(stamp)
    if (v && typeof v === 'object') {
      const out = Object.fromEntries(Object.entries(v).map(([k, x]) => [k, stamp(x)]))
      if (typeof out.id === 'string' && typeof out.type === 'string' && !('v' in out)) out.v = 1
      return out
    }
    return v
  }
  const id = (p: string) => `${p}-${++n}`
  const backend: SeedBackend = {
    async list(e) { return structuredClone(rowsOf(e)) },
    async get(e, rid, locale) {
      const row = rowsOf(e).find((r) => r.id === rid)
      if (!row) return null
      if (!locale) return structuredClone(row)
      const t = tr.get(`${e}:${rid}:${locale}`)
      const ent = reg.byName.get(e)!
      return structuredClone({ ...row, ...Object.fromEntries(ent.localized.map((k) => [k, null])), ...t, __translated: !!t })
    },
    async create(e, data) { writes.push(`create ${e}`); const row = { id: id(e), ...stamp(structuredClone(data)) }; rowsOf(e).push(row); return structuredClone(row) },
    async update(e, rid, data, locale) {
      writes.push(`update ${e}${locale ? `:${locale}` : ''}`)
      if (locale) { const k = `${e}:${rid}:${locale}`; tr.set(k, { ...tr.get(k), ...stamp(structuredClone(data)) }); return {} }
      const row = rowsOf(e).find((r) => r.id === rid)!
      Object.assign(row, stamp(structuredClone(data)))
      return structuredClone(row)
    },
    async remove(e, rid) { writes.push(`remove ${e}`); tables.set(e, rowsOf(e).filter((r) => r.id !== rid)) },
    async getGlobal(e, locale) {
      const row = globals.get(e)
      if (!row) return null
      if (!locale) return structuredClone(row)
      const t = gtr.get(`${e}:${locale}`)
      return structuredClone({ ...row, ...t, __translated: !!t })
    },
    async putGlobal(e, data, locale) {
      writes.push(`put ${e}${locale ? `:${locale}` : ''}`)
      if (locale) { gtr.set(`${e}:${locale}`, { ...stamp(structuredClone(data)) }); return {} }
      const row = { id: globals.get(e)?.id ?? id(e), ...stamp(structuredClone(data)) }
      globals.set(e, row)
      return structuredClone(row)
    },
    async findMedia(q) {
      return structuredClone(media.find((m) => m.name === q.name && m.folder === q.folder && m.size === q.size && m.mime === q.mime) ?? null)
    },
    async uploadMedia(file) {
      writes.push(`upload ${file.name}`)
      const row: MediaRow = { id: id('media'), name: file.name, folder: file.folder, mime: file.mime, size: file.data.byteLength, url: `/files/${file.name}`, alt: null, altLocales: null, focalX: null, focalY: null }
      media.push(row)
      return structuredClone(row)
    },
    async patchMedia(mid, d) {
      writes.push(`patch media`)
      const row = media.find((m) => m.id === mid)!
      if ('alt' in d) row.alt = d.alt ?? null
      if ('altLocales' in d) row.altLocales = d.altLocales ?? null
      if (d.focal) { row.focalX = Math.round(d.focal.x); row.focalY = Math.round(d.focal.y) }
      return structuredClone(row)
    },
    async removeMedia(mid) {
      writes.push('remove media')
      if (mid.startsWith('used')) throw Object.assign(new Error('409 Media is in use'), { status: 409 })
      media.splice(media.findIndex((m) => m.id === mid), 1)
    },
  }
  return { backend, writes, tables, globals, media, tr }
}

const files: Record<string, Uint8Array> = {
  '/site/seed/a.jpg': new Uint8Array(10),
  '/site/seed/b.jpg': new Uint8Array(20),
}
const readFile = async (p: string) => { const f = files[p]; if (!f) throw new Error('ENOENT'); return f }

async function run(site: ReturnType<typeof fakeSite>, fn: Parameters<typeof defineSeed>[0], apply = true) {
  const ops: SeedOp[] = []
  const result = await runSeed(defineSeed(fn), { reg, backend: site.backend, root: '/site', apply, readFile, onOp: (o) => ops.push(o) })
  return { ...result, ops }
}

const count = (ops: SeedOp[], action: string) => ops.filter((o) => o.action === action).length

describe('defineSeed', () => {
  it('wraps a function and is recognised', () => {
    expect(isSeed(defineSeed(async () => {}))).toBe(true)
    expect(isSeed(() => {})).toBe(false)
    expect(() => defineSeed(null as any)).toThrow(/takes a function/)
  })
})

describe('covers / changedKeys', () => {
  it('only compares what the seed gives', () => {
    expect(covers({ a: 1, v: 1 }, { a: 1 })).toBe(true)
    expect(covers({ a: 1 }, { a: 2 })).toBe(false)
    expect(covers({ a: 1 }, { b: undefined })).toBe(true)
  })
  it('treats every empty value alike', () => {
    for (const stored of [null, undefined, '', []]) expect(covers(stored, null)).toBe(true)
    expect(covers('x', null)).toBe(false)
    expect(covers([], [])).toBe(true)
  })
  it('compares dates by the instant and single-line text after trimming', () => {
    expect(covers('2026-01-01T09:00:00.000Z', new Date('2026-01-01T09:00:00Z').toISOString())).toBe(true)
    expect(covers('2026-01-01T09:00:00.000Z', '2026-01-01T10:00:00.000Z')).toBe(false)
    expect(covers('Hello', 'Hello ')).toBe(true)
  })
  it('compares arrays item by item and many-to-many lists as sets', () => {
    expect(covers([{ id: 'a', v: 1 }, { id: 'b' }], [{ id: 'a' }, { id: 'b' }])).toBe(true)
    expect(covers([{ id: 'b' }, { id: 'a' }], [{ id: 'a' }, { id: 'b' }])).toBe(false)
    expect(changedKeys({ tags: ['b', 'a'] }, { tags: ['a', 'b'] }, new Set(['tags']))).toEqual([])
    expect(changedKeys({ tags: ['a'] }, { tags: ['a', 'b'] }, new Set(['tags']))).toEqual(['tags'])
    expect(changedKeys(null, { a: 1, b: 2 })).toEqual(['a', 'b'])
  })
})

describe('keys and idempotency', () => {
  const tag = { name: 'Training', slug: 'training' }

  it('creates an entry once: a second run writes nothing and finds the same id', async () => {
    const site = fakeSite()
    let first = ''
    let second = ''
    await run(site, async (s) => { first = (await s.create(Tag, tag)).id })
    expect(site.writes).toEqual(['create tag'])
    const again = await run(site, async (s) => { second = (await s.create(Tag, tag)).id })
    expect(site.writes).toEqual(['create tag'])
    expect(second).toBe(first)
    expect(count(again.ops, 'kept')).toBe(1)
  })

  it('recognises an entry by the address field unless told otherwise', async () => {
    const site = fakeSite()
    await run(site, async (s) => { await s.create(Tag, tag) })
    await run(site, async (s) => { await s.create('tag', { name: 'Another name', slug: 'training' }) })
    expect(site.tables.get('tag')).toHaveLength(1)
  })

  it('asks for "by" when the entity has no address field, and accepts a field or several', async () => {
    const site = fakeSite()
    await expect(run(site, async (s) => { await s.create(Author, { name: 'Jana', email: 'jana@example.com' }) })).rejects.toThrow(/\{ by: 'field' \}/)
    await run(site, async (s) => { await s.create(Author, { name: 'Jana', email: 'jana@example.com' }, { by: 'email' }) })
    await run(site, async (s) => { await s.create(Author, { name: 'Jana', email: 'jana@example.com' }, { by: ['email', 'name'] }) })
    expect(site.tables.get('author')).toHaveLength(1)
  })

  it('fails clearly on a missing key value, an unfit key field, a typo, a twin and a wrong kind of content', async () => {
    const site = fakeSite()
    await expect(run(site, async (s) => { await s.create(Tag, { name: 'x' } as any) })).rejects.toThrow(/key field "slug" needs a value/)
    await expect(run(site, async (s) => { await s.create(Post, {} as any, { by: 'body' }) })).rejects.toThrow(/"body" cannot be a key/)
    await expect(run(site, async (s) => { await s.create(Post, {} as any, { by: 'nope' as any }) })).rejects.toThrow(/not a field/)
    await expect(run(site, async (s) => { await s.create('tag', { naem: 'x', slug: 'x' }) })).rejects.toThrow(/tag has no field "naem"/)
    await expect(run(site, async (s) => { await s.create(Tag, tag); await s.create(Tag, tag) })).rejects.toThrow(/in the seed twice/)
    await expect(run(site, async (s) => { await s.create('nothing', { slug: 'x' }) })).rejects.toThrow(/No content called "nothing"/)
    await expect(run(site, async (s) => { await s.create(SiteSettings, { siteName: 'x' } as any) })).rejects.toThrow(/is a global: use s.global/)
    await expect(run(site, async (s) => { await s.global(Tag, { name: 'x' } as any) })).rejects.toThrow(/is a collection/)
  })

  it('says which entry a failure belongs to', async () => {
    const site = fakeSite()
    site.backend.create = async () => { throw new Error('422 Validation failed — title: Required') }
    await expect(run(site, async (s) => { await s.create(Tag, tag) })).rejects.toThrow(/^tag training: 422 Validation failed — title: Required/)
  })

  it('create leaves an existing entry as editors left it; upsert brings it back, once', async () => {
    const site = fakeSite()
    await run(site, async (s) => { await s.upsert(Tag, tag) })
    site.tables.get('tag')![0]!.name = 'Edited by an editor'

    await run(site, async (s) => { await s.create(Tag, tag) })
    expect(site.tables.get('tag')![0]!.name).toBe('Edited by an editor')

    const second = await run(site, async (s) => { await s.upsert(Tag, tag) })
    expect(site.tables.get('tag')![0]!.name).toBe('Training')
    expect(second.ops.find((o) => o.action === 'updated')?.fields).toEqual(['name'])

    const writes = site.writes.length
    const third = await run(site, async (s) => { await s.upsert(Tag, tag) })
    expect(site.writes.length).toBe(writes)
    expect(count(third.ops, 'unchanged')).toBe(1)
  })

  it('fields the seed leaves out are not touched by an upsert', async () => {
    const site = fakeSite()
    await run(site, async (s) => { await s.upsert(Post, { title: 'P', slug: 'p', author: 'a', body: s.rich.doc(), status: 'draft' }) })
    site.tables.get('post')![0]!.status = 'published'
    const again = await run(site, async (s) => { await s.upsert(Post, { title: 'P', slug: 'p', author: 'a', body: s.rich.doc() }) })
    expect(count(again.ops, 'unchanged')).toBe(1)
  })

  it('compares dates by the instant, so a Date in the seed is not an update', async () => {
    const site = fakeSite()
    const at = new Date('2026-03-01T09:00:00Z')
    const seed = (s: any) => s.upsert(Post, { title: 'P', slug: 'p', author: 'a', body: s.rich.doc(), publishedAt: at })
    await run(site, async (s) => { await seed(s) })
    const again = await run(site, async (s) => { await seed(s) })
    expect(count(again.ops, 'unchanged')).toBe(1)
    expect(site.writes).toEqual(['create post'])
  })
})

describe('relations', () => {
  it('uses the ids the seed got back, and a many-to-many list in any order', async () => {
    const site = fakeSite()
    const seed = (order: 0 | 1) => async (s: any) => {
      const author = await s.create(Author, { name: 'Jana', email: 'j@example.com' }, { by: 'email' })
      const a = await s.create(Tag, { name: 'A', slug: 'a' })
      const b = await s.create(Tag, { name: 'B', slug: 'b' })
      await s.upsert(Post, { title: 'P', slug: 'p', author: author.id, tags: order ? [b.id, a.id] : [a.id, b.id], body: s.rich.doc() })
    }
    await run(site, seed(0))
    const post = site.tables.get('post')![0]!
    expect(post.author).toBe(site.tables.get('author')![0]!.id)
    expect(post.tags).toHaveLength(2)
    const writes = site.writes.length
    await run(site, seed(1))
    expect(site.writes.length).toBe(writes)
  })

  it('accepts an entry where an id is wanted', async () => {
    const site = fakeSite()
    await run(site, async (s) => {
      const author = await s.create(Author, { name: 'Jana', email: 'j@example.com' }, { by: 'email' })
      await s.create(Post, { title: 'P', slug: 'p', author: author as any, body: s.rich.doc() })
    })
    expect(site.tables.get('post')![0]!.author).toBe(site.tables.get('author')![0]!.id)
  })
})

describe('blocks and lists', () => {
  const page = (s: any, extra: Row = {}) => s.upsert(Page, {
    title: 'Home', slug: 'home',
    sections: [
      { type: 'hero', heading: 'Hello', lead: 'x', image: null, buttonLabel: 'Go', buttonUrl: '/go' },
      { type: 'cards', heading: 'Cards', items: [{ title: 'One', text: 'a', image: null }, { title: 'Two', text: 'b', image: null }] },
    ],
    ...extra,
  })

  it('gives blocks and list items stable ids, so a second run changes nothing', async () => {
    const site = fakeSite()
    await run(site, async (s) => { await page(s) })
    const stored = site.tables.get('page')![0]!.sections
    expect(stored.every((b: any) => typeof b.id === 'string' && b.id)).toBe(true)
    expect(stored[1].items.map((i: any) => i.type)).toEqual(['item', 'item'])
    expect(new Set(stored[1].items.map((i: any) => i.id)).size).toBe(2)
    const again = await run(site, async (s) => { await page(s) })
    expect(count(again.ops, 'unchanged')).toBe(1)
    expect(site.writes).toEqual(['create page'])
  })

  it('keeps an id the seed gives, and an edited block is an update', async () => {
    const site = fakeSite()
    await run(site, async (s) => {
      await s.upsert(Page, { title: 'H', slug: 'h', sections: [{ id: 'mine', type: 'text', heading: 'A', body: s.rich.doc(s.rich.p('x')) }] })
    })
    expect(site.tables.get('page')![0]!.sections[0].id).toBe('mine')
    const again = await run(site, async (s) => {
      await s.upsert(Page, { title: 'H', slug: 'h', sections: [{ id: 'mine', type: 'text', heading: 'B', body: s.rich.doc(s.rich.p('x')) }] })
    })
    expect(again.ops.find((o) => o.action === 'updated')?.fields).toEqual(['sections'])
  })

  it('makes ids that differ for the same list in another entry or language', () => {
    expect(stableId('page/a/sections/0/hero/')).not.toBe(stableId('page/b/sections/0/hero/'))
    expect(stableId('x')).toBe(stableId('x'))
  })
})

describe('translations', () => {
  const seed = (mode: 'create' | 'upsert', en: Row = { title: 'About', slug: 'about' }) => async (s: any) => {
    const page = await s[mode](Page, { title: 'O nás', slug: 'o-nas', sections: [] })
    await s.translate(page, 'en', en)
  }

  it('writes a translation once; a second run writes nothing', async () => {
    const site = fakeSite()
    await run(site, seed('upsert'))
    expect(site.writes).toEqual(['create page', 'update page:en'])
    await run(site, seed('upsert'))
    expect(site.writes).toEqual(['create page', 'update page:en'])
  })

  it('takes translations as an option, for entries and globals', async () => {
    const site = fakeSite()
    await run(site, async (s) => {
      await s.upsert(Page, { title: 'O nás', slug: 'o-nas', sections: [] }, { translations: { en: { title: 'About', slug: 'about' } } })
      await s.global(Navigation, { main: [s.link('Domů', '/')], footer: [] }, { translations: { en: { main: [s.link('Home', '/en')] } } })
    })
    expect(site.writes).toEqual(['create page', 'update page:en', 'put navigation', 'put navigation:en'])
    await run(site, async (s) => {
      await s.upsert(Page, { title: 'O nás', slug: 'o-nas', sections: [] }, { translations: { en: { title: 'About', slug: 'about' } } })
      await s.global(Navigation, { main: [s.link('Domů', '/')], footer: [] }, { translations: { en: { main: [s.link('Home', '/en')] } } })
    })
    expect(site.writes).toHaveLength(4)
  })

  it('follows the entry: after create an existing translation stays, after upsert it is made to match', async () => {
    const site = fakeSite()
    await run(site, seed('upsert'))
    site.tr.set(`page:${site.tables.get('page')![0]!.id}:en`, { title: 'Edited', slug: 'about' })
    await run(site, seed('create'))
    expect([...site.tr.values()][0]!.title).toBe('Edited')
    await run(site, seed('upsert'))
    expect([...site.tr.values()][0]!.title).toBe('About')
  })

  it('create fills in a translation that is missing', async () => {
    const site = fakeSite()
    await run(site, async (s) => { await s.create(Page, { title: 'O nás', slug: 'o-nas', sections: [] }) })
    await run(site, seed('create'))
    expect(site.writes).toContain('update page:en')
  })

  it('explains the usual mistakes', async () => {
    const site = fakeSite()
    await expect(run(site, async (s) => { const p = await s.create(Page, { title: 'x', slug: 'x', sections: [] }); await s.translate(p, 'cs', { title: 'y' }) }))
      .rejects.toThrow(/cs is the default language/)
    await expect(run(site, async (s) => { const p = await s.create(Page, { title: 'x2', slug: 'x2', sections: [] }); await s.translate(p, 'de', { title: 'y' }) }))
      .rejects.toThrow(/de is not one of the site's languages \(cs, en\)/)
    await expect(run(site, async (s) => { const p = await s.create(Page, { title: 'x3', slug: 'x3', sections: [] }); await s.translate(p, 'en', { status: 'draft' }) }))
      .rejects.toThrow(/status is not translated per language; translatable fields: title, slug, sections/)
    await expect(run(site, async (s) => { const a = await s.create(Author, { name: 'J', email: 'j@example.com' }, { by: 'email' }); await s.translate(a, 'en', { name: 'x' }) }))
      .rejects.toThrow(/nothing to translate/)
  })
})

describe('globals', () => {
  it('saves a global once; upsert follows the seed, ifMissing leaves a saved one alone', async () => {
    const site = fakeSite()
    const seed = (name: string, o?: any) => async (s: any) => { await s.global(SiteSettings, { siteName: name, openingHours: [{ days: 'Mon', hours: '9–17' }] }, o) }
    await run(site, seed('Site'))
    expect(site.writes).toEqual(['put siteSettings'])
    await run(site, seed('Site'))
    expect(site.writes).toHaveLength(1)
    await run(site, seed('Renamed', { ifMissing: true }))
    expect(site.globals.get('siteSettings')!.siteName).toBe('Site')
    const third = await run(site, seed('Renamed'))
    expect(site.globals.get('siteSettings')!.siteName).toBe('Renamed')
    expect(third.ops[0]).toMatchObject({ action: 'updated', fields: ['siteName'] })
  })
})

describe('upload', () => {
  it('uploads a file once and sets its description; a second run finds it', async () => {
    const site = fakeSite()
    const seed = async (s: any) => { return s.upload('seed/a.jpg', { alt: 'A desk', altLocales: { en: 'A desk (en)' }, focal: { x: 30, y: 60 } }) }
    let a = ''
    let b = ''
    await run(site, async (s) => { a = await seed(s) })
    expect(site.writes).toEqual(['upload a.jpg', 'patch media'])
    expect(site.media[0]).toMatchObject({ alt: 'A desk', focalX: 30, focalY: 60, folder: null })
    await run(site, async (s) => { b = await seed(s) })
    expect(site.writes).toHaveLength(2)
    expect(b).toBe(a)
  })

  it('uploads a file once even when the seed asks for it twice, and patches only a changed description', async () => {
    const site = fakeSite()
    let ids: string[] = []
    await run(site, async (s) => { ids = [await s.upload('seed/a.jpg'), await s.upload('./seed/a.jpg')] })
    expect(ids[0]).toBe(ids[1])
    expect(site.media).toHaveLength(1)
    const ops = (await run(site, async (s) => { await s.upload('seed/a.jpg', { alt: 'New' }) })).ops
    expect(ops[0]).toMatchObject({ action: 'updated', fields: ['alt'] })
    expect((await run(site, async (s) => { await s.upload('seed/a.jpg', { alt: 'New' }) })).ops[0]!.action).toBe('unchanged')
  })

  it('tells files apart by name, folder and size', async () => {
    const site = fakeSite()
    await run(site, async (s) => { await s.upload('seed/a.jpg'); await s.upload('seed/b.jpg'); await s.upload('seed/a.jpg', { folder: 'Demo' }); await s.upload('seed/a.jpg', { name: 'other.jpg' }) })
    expect(site.media).toHaveLength(4)
    await run(site, async (s) => { await s.upload('seed/a.jpg'); await s.upload('seed/b.jpg'); await s.upload('seed/a.jpg', { folder: 'Demo' }); await s.upload('seed/a.jpg', { name: 'other.jpg' }) })
    expect(site.media).toHaveLength(4)
  })

  it('fails clearly on a missing file and an unknown type', async () => {
    const site = fakeSite()
    await expect(run(site, async (s) => { await s.upload('seed/missing.jpg') })).rejects.toThrow(/seed\/missing.jpg: no such file/)
    await expect(run(site, async (s) => { await s.upload('seed/a.xyz') })).rejects.toThrow(/cannot tell the file type/)
  })

  it('puts a picture into rich text with the file\'s address', async () => {
    const site = fakeSite()
    let doc: any
    await run(site, async (s) => { const m = await s.upload('seed/a.jpg'); doc = s.rich.doc(s.rich.image(m, 'A desk')) })
    expect(doc.content[0].attrs).toMatchObject({ src: '/files/a.jpg', alt: 'A desk' })
    expect(doc.content[0].attrs.mediaId).toBe(site.media[0]!.id)
  })
})

describe('links', () => {
  it('links an address, or an entry by its address on the website in a language', async () => {
    const site = fakeSite()
    let links: any[] = []
    await run(site, async (s) => {
      const post = await s.create(Post, { title: 'Hello', slug: 'hello', author: 'a', body: s.rich.doc() })
      const page = await s.create(Page, { title: 'O nás', slug: 'o-nas', sections: [] }, { translations: { en: { slug: 'about' } } })
      links = [s.link('Home', '/'), s.link('Hello', post), s.link('O nás', page), s.link('About', page, { locale: 'en', newTab: true })]
    })
    expect(links.map((l) => l.url)).toEqual(['/', '/blog/hello', '/o-nas', '/en/pages/about'])
    expect(links[3]).toMatchObject({ type: 'link', newTab: true, sub: false })
    expect(new Set(links.map((l) => l.id)).size).toBe(4)
  })

  it('says when an entry has no address on the website', async () => {
    const site = fakeSite()
    await expect(run(site, async (s) => { const a = await s.create(Author, { name: 'J', email: 'j@example.com' }, { by: 'email' }); s.link('Jana', a) }))
      .rejects.toThrow(/author has no address on the website/)
  })
})

describe('dry run and reset', () => {
  const seed = async (s: any) => {
    const m = await s.upload('seed/a.jpg')
    const tag = await s.create(Tag, { name: 'A', slug: 'a' })
    await s.upsert(Post, { title: 'P', slug: 'p', author: 'x', tags: [tag.id], hero: m, body: s.rich.doc() })
    await s.global(SiteSettings, { siteName: 'S' })
  }

  it('writes nothing and plans everything on an empty site', async () => {
    const site = fakeSite()
    const r = await run(site, seed, false)
    expect(site.writes).toEqual([])
    expect(r.ops.map((o) => o.action)).toEqual(['uploaded', 'created', 'created', 'created'])
    expect(r.declared).toEqual({ entries: [], media: [] })
  })

  it('on a seeded site a dry run reports what is up to date and what would change', async () => {
    const site = fakeSite()
    await run(site, seed)
    const writes = site.writes.length
    const unchanged = await run(site, seed, false)
    expect(unchanged.ops.every((o) => o.action === 'unchanged' || o.action === 'kept')).toBe(true)
    site.tables.get('tag')![0]!.name = 'Edited'
    const changed = await run(site, async (s) => { await s.upsert(Tag, { name: 'A', slug: 'a' }) }, false)
    expect(changed.ops[0]).toMatchObject({ action: 'updated', fields: ['name'] })
    expect(site.writes.length).toBe(writes)
  })

  it('finds what the seed owns, and a reset removes it (last first) and keeps the rest', async () => {
    const site = fakeSite()
    await run(site, seed)
    await run(site, async (s) => { await s.create(Tag, { name: 'Mine', slug: 'mine' }) })
    const { declared } = await run(site, seed, false)
    expect(declared.entries.map((e) => e.label)).toEqual(['tag a', 'post p'])
    expect(declared.media).toHaveLength(1)
    const lines: string[] = []
    const out = await resetDeclared(site.backend, declared, (l) => lines.push(l))
    expect(out).toEqual({ entries: 2, media: 1, keptMedia: 0 })
    expect(lines[0]).toContain('post p')
    expect(site.tables.get('tag')!.map((t) => t.slug)).toEqual(['mine'])
    expect(site.media).toHaveLength(0)
    // …and the seed fills it all in again, uploading the file once more.
    await run(site, seed)
    expect(site.media).toHaveLength(1)
    expect(site.tables.get('post')).toHaveLength(1)
  })

  it('leaves a file that is still in use', async () => {
    const site = fakeSite()
    const out = await resetDeclared(site.backend, { entries: [], media: [{ id: 'used-1', label: 'a.jpg' }] })
    expect(out).toEqual({ entries: 0, media: 0, keptMedia: 1 })
  })

  it('names a failure to remove an entry', async () => {
    const site = fakeSite()
    site.backend.remove = async () => { throw Object.assign(new Error('409 Still in use'), { status: 409 }) }
    await expect(resetDeclared(site.backend, { entries: [{ entity: 'tag', id: 't1', label: 'tag a' }], media: [] })).rejects.toThrow(SeedError)
  })
})

describe('report', () => {
  it('prints one line per step and a summary', () => {
    expect(formatOp({ action: 'created', kind: 'entry', entity: 'page', label: 'page home' }, false)).toBe('✓ created      page home')
    expect(formatOp({ action: 'updated', kind: 'entry', entity: 'page', label: 'page home', fields: ['title', 'sections'] }, true)).toBe('✓ would update page home (title, sections)')
    expect(formatOp({ action: 'unchanged', kind: 'entry', entity: 'page', label: 'page home' }, false)).toBe('· unchanged    page home')
    const ops: SeedOp[] = [
      { action: 'created', kind: 'entry', label: 'a' }, { action: 'unchanged', kind: 'entry', label: 'b' }, { action: 'unchanged', kind: 'entry', label: 'c' },
      { action: 'uploaded', kind: 'media', label: 'f' },
    ]
    expect(summarize(ops, false)).toBe('1 created, 2 already up to date, 1 file uploaded')
    expect(summarize([], false)).toBe('nothing to do')
  })
})
