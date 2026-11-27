import { describe, expect, it } from 'vitest'
import { buildRegistry, defineEntity, defineSeed, defineSingleton, f, isSeed } from 'tinyzoo'
import * as playground from '../../playground/cms.config'
import { Author, Navigation, Page, Post, SiteSettings, Tag } from '../../playground/cms.config'
import {
  changedKeys, covers, describeReset, planReset, resetDeclared, runSeed, stableId, SeedError,
  type MediaRow, type ResetPlan, type Row, type SeedBackend, type SeedOp,
} from '../../packages/cms/cli/seed-engine'
import { formatOp, isLocalHostname, sendsPasswordInTheClear, summarize } from '../../packages/cms/cli/seed'

// The seed builder against an in-memory site. The fake does what the server does to a
// stored value that matters here: ids (uuids) and who made / last changed an entry, a `v`
// stamped on every block, relations answered as ids, translations kept apart, a delete
// refused (409) while a link or a relation still points at the entry — and counts every
// write. `site.as('editor')` changes who the writes are made by.

const reg = buildRegistry(playground)

function fakeSite() {
  let n = 0
  const tables = new Map<string, Row[]>()
  const tr = new Map<string, Row>()
  const globals = new Map<string, Row>()
  const gtr = new Map<string, Row>()
  const media: MediaRow[] = []
  const writes: string[] = []
  const who = { user: 'seed-user' }
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
  const id = (_p: string) => `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`
  /** What still points at an entry (a link by reference, in any row or translation, or a relation): the reason the site refuses to delete it. */
  const inUse = (e: string, rid: string): string | null => {
    const ref = `cms:${e}/${rid}`
    const others: [string, any][] = [
      ...[...tables].flatMap(([t, rows]) => rows.filter((r) => r.id !== rid).map((r): [string, any] => [t, r])),
      ...[...globals].map(([t, r]): [string, any] => [t, r]),
      ...[...tr.entries()].filter(([k]) => !k.includes(`:${rid}:`)).map(([k, r]): [string, any] => [k.split(':')[0]!, r]),
      ...[...gtr].map(([k, r]): [string, any] => [k.split(':')[0]!, r]),
    ]
    for (const [t, row] of others) {
      if (JSON.stringify(row).toLowerCase().includes(ref)) return `${t} links to it`
      if (Object.values(row).some((v) => v === rid || (Array.isArray(v) && v.includes(rid)))) return `${t} points at it`
    }
    return null
  }
  const backend: SeedBackend = {
    async account() { return who.user },
    async list(e) { return structuredClone(rowsOf(e)) },
    async get(e, rid, locale) {
      const row = rowsOf(e).find((r) => r.id === rid)
      if (!row) return null
      if (!locale) return structuredClone(row)
      const t = tr.get(`${e}:${rid}:${locale}`)
      const ent = reg.byName.get(e)!
      return structuredClone({ ...row, ...Object.fromEntries(ent.localized.map((k) => [k, null])), ...t, __translated: !!t })
    },
    async create(e, data) { writes.push(`create ${e}`); const row = { id: id(e), ...stamp(structuredClone(data)), createdBy: who.user, updatedBy: who.user }; rowsOf(e).push(row); return structuredClone(row) },
    async update(e, rid, data, locale) {
      writes.push(`update ${e}${locale ? `:${locale}` : ''}`)
      if (locale) { const k = `${e}:${rid}:${locale}`; tr.set(k, { ...tr.get(k), ...stamp(structuredClone(data)) }); return {} }
      const row = rowsOf(e).find((r) => r.id === rid)!
      Object.assign(row, stamp(structuredClone(data)), { updatedBy: who.user })
      return structuredClone(row)
    },
    async remove(e, rid) {
      const why = inUse(e, rid)
      if (why) throw Object.assign(new Error(`409 Still in use by other content (${why})`), { status: 409 })
      writes.push(`remove ${e}`)
      tables.set(e, rowsOf(e).filter((r) => r.id !== rid))
    },
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
  return { backend, writes, tables, globals, media, tr, gtr, as: (user: string) => { who.user = user } }
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
  const ref = (entity: string, id: string) => `cms:${entity}/${id}`

  it('links an address as it is, and a page the website links to by reference, so the link follows the page', async () => {
    const site = fakeSite()
    let links: any[] = []
    let ids: string[] = []
    await run(site, async (s) => {
      const post = await s.create(Post, { title: 'Hello', slug: 'hello', author: 'a', body: s.rich.doc() })
      const page = await s.create(Page, { title: 'O nás', slug: 'o-nas', sections: [] }, { translations: { en: { slug: 'about' } } })
      ids = [post.id, page.id]
      links = [s.link('Home', '/'), s.link('Hello', post), s.link('O nás', page), s.link('About', page, { locale: 'en', newTab: true })]
    })
    // No address is worked out for an entry: the server resolves the reference to the address in the language asked for.
    expect(links.map((l) => l.url)).toEqual(['/', ref('post', ids[0]!), ref('page', ids[1]!), ref('page', ids[1]!)])
    expect(links[3]).toMatchObject({ type: 'link', newTab: true, sub: false })
    expect(new Set(links.map((l) => l.id)).size).toBe(4)
  })

  it('refers to a page under another page too (its address, /o-nas/tym, is the server\'s to work out)', async () => {
    const site = fakeSite()
    let team: any
    let url = ''
    await run(site, async (s) => {
      const about = await s.create(Page, { title: 'O nás', slug: 'o-nas', sections: [] })
      team = await s.create(Page, { title: 'Tým', slug: 'tym', parent: about.id, sections: [] })
      url = s.link('Tým', team).url
    })
    expect(url).toBe(ref('page', team.id))
    expect(url).not.toBe('/tym')
  })

  it('stores the menu\'s links as references, and a second run (or a run after links:convert) writes nothing', async () => {
    const site = fakeSite()
    const seed = async (s: any) => {
      const home = await s.upsert(Page, { title: 'Úvod', slug: 'uvod', sections: [] })
      await s.global(Navigation, { main: [s.link('Úvod', home), s.link('Blog', '/blog')], footer: [] })
    }
    await run(site, seed)
    const stored = site.globals.get('navigation')!.main
    expect(stored[0].url).toBe(ref('page', site.tables.get('page')![0]!.id))
    expect(stored[1].url).toBe('/blog')
    const writes = site.writes.length
    const again = await run(site, seed)
    expect(site.writes.length).toBe(writes)
    expect(count(again.ops, 'unchanged')).toBe(2)
    // links:convert (or the server) spelling the id in capitals is still the same link.
    stored[0].url = ref('page', site.tables.get('page')![0]!.id.toUpperCase())
    expect(count((await run(site, seed)).ops, 'updated')).toBe(0)
    expect(site.writes.length).toBe(writes)
  })

  it('brings a menu that an older seed filled with plain addresses over to references, once', async () => {
    const site = fakeSite()
    await run(site, async (s) => { await s.upsert(Page, { title: 'Úvod', slug: 'uvod', sections: [] }); await s.global(Navigation, { main: [s.link('Úvod', '/uvod')], footer: [] }) })
    const seed = async (s: any) => { const home = await s.upsert(Page, { title: 'Úvod', slug: 'uvod', sections: [] }); await s.global(Navigation, { main: [s.link('Úvod', home)], footer: [] }) }
    const first = await run(site, seed)
    expect(first.ops.find((o) => o.kind === 'global')).toMatchObject({ action: 'updated', fields: ['main'] })
    expect((await run(site, seed)).ops.every((o) => o.action === 'unchanged')).toBe(true)
  })

  it('in a dry run, where the page has no id yet, shows a readable address instead', async () => {
    const site = fakeSite()
    let links: any[] = []
    await run(site, async (s) => {
      const page = await s.create(Page, { title: 'O nás', slug: 'o-nas', sections: [] }, { translations: { en: { slug: 'about' } } })
      links = [s.link('O nás', page), s.link('About', page, { locale: 'en' })]
    }, false)
    expect(links.map((l) => l.url)).toEqual(['/o-nas', '/en/pages/about'])
  })

  it('says when an entry has no address on the website', async () => {
    const site = fakeSite()
    await expect(run(site, async (s) => { const a = await s.create(Author, { name: 'J', email: 'j@example.com' }, { by: 'email' }); s.link('Jana', a) }))
      .rejects.toThrow(/author has no address on the website/)
  })

  it('treats a stored reference and the seed\'s as the same link whatever the case of the id', () => {
    const id = '0f6c1a2e-3b4d-4e5f-8a9b-0c1d2e3f4a5b'
    expect(covers(`cms:page/${id.toUpperCase()}`, `cms:page/${id}`)).toBe(true)
    expect(covers(`cms:page/${id}`, 'cms:post/' + id)).toBe(false)
    expect(covers('/o-nas', `cms:page/${id}`)).toBe(false)
  })
})

const plan = (p: Partial<ResetPlan>): ResetPlan => ({ entries: [], media: [], clear: [], kept: [], blocked: [], ...p })

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
    expect(r.declared).toEqual({ entries: [], media: [], foreign: [], globals: [{ entity: 'siteSettings', label: 'siteSettings' }] })
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
    const plan = await planReset(reg, site.backend, declared)
    expect(plan.blocked).toEqual([])
    const out = await resetDeclared(site.backend, plan, (l) => lines.push(l))
    expect(out).toEqual({ entries: 2, media: 1, keptMedia: 0, cleared: 0 })
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
    const out = await resetDeclared(site.backend, plan({ media: [{ id: 'used-1', label: 'a.jpg' }] }))
    expect(out).toEqual({ entries: 0, media: 0, keptMedia: 1, cleared: 0 })
  })

  it('names a failure to remove an entry', async () => {
    const site = fakeSite()
    site.backend.remove = async () => { throw Object.assign(new Error('409 Still in use'), { status: 409 }) }
    await expect(resetDeclared(site.backend, plan({ entries: [{ entity: 'tag', id: 't1', label: 'tag a' }] }))).rejects.toThrow(SeedError)
  })
})

describe('--reset only removes what the seed made', () => {
  const tag = { name: 'Training', slug: 'training' }
  const scan = async (site: ReturnType<typeof fakeSite>, fn: Parameters<typeof defineSeed>[0]) => (await run(site, fn, false)).declared

  it('leaves an entry that was there before the seed, kept by s.create, and says why', async () => {
    const site = fakeSite()
    site.as('editor')
    await run(site, async (s) => { await s.create(Tag, tag); await s.create(Tag, { name: 'Other', slug: 'other' }) })
    site.as('seed-user')
    const seed = async (s: any) => { await s.create(Tag, tag); await s.create(Tag, { name: 'Mine', slug: 'mine' }) }
    await run(site, seed) // makes "mine"; "training" is the editor's and is kept as it is
    const declared = await scan(site, seed)
    expect(declared.entries.map((e) => e.label)).toEqual(['tag mine'])
    expect(declared.foreign).toMatchObject([{ label: 'tag training', why: expect.stringContaining('not made by the account') }])
    const out = await resetDeclared(site.backend, await planReset(reg, site.backend, declared))
    expect(out.entries).toBe(1)
    expect(site.tables.get('tag')!.map((t) => t.slug).sort()).toEqual(['other', 'training'])
  })

  it('leaves a page an editor made with the slug of an s.upsert too, and an entry somebody else changed after s.create', async () => {
    const site = fakeSite()
    site.as('editor')
    await run(site, async (s) => { await s.create(Page, { title: 'Hand made', slug: 'o-nas', sections: [] }) })
    site.as('seed-user')
    const seed = async (s: any) => {
      await s.upsert(Page, { title: 'O nás', slug: 'o-nas', sections: [] })
      await s.create(Tag, tag)
    }
    await run(site, seed)
    site.as('editor')
    await site.backend.update('tag', site.tables.get('tag')![0]!.id, { name: 'Renamed by an editor' })
    site.as('seed-user')
    const declared = await scan(site, seed)
    expect(declared.entries).toEqual([])
    expect(declared.foreign.map((x) => [x.label, x.why])).toEqual([
      ['page o-nas', 'not made by the account the seed signs in with'],
      ['tag training', 'changed by someone else since'],
    ])
    await resetDeclared(site.backend, await planReset(reg, site.backend, declared))
    expect(site.writes.filter((w) => w.startsWith('remove'))).toEqual([])
  })

  it('removes the entries the seed made with s.create and s.upsert, even after the seed\'s own later saves', async () => {
    const site = fakeSite()
    const seed = async (s: any) => { await s.create(Tag, tag); await s.upsert(Page, { title: 'O nás', slug: 'o-nas', sections: [] }) }
    await run(site, seed)
    await site.backend.update('page', site.tables.get('page')![0]!.id, { title: 'Changed' }) // by the seed's account
    const declared = await scan(site, seed)
    expect(declared.entries.map((x) => x.label)).toEqual(['tag training', 'page o-nas'])
    expect(declared.foreign).toEqual([])
  })

  it('owns nothing when it cannot tell who it is, or when another account made the entries', async () => {
    const site = fakeSite()
    const seed = async (s: any) => { await s.create(Tag, tag) }
    await run(site, seed)
    site.as('another-admin')
    expect((await scan(site, seed)).entries).toEqual([])
    site.backend.account = async () => null
    expect((await scan(site, seed)).foreign).toHaveLength(1)
  })

  it('lists every entry and file by name before anything is asked', async () => {
    const site = fakeSite()
    site.as('editor')
    await run(site, async (s) => { await s.create(Tag, { name: 'Theirs', slug: 'theirs' }) })
    site.as('seed-user')
    const seed = async (s: any) => {
      await s.upload('seed/a.jpg')
      await s.create(Tag, { name: 'Mine', slug: 'mine' })
      await s.create(Tag, { name: 'Theirs', slug: 'theirs' })
    }
    await run(site, seed)
    const lines = describeReset(await planReset(reg, site.backend, await scan(site, seed)), 'http://site').join('\n')
    expect(lines).toContain('− tag mine')
    expect(lines).toContain('− seed/a.jpg')
    expect(lines).toMatch(/· tag theirs \(not made by the account/)
    expect(lines).not.toContain('− tag theirs')
  })
})

describe('--reset never stops half-way', () => {
  const nav = async (s: any, pages: { id: string }[]) => s.global(Navigation, { main: pages.map((p, i) => s.link(`P${i}`, p)), footer: [] }, { translations: { en: { main: pages.map((p, i) => s.link(`E${i}`, p, { locale: 'en' })) } } })
  const seed = async (s: any) => {
    const home = await s.upsert(Page, { title: 'Úvod', slug: 'uvod', sections: [] })
    const about = await s.upsert(Page, { title: 'O nás', slug: 'o-nas', sections: [] })
    await nav(s, [home, about])
  }
  const removes = (site: ReturnType<typeof fakeSite>) => site.writes.filter((w) => w.startsWith('remove'))

  it('empties the seed\'s own menus of links to its pages first, in every language, so no page is refused', async () => {
    const site = fakeSite()
    await run(site, seed)
    // Without a plan the site refuses: the menu still links to the page (what the old reset ran into).
    await expect(site.backend.remove('page', site.tables.get('page')![1]!.id)).rejects.toMatchObject({ status: 409 })
    const plan = await planReset(reg, site.backend, await (async () => (await run(site, seed, false)).declared)())
    expect(plan.blocked).toEqual([])
    expect(plan.clear.map((c) => [c.entity, c.locale])).toEqual([['navigation', null], ['navigation', 'en']])
    expect(plan.clear[0]!.data.main).toEqual([])
    const out = await resetDeclared(site.backend, plan)
    expect(out).toMatchObject({ entries: 2, cleared: 2 })
    expect(site.tables.get('page')).toEqual([])
    // …and the seed writes it all again, menus included.
    await run(site, seed)
    expect(site.globals.get('navigation')!.main).toHaveLength(2)
    expect(site.tables.get('page')).toHaveLength(2)
  })

  it('keeps the menu items that point elsewhere, and the rest of the global', async () => {
    const site = fakeSite()
    const mixed = async (s: any) => {
      const home = await s.upsert(Page, { title: 'Úvod', slug: 'uvod', sections: [] })
      await s.global(Navigation, { main: [s.link('Úvod', home), s.link('Blog', '/blog')], footer: [s.link('Kontakt', '/kontakt')] })
    }
    await run(site, mixed)
    const plan = await planReset(reg, site.backend, (await run(site, mixed, false)).declared)
    await resetDeclared(site.backend, plan)
    expect(site.globals.get('navigation')!.main.map((l: any) => l.url)).toEqual(['/blog'])
    expect(site.globals.get('navigation')!.footer.map((l: any) => l.url)).toEqual(['/kontakt'])
  })

  it('refuses the whole reset, before the first delete, when a page the seed did not make still links to its page', async () => {
    const site = fakeSite()
    await run(site, seed)
    const homeId = site.tables.get('page')![0]!.id
    site.as('editor')
    await site.backend.create('page', { title: 'News', slug: 'news', sections: [{ id: 'b1', type: 'hero', heading: 'x', buttonUrl: `cms:page/${homeId}` }] })
    site.as('seed-user')
    const plan = await planReset(reg, site.backend, (await run(site, seed, false)).declared)
    expect(plan.blocked).toHaveLength(1)
    expect(plan.blocked[0]).toMatch(/page News \(not made by the seed\) links to page uvod/)
    const writes = site.writes.length
    await expect(resetDeclared(site.backend, plan)).rejects.toThrow(/Nothing was removed/)
    expect(site.writes.length).toBe(writes) // not one delete, not one menu emptied
    expect(site.tables.get('page')).toHaveLength(3)
    expect(site.globals.get('navigation')!.main).toHaveLength(2)
  })

  it('also sees a link in a translation of a page the seed did not make, and a child page under one of its pages', async () => {
    const site = fakeSite()
    await run(site, seed)
    const [home, about] = site.tables.get('page')!
    site.as('editor')
    const news = await site.backend.create('page', { title: 'News', slug: 'news', sections: [] })
    await site.backend.update('page', news.id, { sections: [{ id: 'b2', type: 'hero', heading: 'x', buttonUrl: `cms:page/${home!.id}` }] }, 'en')
    await site.backend.create('page', { title: 'Team', slug: 'tym', parent: about!.id, sections: [] })
    site.as('seed-user')
    const plan = await planReset(reg, site.backend, (await run(site, seed, false)).declared)
    expect(plan.blocked.map((b) => b.replace(/\s+/g, ' '))).toEqual(expect.arrayContaining([
      expect.stringMatching(/page News \(not made by the seed\) links to page uvod/),
      expect.stringMatching(/page Team \(not made by the seed\) relates \(parent\) to page o-nas/),
    ]))
  })

  it('orders entries so the one that links to or points at another goes first, whatever order the seed declared them in', async () => {
    const site = fakeSite()
    await run(site, async (s) => {
      const author = await s.create(Author, { name: 'Jana', email: 'j@example.com' }, { by: 'email' })
      await s.create(Post, { title: 'P', slug: 'p', author: author.id, body: s.rich.doc() })
    })
    const authorId = site.tables.get('author')![0]!.id
    // Declared the other way round now: a plain reverse would delete the author while the post points at it.
    const flipped = async (s: any) => {
      await s.create(Post, { title: 'P', slug: 'p', author: authorId, body: s.rich.doc() })
      await s.create(Author, { name: 'Jana', email: 'j@example.com' }, { by: 'email' })
    }
    const plan = await planReset(reg, site.backend, (await run(site, flipped, false)).declared)
    expect(plan.entries.map((x) => x.label)).toEqual(['post p', 'author j@example.com'])
    expect(plan.blocked).toEqual([])
    expect(await resetDeclared(site.backend, plan)).toMatchObject({ entries: 2 })
  })

  it('names pages that link to each other: neither can go first', async () => {
    const site = fakeSite()
    await run(site, async (s) => { await s.create(Page, { title: 'A', slug: 'a', sections: [] }); await s.create(Page, { title: 'B', slug: 'b', sections: [] }) })
    const [a, b] = site.tables.get('page')!
    a!.sections = [{ id: 'x', type: 'hero', heading: 'x', buttonUrl: `cms:page/${b!.id}` }]
    b!.sections = [{ id: 'y', type: 'hero', heading: 'y', buttonUrl: `cms:page/${a!.id}` }]
    const both = async (s: any) => { await s.create(Page, { title: 'A', slug: 'a', sections: [] }); await s.create(Page, { title: 'B', slug: 'b', sections: [] }) }
    const plan = await planReset(reg, site.backend, (await run(site, both, false)).declared)
    expect(plan.blocked[0]).toMatch(/link to or point at each other.*page a, page b|link to or point at each other.*page b, page a/)
    await expect(resetDeclared(site.backend, plan)).rejects.toThrow(/Nothing was removed/)
    expect(removes(site)).toEqual([])
  })

  it('says how far it got when a step is refused after all (somebody saved in between)', async () => {
    const site = fakeSite()
    await run(site, async (s) => { await s.create(Tag, { name: 'A', slug: 'a' }); await s.create(Tag, { name: 'B', slug: 'b' }) })
    const plan = await planReset(reg, site.backend, (await run(site, async (s) => { await s.create(Tag, { name: 'A', slug: 'a' }); await s.create(Tag, { name: 'B', slug: 'b' }) }, false)).declared)
    const real = site.backend.remove
    let n = 0
    site.backend.remove = async (e, id) => { if (++n === 2) throw Object.assign(new Error('409 Still in use'), { status: 409 }); return real(e, id) }
    await expect(resetDeclared(site.backend, plan)).rejects.toThrow(/tag a: could not be removed.*Stopped part-way \(0 menus cleared, 1 entries removed\); run the seed again/)
  })
})

describe('the address of the site', () => {
  it('only the machine itself is local: the name is compared whole', () => {
    for (const h of ['localhost', 'LOCALHOST', 'app.localhost', '127.0.0.1', '[::1]', '::1']) expect(isLocalHostname(h), h).toBe(true)
    for (const h of ['localhost.example.com', '127.0.0.1.example.com', '127.attacker.example', 'notlocalhost', 'example.com', '10.0.0.5', '127.0.0.2', 'localhost.']) expect(isLocalHostname(h), h).toBe(false)
  })
  it('warns about http:// to anywhere else, whatever the name starts with', () => {
    for (const u of ['http://localhost:3000', 'http://127.0.0.1:3000', 'http://[::1]:3000', 'http://demo.localhost:3000', 'https://example.com']) expect(sendsPasswordInTheClear(u), u).toBe(false)
    for (const u of ['http://localhost.example.com', 'http://127.attacker.example', 'http://127.0.0.1.nip.io', 'http://example.com', 'http://localhost@example.com']) expect(sendsPasswordInTheClear(u), u).toBe(true)
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

// Found while moving six sites to 1.0.0: what the fake above stores as given, the server changes.
describe('values the server stores in its own spelling', () => {
  const Course = defineEntity('course', {
    label: 'Courses', titleField: 'title',
    fields: {
      title: f.text({ required: true }), slug: f.slug(),
      price: f.number({ int: false }).optional(),
      age: f.group({ fields: { min: f.number({ int: false }), max: f.number({ int: false }) } }).optional(),
      prices: f.list({ fields: { label: f.text(), amount: f.number({ int: false }) } }),
    },
  })
  const Sister = defineSingleton('sister', {
    label: 'Sister studio', titleField: 'name',
    fields: {
      name: f.text(),
      geo: f.group({ fields: { latitude: f.number({ int: false }), longitude: f.number({ int: false }) } }),
      about: f.group({ fields: { heading: f.text(), tagline: f.list({ fields: { text: f.text() } }) } }),
      // a list inside the items of a list: two levels, as inside a block
      rows: f.list({ fields: { label: f.text(), cells: f.list({ fields: { text: f.text() } }) } }),
    },
  })
  const own = buildRegistry({ Course, Sister })
  const runOwn = async (site: ReturnType<typeof fakeSite>, fn: Parameters<typeof defineSeed>[0]) => {
    const ops: SeedOp[] = []
    await runSeed(defineSeed(fn), { reg: own, backend: site.backend, root: '/site', apply: true, readFile, onOp: (o) => ops.push(o) })
    return ops
  }
  /** What Postgres and the server's zod do to a decimal: a column (numeric(12,2)) gives "2.50", one inside JSON is kept as String(n). */
  const column = (n: number) => n.toFixed(2)
  const json = (n: number) => String(n)

  it('compares a decimal by its value, in a column, a group and a list (a second run saves nothing)', async () => {
    const site = fakeSite()
    const seed = async (s: any) => {
      await s.upsert(Course, { title: 'Hip hop', slug: 'hip-hop', price: 2.5, age: { min: 6, max: 10.5 }, prices: [{ label: 'Month', amount: 450 }] })
      await s.global(Sister, { name: 'Six', geo: { latitude: 49.13504, longitude: 14.6 }, about: { heading: 'Hi', tagline: [] } })
    }
    await runOwn(site, seed)
    // As the server gives it back.
    const row = site.tables.get('course')![0]!
    row.price = column(2.5)
    row.age = { min: json(6), max: json(10.5) }
    row.prices = row.prices.map((p: Row) => ({ ...p, amount: json(p.amount) }))
    const g = site.globals.get('sister')!
    g.geo = { latitude: json(49.13504), longitude: json(14.6) }
    site.writes.length = 0
    const ops = await runOwn(site, seed)
    expect(ops.filter((o) => o.action === 'updated')).toEqual([])
    expect(site.writes).toEqual([])
  })

  it('still sees a changed decimal, and a numeric string in the seed is the same number', async () => {
    const site = fakeSite()
    await runOwn(site, async (s) => { await s.upsert(Course, { title: 'A', slug: 'a', price: 2.5, prices: [] }) })
    site.tables.get('course')![0]!.price = column(2.5)
    site.writes.length = 0
    expect(count(await runOwn(site, async (s) => { await s.upsert(Course, { title: 'A', slug: 'a', price: '2.5', prices: [] }) }), 'updated')).toBe(0)
    const ops = await runOwn(site, async (s) => { await s.upsert(Course, { title: 'A', slug: 'a', price: 2.55, prices: [] }) })
    expect(ops.find((o) => o.action === 'updated')?.fields).toEqual(['price'])
    // Text is text: "2.50" and "2.5" in a text field differ.
    expect(covers('2.50', '2.5')).toBe(false)
  })

  it('gives the items of a list inside a group ids, as the admin does, and the same ones on every run', async () => {
    const site = fakeSite()
    const seed = async (s: any) => {
      await s.global(Sister, { name: 'Six', geo: { latitude: 1, longitude: 2 }, about: { heading: 'Hi', tagline: [{ text: 'Dance' }, { text: 'Move' }] } })
    }
    await runOwn(site, seed)
    const items = site.globals.get('sister')!.about.tagline
    expect(items.map((i: Row) => typeof i.id)).toEqual(['string', 'string'])
    expect(items.map((i: Row) => i.type)).toEqual(['item', 'item'])
    expect(new Set(items.map((i: Row) => i.id)).size).toBe(2)
    site.writes.length = 0
    await runOwn(site, seed)
    expect(site.writes).toEqual([])
  })

  it('gives the items of a list inside a list item ids, the same ones on every run', async () => {
    const site = fakeSite()
    const seed = async (s: any) => {
      await s.global(Sister, { name: 'Six', rows: [{ label: 'A', cells: [{ text: 'a1' }, { text: 'a2' }] }, { label: 'B', cells: [{ text: 'b1' }] }] })
    }
    await runOwn(site, seed)
    const rows = site.globals.get('sister')!.rows
    const cells = rows.flatMap((r: Row) => r.cells)
    expect(cells.map((c: Row) => [typeof c.id, c.type])).toEqual([['string', 'item'], ['string', 'item'], ['string', 'item']])
    expect(new Set(cells.map((c: Row) => c.id)).size).toBe(3)
    site.writes.length = 0
    await runOwn(site, seed)
    expect(site.writes).toEqual([])
  })

  it('refuses a library folder the server would store under another name, instead of uploading the files again on every run', async () => {
    const site = fakeSite()
    await expect(runOwn(site, async (s) => { await s.upload('seed/a.jpg', { folder: 'Lektoři/fotky' }) }))
      .rejects.toThrow(/seed\/a\.jpg: the folder "Lektoři\/fotky" .*"\/".*one level/)
    for (const folder of [' Fotky', 'Fotky  2024', 'a\\b', 'x'.repeat(81)]) {
      await expect(runOwn(site, async (s) => { await s.upload('seed/a.jpg', { folder }) }), folder).rejects.toThrow(/the folder/)
    }
    expect(site.writes).toEqual([])
    await runOwn(site, async (s) => { await s.upload('seed/a.jpg', { folder: 'Lektoři – fotky' }) })
    // An empty folder is no folder, as the site files it.
    await runOwn(site, async (s) => { await s.upload('seed/b.jpg', { folder: '' }) })
    await runOwn(site, async (s) => { await s.upload('seed/b.jpg', { folder: '' }) })
    expect(site.media.map((m) => m.folder)).toEqual(['Lektoři – fotky', null])
  })
})
