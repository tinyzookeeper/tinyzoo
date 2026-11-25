import { execFileSync, spawnSync } from 'node:child_process'
import { randomBytes, randomUUID } from 'node:crypto'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import pg from 'pg'
import { sql } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/node-postgres'
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import { buildRegistry, defineEntity, f, propOf, type CmsEntity, type CmsRegistry } from 'tinyzoo'
import * as playground from '../../playground/cms.config'
import { exportContent } from '../../packages/cms/cli/export'
import { ImportRefused, importContent, type ImportMode } from '../../packages/cms/cli/import'
import { extractTarGz, safeArchivePath, writeTarGz } from '../../packages/cms/cli/tar'
import {
  ARCHIVE_FILES, canonicalJson, connectDb, dependencyOrder, describeSchema, diffSchemas, fingerprintOf, localStorageAt, parseArgs, readJsonl, storageFromSettings,
  type Manifest, type TransferStorage,
} from '../../packages/cms/cli/transfer'
import { playgroundDir, repoRoot, testDatabaseUrl } from '../setup/database'
import { startFakeS3 } from '../helpers/fakeS3'

vi.setConfig({ testTimeout: 60_000, hookTimeout: 120_000 })

// Export and import against two real databases. Both are made from the playground's
// migrations, plus one table for a content type that points at itself (a category tree).

const Category = defineEntity('category', {
  label: 'Categories',
  titleField: 'name',
  fields: {
    name: f.text({ required: true }),
    parent: f.relation({ to: () => Category, kind: 'many-to-one', onDelete: 'set null' }),
  },
})
const reg: CmsRegistry = buildRegistry({ ...playground, Category })
const entity = (name: string) => reg.byName.get(name)!

const base = new URL(testDatabaseUrl())
const dbUrl = (suffix: string) => { const u = new URL(base); u.pathname = `${base.pathname}_${suffix}`; return u.toString() }
const urlA = dbUrl('a')
const urlB = dbUrl('b')
const work = mkdtempSync(join(tmpdir(), 'tinyzoo-xfer-'))
const dirs = { a: join(work, 'uploads-a'), b: join(work, 'uploads-b') }
const storageA = localStorageAt(dirs.a)
// The target's public address differs: media urls and embedded pictures must follow it.
const storageB = localStorageAt(dirs.b, '/files-b')

const T0 = new Date('2026-03-01T10:20:30.123Z')
const T1 = new Date('2026-03-02T11:21:31.456Z')
const pools: pg.Pool[] = []

async function recreate(url: string) {
  const name = new URL(url).pathname.slice(1)
  const admin = new URL(url); admin.pathname = '/postgres'
  const c = new pg.Client({ connectionString: admin.toString() })
  await c.connect()
  await c.query(`drop database if exists "${name}" with (force)`)
  await c.query(`create database "${name}"`)
  await c.end()
  const pool = new pg.Pool({ connectionString: url })
  pools.push(pool)
  await migrate(drizzle(pool), { migrationsFolder: join(playgroundDir, 'server/db/migrations') })
  await pool.query(`create table category (
    id uuid primary key default gen_random_uuid(), name text not null,
    parent_id uuid references category(id) on delete set null,
    created_at timestamptz(3) not null default now(), updated_at timestamptz(3) not null default now(),
    created_by uuid, updated_by uuid)`)
}

const dbOf = (url: string) => connectDb(url, reg)
let A: ReturnType<typeof dbOf>
let B: ReturnType<typeof dbOf>

// ── seeding (by field names, like the archive) ──────────────────────────────────

async function put(db: any, e: CmsEntity, values: Record<string, any>, when = { createdAt: T0, updatedAt: T1 }): Promise<string> {
  const row: Record<string, any> = { id: values.id ?? randomUUID(), ...when }
  for (const [k, v] of Object.entries(values)) if (k !== 'id') row[propOf(k, e.fields[k]!)] = v
  await db.insert(e.table).values(row)
  return row.id
}
async function translate(db: any, e: CmsEntity, parentId: string, locale: string, fields: Record<string, any>) {
  await db.insert(e.localesTable).values({ parentId, locale, ...fields, createdAt: T0, updatedAt: T1 })
}
async function link(db: any, owner: string, field: string, id: string, target: string) {
  const j = reg.junctionByOwnerField.get(`${owner}.${field}`)!
  await db.insert(j.table).values({ [j.ownerCol]: id, [j.targetCol]: target })
}
const doc = (text: string, ...more: any[]) => ({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text }] }, ...more] })
const image = (m: { id: string; url: string }) => ({ type: 'image', attrs: { src: m.url, mediaId: m.id, alt: 'pic' } })

const ids: Record<string, any> = {}
const blobs = new Map<string, Buffer>()

async function seed(db: any) {
  const media: { id: string; url: string; key: string }[] = []
  for (const [i, [name, mime, ext]] of [['hero', 'image/jpeg', 'jpg'], ['logo', 'image/png', 'png'], ['g1', 'image/jpeg', 'jpg'], ['g2', 'image/jpeg', 'jpg'], ['rules', 'application/pdf', 'pdf'], ['inline', 'image/jpeg', 'jpg'], ['card', 'image/jpeg', 'jpg'], ['og', 'image/png', 'png']].entries() as any) {
    const id = randomUUID()
    const key = `2026/03/${randomUUID()}.${ext}`
    const body = randomBytes(2_000 + i * 700)
    blobs.set(key, body)
    await storageA.put(key, body, mime)
    await db.insert(reg.cmsMedia).values({
      id, url: storageA.url(key), key, mime, size: body.length, width: mime.startsWith('image') ? 800 + i : null, height: mime.startsWith('image') ? 600 : null,
      alt: `alt ${name}`, altLocales: { en: `English alt ${name}` }, name: `${name}.${ext}`, folder: i % 2 ? 'Web' : null,
      focalX: 40 + i, focalY: 55, uploadedBy: randomUUID(), inLibrary: i % 2 === 0, createdAt: T0,
    })
    media.push({ id, url: storageA.url(key), key })
    ids[`media.${name}`] = id
  }
  const m = (name: string) => media[['hero', 'logo', 'g1', 'g2', 'rules', 'inline', 'card', 'og'].indexOf(name)]!

  const authors = [
    await put(db, entity('author'), { name: 'Ada', position: 1, email: 'ada@example.com', bio: doc('Ada writes.') }),
    await put(db, entity('author'), { name: 'Bo', position: 2, email: 'bo@example.com', bio: null }),
  ]
  const tags = [
    await put(db, entity('tag'), { name: 'News', slug: 'news' }),
    await put(db, entity('tag'), { name: 'Sport', slug: 'sport' }),
    await put(db, entity('tag'), { name: 'Unused', slug: 'unused' }),
  ]
  await translate(db, entity('tag'), tags[0]!, 'en', { name: 'News (en)', slug: null })
  await translate(db, entity('tag'), tags[1]!, 'en', { name: 'Sport (en)' })

  const posts = [
    await put(db, entity('post'), {
      title: 'První', slug: 'prvni', status: 'published', publishedAt: new Date('2026-03-03T08:00:00.000Z'), hero: m('hero').id, author: authors[0],
      body: doc('Text', image(m('inline'))), gallery: [{ mediaId: m('g1').id, caption: 'One' }, { mediaId: m('g2').id, caption: null }],
      metaTitle: 'Meta', metaDescription: 'Desc', ogImage: m('og').id,
    }),
    await put(db, entity('post'), { title: 'Druhý', slug: 'druhy', status: 'draft', author: authors[1], body: doc('Koncept'), gallery: [] }),
    await put(db, entity('post'), { title: 'Třetí', slug: 'treti', status: 'draft', author: authors[0], body: doc(''), gallery: [] }),
  ]
  // The English version publishes on its own (post: publish.perLocale): its state travels with it.
  await translate(db, entity('post'), posts[0]!, 'en', { title: 'First', slug: 'first', body: doc('English text', image(m('inline'))), published: true, publishedAt: new Date('2026-03-04T09:00:00.000Z'), firstLiveAt: new Date('2026-03-04T09:00:00.000Z') })
  await link(db, 'post', 'tags', posts[0]!, tags[0]!)
  await link(db, 'post', 'tags', posts[0]!, tags[1]!)
  await link(db, 'post', 'tags', posts[1]!, tags[1]!)

  const pageId = await put(db, entity('page'), {
    title: 'O nás', slug: 'o-nas', status: 'published', metaTitle: null,
    sections: [
      { id: 'b1', type: 'hero', heading: 'Vítejte', lead: 'Lead', image: m('hero').id, buttonLabel: 'Go', buttonUrl: '/kontakt' },
      { id: 'b2', type: 'text', heading: 'Text', body: doc('In a block', image(m('inline'))) },
      { id: 'b3', type: 'cards', heading: 'Cards', items: [{ id: 'i1', type: 'item', title: 'Card', text: 'x', image: m('card').id }] },
    ],
  })
  await translate(db, entity('page'), pageId, 'en', {
    title: 'About', slug: 'about', sections: [{ id: 'b1', type: 'cta', v: 2, text: 'Hi', buttonLabel: null, buttonUrl: null, highlighted: true }],
  })
  await put(db, entity('page'), { title: 'Kontakt', slug: 'kontakt', status: 'draft', sections: [] })

  await put(db, entity('siteSettings'), {
    siteName: 'Test site', tagline: 'Tag', logo: m('logo').id, brandColor: '#1f6feb', rules: m('rules').id, ogImage: m('og').id,
    openingHours: [{ id: 'h1', type: 'item', days: 'Mon–Fri', hours: '9–17' }],
  })
  const nav = await put(db, entity('navigation'), { main: [{ id: 'n1', type: 'link', label: 'Home', url: '/', newTab: false, sub: false }], footer: [] })
  await translate(db, entity('navigation'), nav, 'en', { main: [{ id: 'n1', type: 'link', label: 'Home (en)', url: '/en', newTab: true, sub: false }] })
  await put(db, entity('formSettings'), { notifyTo: [{ id: 'f1', type: 'item', email: 'office@example.com' }] })
  await put(db, entity('redirect'), { from: '/old', to: '/new', permanent: true })
  await put(db, entity('redirect'), { from: '/older', to: 'https://example.com/x', permanent: false })
  await put(db, entity('contactForm'), { name: 'Visitor', email: 'visitor@example.com', topic: 'question', message: 'Hello', consent: true, status: 'new' })

  // A tree whose parents sort AFTER their children by id: rows cannot be inserted in file order.
  const root = 'ffffffff-0000-4000-8000-000000000001'
  const mid = '00000000-0000-4000-8000-000000000002'
  const leaf = '00000000-0000-4000-8000-000000000001'
  await put(db, entity('category'), { id: root, name: 'Root', parent: null })
  await put(db, entity('category'), { id: mid, name: 'Mid', parent: root })
  await put(db, entity('category'), { id: leaf, name: 'Leaf', parent: mid })

  // Saved versions and accounts: only the first is ever exported (on request).
  await db.insert(reg.cmsRevisions).values({ entity: 'post', recordId: posts[0]!, locale: null, action: 'entry.updated', version: T1, data: { title: 'První' }, changed: ['title'], userId: randomUUID(), createdAt: T1 })
  await db.insert(reg.cmsUsers).values({ email: 'admin@example.com', name: 'Admin', role: 'admin', status: 'active' })
  await db.insert(reg.cmsAudit).values({ action: 'entry.create', entity: 'post', recordId: posts[0]! })
  Object.assign(ids, { authors, tags, posts, page: pageId })
}

// ── reading everything back ─────────────────────────────────────────────────────

const strip = (row: Record<string, any>) => Object.fromEntries(Object.entries(row).filter(([k]) => !['createdBy', 'updatedBy', 'uploadedBy', 'userId'].includes(k)))

/** Every content table, as plain data. `skip`: entities not expected in the copy. */
async function snapshot(db: any, skip: string[] = []) {
  const out: Record<string, any[]> = {}
  for (const e of reg.entities) {
    if (skip.includes(e.name)) continue
    out[e.name] = (await db.select().from(e.table).orderBy(e.table.id)).map(strip)
    if (e.localesTable) out[`${e.name}_locales`] = (await db.select().from(e.localesTable).orderBy(e.localesTable.id)).map(strip)
  }
  for (const j of reg.junctions) {
    if (skip.includes(j.ownerEntity) || skip.includes(j.targetEntity)) continue
    out[`junction:${j.name}:${j.fieldKey}`] = (await db.select().from(j.table)).map((r: any) => `${r[j.ownerCol]}>${r[j.targetCol]}`).sort()
  }
  out.media = (await db.select().from(reg.cmsMedia).orderBy(reg.cmsMedia.id)).map(strip)
  return JSON.parse(JSON.stringify(out))
}

/** What the copy should look like when the target serves media from /files-b. */
const asServedByB = (snap: any) => JSON.parse(JSON.stringify(snap).replaceAll('/api/cms/_media/raw/', '/files-b/'))

async function blobsMatch(source: TransferStorage, target: TransferStorage, keys = [...blobs.keys()]) {
  for (const key of keys) {
    const got = await target.get(key)
    expect(got?.equals((await source.get(key))!), `blob ${key}`).toBe(true)
  }
}

async function wipe(db: any) {
  await db.execute(sql`truncate ${reg.cmsMedia}, ${reg.cmsRevisions}, ${reg.cmsSearch} cascade`)
  for (const e of reg.entities) await db.execute(sql`truncate ${e.table} cascade`)
}

const archive = (name: string) => join(work, name)
const exportAll = (name: string, over: Record<string, unknown> = {}) =>
  exportContent({ reg, databaseUrl: urlA, storage: storageA, file: archive(name), ...over })
const importInto = (file: string, over: Record<string, unknown> = {}) =>
  importContent({ reg, databaseUrl: urlB, storage: storageB, file, ...over })

async function repack(from: string, to: string, change: (dir: string) => void | Promise<void>) {
  const dir = mkdtempSync(join(work, 'repack-'))
  const names = await extractTarGz(from, dir)
  await change(dir)
  const rest = names.filter((n) => n !== ARCHIVE_FILES.manifest)
  await writeTarGz(to, [ARCHIVE_FILES.manifest, ...rest].map((name) => ({ name, path: join(dir, name) })).filter((x) => existsSync(x.path)))
}

beforeAll(async () => {
  await Promise.all([recreate(urlA), recreate(urlB)])
  A = dbOf(urlA)
  B = dbOf(urlB)
  await seed(A.db)
})
afterAll(async () => {
  await Promise.all([A?.close(), B?.close()])
  await Promise.all(pools.map((p) => p.end()))
  const admin = new URL(urlA); admin.pathname = '/postgres'
  const c = new pg.Client({ connectionString: admin.toString() })
  await c.connect()
  for (const url of [urlA, urlB]) await c.query(`drop database if exists "${new URL(url).pathname.slice(1)}" with (force)`)
  await c.end()
  rmSync(work, { recursive: true, force: true })
})

// ── the archive file ────────────────────────────────────────────────────────────

describe('tar.gz', () => {
  it('writes archives that `tar` reads, and reads them back (long names, empty files, big files)', async () => {
    const dir = mkdtempSync(join(work, 'tar-'))
    const big = randomBytes(300_000)
    writeFileSync(join(dir, 'big.bin'), big)
    writeFileSync(join(dir, 'empty'), '')
    const longName = `media/${'x'.repeat(90)}/${'y'.repeat(90)}/file.txt`
    const file = join(dir, 'a.tar.gz')
    await writeTarGz(file, [
      { name: 'manifest.json', data: Buffer.from('{"a":1}') },
      { name: 'big.bin', path: join(dir, 'big.bin') },
      { name: 'empty', path: join(dir, 'empty') },
      { name: longName, data: Buffer.from('long') },
      { name: 'exactly-a-block', data: Buffer.alloc(512, 7) },
    ])
    const listing = execFileSync('tar', ['-tzf', file], { encoding: 'utf8' }).split('\n').filter(Boolean)
    expect(listing[0]).toBe('manifest.json')
    expect(listing).toContain(longName)

    const out = join(dir, 'out')
    const names = await extractTarGz(file, out)
    expect(names.sort()).toEqual(['big.bin', 'empty', 'exactly-a-block', longName, 'manifest.json'].sort())
    expect(readFileSync(join(out, 'big.bin')).equals(big)).toBe(true)
    expect(readFileSync(join(out, longName), 'utf8')).toBe('long')
    expect(readFileSync(join(out, 'empty'))).toHaveLength(0)
    expect(readFileSync(join(out, 'exactly-a-block')).equals(Buffer.alloc(512, 7))).toBe(true)
  })

  it('reads what `tar` writes', async () => {
    const dir = mkdtempSync(join(work, 'tar-'))
    mkdirSync(join(dir, 'src/sub'), { recursive: true })
    writeFileSync(join(dir, 'src/sub/a.txt'), 'hello')
    writeFileSync(join(dir, 'src/b.txt'), 'world')
    execFileSync('tar', ['-czf', join(dir, 'x.tar.gz'), '-C', join(dir, 'src'), '.'], { env: { ...process.env, COPYFILE_DISABLE: '1' } })
    const names = await extractTarGz(join(dir, 'x.tar.gz'), join(dir, 'out'))
    expect(names.sort()).toEqual(['b.txt', 'sub/a.txt'])
    expect(readFileSync(join(dir, 'out/sub/a.txt'), 'utf8')).toBe('hello')
  })

  it('refuses paths that leave the folder, and a truncated archive', async () => {
    for (const bad of ['../x', '/etc/passwd', 'a/../../x', 'a\\b']) expect(() => safeArchivePath(bad)).toThrow(/unsafe/)
    const dir = mkdtempSync(join(work, 'tar-'))
    const file = join(dir, 'a.tar.gz')
    await writeTarGz(file, [{ name: 'a.bin', data: randomBytes(100_000) }])
    writeFileSync(file, readFileSync(file).subarray(0, 600))
    await expect(extractTarGz(file, join(dir, 'out'))).rejects.toThrow()
  })
})

// ── the content model ───────────────────────────────────────────────────────────

describe('content model', () => {
  it('has a stable fingerprint that changes with names, types and blocks only', () => {
    const shape = describeSchema(reg)
    expect(fingerprintOf(shape)).toBe(fingerprintOf(JSON.parse(JSON.stringify(shape))))
    expect(canonicalJson({ b: 1, a: [{ d: 1, c: 2 }] })).toBe('{"a":[{"c":2,"d":1}],"b":1}')
    const changed = JSON.parse(JSON.stringify(shape))
    delete changed.entities.post.fields.hero
    expect(fingerprintOf(changed)).not.toBe(fingerprintOf(shape))
    const blocks = JSON.parse(JSON.stringify(shape))
    delete blocks.entities.page.fields.sections.blocks.cta
    expect(fingerprintOf(blocks)).not.toBe(fingerprintOf(shape))
    // Labels, help texts and the like are not part of it.
    expect(JSON.stringify(shape)).not.toContain('Hlavní')
  })

  it('lists what is missing on either side', () => {
    const archive = JSON.parse(JSON.stringify(describeSchema(reg)))
    delete archive.entities.tag
    archive.entities.ghost = { singleton: false, fields: { name: { type: 'text' } } }
    delete archive.entities.post.fields.hero
    archive.entities.post.fields.extra = { type: 'text' }
    archive.entities.post.fields.status.values = ['draft', 'archived']
    archive.entities.post.fields.body = { type: 'text' }
    delete archive.entities.page.fields.sections.blocks.cta
    const messages = diffSchemas(archive, describeSchema(reg)).map((d) => d.message).join('\n')
    expect(messages).toContain('"tag" exists here but not in the archive')
    expect(messages).toContain('"ghost" is in the archive but this site has no such content')
    expect(messages).toContain('post.hero exists here but not in the archive')
    expect(messages).toContain('post.extra is in the archive but this site has no such field')
    expect(messages).toContain('post.status has other choices')
    expect(messages).toContain('post.body has changed (text → richtext')
    expect(messages).toContain('block "cta" is new here')
    expect(diffSchemas(describeSchema(reg), describeSchema(reg))).toEqual([])
  })

  it('says that an entity publishes each language on its own only when it does, so other sites keep their fingerprint', () => {
    const shape = describeSchema(reg)
    expect(shape.entities.post!.perLocale).toBe(true)
    // Nothing but the entities with the option carry the key.
    for (const [name, e] of Object.entries(shape.entities)) if (name !== 'post') expect(Object.keys(e).sort(), name).toEqual(['fields', 'singleton'])
    const without = JSON.parse(JSON.stringify(shape))
    delete without.entities.post.perLocale
    expect(fingerprintOf(without)).not.toBe(fingerprintOf(shape))
  })

  it('reports an archive that carries the state of each language to a site that cannot keep it, and takes an archive without it as it is', () => {
    const target = describeSchema(reg)
    const without = JSON.parse(JSON.stringify(target))
    delete without.entities.post.perLocale
    // From 0.6 (with states) into a site without the option: a difference (the translations still import, following the default language).
    const toPlain = diffSchemas(target, without)
    expect(toPlain).toEqual([expect.objectContaining({ scope: 'entity', entity: 'post', skip: false, message: expect.stringContaining('publishes each language on its own in the archive, but not here') })])
    // From a site without it (0.5) into one that has it: nothing to report.
    expect(diffSchemas(without, target)).toEqual([])
  })

  it('orders tables by their links, and leaves back-links to be filled in', () => {
    const { order, deferred } = dependencyOrder(reg, reg.entities.filter((e) => ['post', 'author', 'tag', 'category'].includes(e.name)))
    const names = order.map((e) => e.name)
    expect(names.indexOf('author')).toBeLessThan(names.indexOf('post'))
    expect([...deferred.keys()]).toEqual(['category'])
    expect(deferred.get('category')![0]).toMatchObject({ key: 'parent', prop: 'parentId', required: false })

    // Two entities pointing at each other (optional on one side), and a cycle nobody can fill in.
    const X: CmsEntity = defineEntity('nodeX', { label: 'X', titleField: 'n', fields: { n: f.text(), y: f.relation({ to: () => Y, kind: 'many-to-one', required: true }) } }) as any
    const Y: CmsEntity = defineEntity('nodeY', { label: 'Y', titleField: 'n', fields: { n: f.text(), x: f.relation({ to: () => X, kind: 'many-to-one' }) } }) as any
    const cyc = buildRegistry({ X, Y })
    const res = dependencyOrder(cyc, cyc.entities)
    expect(res.order.map((e) => e.name)).toEqual(['nodeY', 'nodeX'])
    expect(res.deferred.get('nodeY')![0]).toMatchObject({ key: 'x' })
    const R: CmsEntity = defineEntity('reqR', { label: 'R', titleField: 'n', fields: { n: f.text(), s: f.relation({ to: () => S, kind: 'many-to-one', required: true }) } }) as any
    const S: CmsEntity = defineEntity('reqS', { label: 'S', titleField: 'n', fields: { n: f.text(), r: f.relation({ to: () => R, kind: 'many-to-one', required: true }) } }) as any
    const bad = buildRegistry({ R, S })
    expect(() => dependencyOrder(bad, bad.entities)).toThrow(/cycle/)
  })

  it('parses the command line', () => {
    const a = parseArgs(['out.tar.gz', '--only', 'a,b', '--no-media', '--database-url=postgres://x'], ['only', 'database-url'], ['no-media'])
    expect(a).toMatchObject({ positional: ['out.tar.gz'], values: { only: 'a,b', 'database-url': 'postgres://x' } })
    expect(a.flags.has('no-media')).toBe(true)
    expect(() => parseArgs(['--nope'], [], [])).toThrow(/Unknown option/)
    expect(() => parseArgs(['--only'], ['only'], [])).toThrow(/needs a value/)
  })
})

// ── export → import ─────────────────────────────────────────────────────────────

describe('round trip', () => {
  let file: string
  let manifest: Manifest

  it('exports a snapshot with a manifest, entries by field name, globals and media files', async () => {
    file = archive('full.tar.gz')
    const result = await exportAll('full.tar.gz')
    manifest = result.manifest

    expect(manifest).toMatchObject({ format: 1, only: null, locales: { default: 'cs', all: ['cs', 'en'] }, media: { rows: 8, included: true, files: 8, missing: 0 }, revisions: { included: false, rows: 0 } })
    expect(manifest.fingerprint).toBe(fingerprintOf(describeSchema(reg)))
    expect(manifest.excluded.map((x) => x.entity)).toEqual(['contactForm'])
    const counts = Object.fromEntries(manifest.entities.map((x) => [x.name, [x.kind, x.rows, x.translations]]))
    expect(counts).toMatchObject({ post: ['collection', 3, 1], tag: ['collection', 3, 2], author: ['collection', 2, 0], page: ['collection', 2, 1], siteSettings: ['global', 1, 0], navigation: ['global', 1, 1] })

    const dir = mkdtempSync(join(work, 'peek-'))
    const names = await extractTarGz(file, dir)
    expect(names).toContain('content/post.jsonl')
    expect(names).toContain('globals/siteSettings.json')
    expect(names).not.toContain('content/contactForm.jsonl')
    expect(names).not.toContain('revisions.jsonl')
    expect(names.filter((n) => n.startsWith('media/'))).toHaveLength(8)
    // The first archive entry is the manifest (cheap to peek at with `tar`).
    expect(execFileSync('tar', ['-tzf', file], { encoding: 'utf8' }).split('\n')[0]).toBe('manifest.json')

    const posts: any[] = []
    for await (const p of readJsonl(join(dir, 'content/post.jsonl'))) posts.push(p)
    const first = posts.find((p) => p.fields.slug === 'prvni')
    expect(first).toMatchObject({
      id: ids.posts[0], createdAt: T0.toISOString(), updatedAt: T1.toISOString(),
      fields: { title: 'První', status: 'published', publishedAt: '2026-03-03T08:00:00.000Z', hero: ids['media.hero'], author: ids.authors[0] },
      translations: [{ locale: 'en', fields: { title: 'First', slug: 'first' }, publish: { published: true, publishedAt: '2026-03-04T09:00:00.000Z', firstLiveAt: '2026-03-04T09:00:00.000Z' } }],
      relations: { tags: [...ids.tags.slice(0, 2)].sort() },
    })
    // Keyed by field names; nothing about accounts.
    expect(first.fields).not.toHaveProperty('authorId')
    expect(JSON.stringify(first)).not.toContain('createdBy')
    const media = readFileSync(join(dir, 'media.jsonl'), 'utf8')
    expect(media).not.toContain('uploadedBy')
    expect(media).not.toContain('"url"')
  })

  it('imports into an empty database and everything is the same', async () => {
    const report = await importInto(file)
    expect(report.searchIndex).toBe('rebuilt')
    expect(report.media).toEqual({ rows: 8, files: 8, missingFiles: 0 })
    expect(report.entries.post).toEqual({ rows: 3, translations: 1 })
    expect(report.relations).toBe(3)

    // Rows by field values (ids, dates, json), translations, links, media rows.
    const copy = await snapshot(B.db, ['contactForm'])
    expect(copy).toEqual(asServedByB(await snapshot(A.db, ['contactForm'])))
    expect(copy.post).toHaveLength(3)
    expect(copy.post.find((p: any) => p.slug === 'prvni')).toMatchObject({ id: ids.posts[0], createdAt: T0.toISOString(), updatedAt: T1.toISOString() })
    // Media files, byte for byte.
    await blobsMatch(storageA, storageB)
    // Not carried over: form submissions, accounts, history, the audit log.
    expect(await B.db.select().from(entity('contactForm').table)).toHaveLength(0)
    expect(await B.db.select().from(reg.cmsUsers)).toHaveLength(0)
    expect(await B.db.select().from(reg.cmsAudit)).toHaveLength(0)
    expect(await B.db.select().from(reg.cmsRevisions)).toHaveLength(0)
  })

  it('points media urls and embedded pictures at the target storage', async () => {
    const [m]: any[] = await B.db.select().from(reg.cmsMedia).where(sql`${reg.cmsMedia.id} = ${ids['media.hero']}`)
    expect(m.url).toBe(`/files-b/${m.key}`)
    expect(m.uploadedBy).toBeNull()
    const [post]: any[] = await B.db.select().from(entity('post').table).where(sql`${entity('post').table.id} = ${ids.posts[0]}`)
    expect(JSON.stringify(post.body)).toContain('/files-b/')
    expect(JSON.stringify(post.body)).not.toContain('/api/cms/_media/raw/')
    const [pg1]: any[] = await B.db.select().from(entity('page').table).where(sql`${entity('page').table.id} = ${ids.page}`)
    expect(JSON.stringify(pg1.sections)).toContain('/files-b/')
    // The tree whose children come before their parents by id.
    const tree = await B.db.select().from(entity('category').table)
    const byName = Object.fromEntries(tree.map((c: any) => [c.name, c]))
    expect(byName.Leaf.parentId).toBe(byName.Mid.id)
    expect(byName.Mid.parentId).toBe(byName.Root.id)
    expect(byName.Root.parentId).toBeNull()
  })

  it('has the search index of the imported content', async () => {
    const rows = await B.db.select().from(reg.cmsSearch)
    expect(rows.length).toBeGreaterThan(0)
    expect(rows.some((r: any) => r.entity === 'post' && r.title === 'První' && r.locale === 'cs')).toBe(true)
    expect(rows.some((r: any) => r.entity === 'post' && r.title === 'First' && r.locale === 'en')).toBe(true)
  })

  it('refuses a target that is not empty and changes nothing', async () => {
    const before = await snapshot(B.db)
    const err: ImportRefused = await importInto(file).catch((e) => e)
    expect(err).toBeInstanceOf(ImportRefused)
    expect(err.code).toBe('not-empty')
    expect(err.message).toMatch(/post \(3\)/)
    expect(err.message).toMatch(/--replace/)
    expect(await snapshot(B.db)).toEqual(before)
  })

  it('--replace deletes the target\'s content first (after confirming), in one transaction', async () => {
    // The target now has its own content: an extra author, a changed post, an extra tree.
    await put(B.db, entity('author'), { name: 'Intruder', email: 'in@example.com' })
    await B.db.execute(sql`update ${entity('post').table} set title = 'Changed here'`)
    await put(B.db, entity('category'), { name: 'Local' })

    // Declined: nothing happens.
    const before = await snapshot(B.db)
    const declined = await importInto(file, { mode: 'replace' as ImportMode, confirm: async () => false }).catch((e) => e)
    expect(declined).toMatchObject({ code: 'aborted' })
    expect(await snapshot(B.db)).toEqual(before)

    let asked = ''
    const report = await importInto(file, { mode: 'replace' as ImportMode, confirm: async (s: string) => { asked = s; return true } })
    expect(asked).toMatch(/deletes .*author \(3\)/)
    expect(asked).toMatch(/media files stay in storage/)
    expect(report.deleted).toMatchObject({ author: 3, post: 3, media: 8 })
    expect(await snapshot(B.db, ['contactForm'])).toEqual(asServedByB(await snapshot(A.db, ['contactForm'])))
    await blobsMatch(storageA, storageB)
  })

  it('--replace is all or nothing: a failure leaves the target as it was', async () => {
    const broken = archive('broken.tar.gz')
    await repack(file, broken, (dir) => {
      const path = join(dir, 'content/post.jsonl')
      const lines = readFileSync(path, 'utf8').trim().split('\n')
      // A post by an author that is nowhere.
      const entry = JSON.parse(lines[0]!)
      entry.fields.author = randomUUID()
      lines[0] = JSON.stringify(entry)
      writeFileSync(path, lines.join('\n') + '\n')
    })
    await put(B.db, entity('tag'), { name: 'Kept', slug: 'kept' })
    const before = await snapshot(B.db)
    const err = await importInto(broken, { mode: 'replace' as ImportMode }).catch((e) => e)
    expect(err.message).toMatch(/Could not write post.*not there/s)
    expect(await snapshot(B.db)).toEqual(before)
    await B.db.execute(sql`delete from ${entity('tag').table} where slug = 'kept'`)
  })

  it('--merge adds and updates by id and deletes nothing', async () => {
    const extra = await put(B.db, entity('tag'), { name: 'Only here', slug: 'only-here' })
    await B.db.execute(sql`update ${entity('post').table} set title = 'Edited in B' where id = ${ids.posts[1]}`)
    // A link B made that the archive does not have: merging sets the post's tags to the archive's.
    await link(B.db, 'post', 'tags', ids.posts[2], ids.tags[0])
    await B.db.execute(sql`update ${entity('siteSettings').table} set site_name = 'Edited global'`)
    // …and a second row of the global, which has to go.
    await put(B.db, entity('siteSettings'), { siteName: 'Stray' })

    const report = await importInto(file, { mode: 'merge' as ImportMode })
    expect(report.mode).toBe('merge')
    const posts = await B.db.select().from(entity('post').table)
    expect(posts.find((p: any) => p.id === ids.posts[1])?.title).toBe('Druhý')
    const tags = await B.db.select().from(entity('tag').table)
    expect(tags.some((t: any) => t.id === extra)).toBe(true)
    const globals = await B.db.select().from(entity('siteSettings').table)
    expect(globals).toHaveLength(1)
    expect(globals[0]?.siteName).toBe('Test site')
    const j = reg.junctionByOwnerField.get('post.tags')!
    const links = (await B.db.select().from(j.table)).map((r: any) => `${r[j.ownerCol]}>${r[j.targetCol]}`)
    expect(links).not.toContain(`${ids.posts[2]}>${ids.tags[0]}`)
    expect(links).toHaveLength(3)
    await B.db.execute(sql`delete from ${entity('tag').table} where id = ${extra}`)
    // Merging the same archive again changes nothing.
    const again = await snapshot(B.db)
    await importInto(file, { mode: 'merge' as ImportMode })
    expect(await snapshot(B.db)).toEqual(again)
  })
})

// ── what the archive carries ────────────────────────────────────────────────────

describe('options', () => {
  it('--only exports just those entities and the media they use', async () => {
    const { manifest } = await exportAll('only.tar.gz', { only: ['author', 'tag', 'post'] })
    expect(manifest.only).toEqual(['author', 'tag', 'post'])
    expect(manifest.entities.map((x) => x.name).sort()).toEqual(['author', 'post', 'tag'])
    // Used by posts: hero, gallery (2), the picture in the body, the sharing image. Not the logo, rules or card.
    expect(manifest.media).toMatchObject({ rows: 5, files: 5 })

    await wipe(B.db)
    const report = await importInto(archive('only.tar.gz'))
    expect(report.media.rows).toBe(5)
    expect(await B.db.select().from(entity('page').table)).toHaveLength(0)
    expect(await B.db.select().from(entity('post').table)).toHaveLength(3)
    expect((await B.db.select().from(reg.cmsMedia)).map((m: any) => m.id).sort())
      .toEqual(['hero', 'g1', 'g2', 'inline', 'og'].map((n) => ids[`media.${n}`]).sort())
    // An archive of --only content does not trip over differences elsewhere in the model.
    expect(report.differences).toEqual([])
  })

  it('--only names must exist, and an archive missing what its entries point at says so', async () => {
    await expect(exportAll('nope.tar.gz', { only: ['post', 'nonsense'] })).rejects.toThrow(/Unknown content in --only: nonsense/)
    await exportAll('post-only.tar.gz', { only: ['post'] })
    await wipe(B.db)
    const err = await importInto(archive('post-only.tar.gz')).catch((e) => e)
    expect(err.message).toMatch(/Could not write post.*--only/s)
    expect(await B.db.select().from(entity('post').table)).toHaveLength(0)
    // …but it fits a target that already has the authors and tags.
    await importInto(archive('only.tar.gz'))
    await B.db.execute(sql`delete from ${entity('post').table}`)
    expect((await importInto(archive('post-only.tar.gz'), { mode: 'merge' as ImportMode })).entries.post!.rows).toBe(3)
  })

  it('--no-media leaves the files out; the rows still come', async () => {
    const { manifest } = await exportAll('nomedia.tar.gz', { media: false, storage: null })
    expect(manifest.media).toMatchObject({ rows: 8, included: false, files: 0 })
    const names = await extractTarGz(archive('nomedia.tar.gz'), mkdtempSync(join(work, 'nm-')))
    expect(names.some((n) => n.startsWith('media/'))).toBe(false)
    await wipe(B.db)
    const emptyStorage = localStorageAt(join(work, 'uploads-empty'), '/e')
    const report = await importContent({ reg, databaseUrl: urlB, storage: emptyStorage, file: archive('nomedia.tar.gz') })
    expect(report.media).toEqual({ rows: 8, files: 0, missingFiles: 0 })
    const [m]: any[] = await B.db.select().from(reg.cmsMedia)
    expect(m.url).toBe(`/e/${m.key}`)
  })

  it('--with-revisions and --with-submissions bring history and form messages along', async () => {
    const plain = await exportAll('plain.tar.gz')
    expect(plain.manifest.revisions.included).toBe(false)
    const { manifest } = await exportAll('extra.tar.gz', { withRevisions: true, withSubmissions: true })
    expect(manifest.revisions).toEqual({ included: true, rows: 1 })
    expect(manifest.excluded).toEqual([])
    await wipe(B.db)
    const report = await importInto(archive('extra.tar.gz'))
    expect(report.revisions).toBe(1)
    const [rev]: any[] = await B.db.select().from(reg.cmsRevisions)
    expect(rev).toMatchObject({ entity: 'post', recordId: ids.posts[0], action: 'entry.updated', data: { title: 'První' }, userId: null })
    expect(await B.db.select().from(entity('contactForm').table)).toHaveLength(1)
    expect(await snapshot(B.db)).toEqual(asServedByB(await snapshot(A.db)))
  })

  it('names a file that already exists, unless --force', async () => {
    await exportAll('twice.tar.gz')
    await expect(exportAll('twice.tar.gz')).rejects.toThrow(/already exists/)
    await expect(exportAll('twice.tar.gz', { force: true })).resolves.toBeTruthy()
    expect(readdirSync(work).filter((n) => n.endsWith('.partial'))).toEqual([])
  })

  it('--only with a form needs --with-submissions, like a full export does', async () => {
    await expect(exportAll('forms-only.tar.gz', { only: ['contactForm'] })).rejects.toThrow(/contactForm holds form submissions \(personal data\): add --with-submissions/)
    await expect(exportAll('forms-mixed.tar.gz', { only: ['post', 'contactForm'] })).rejects.toThrow(/--with-submissions/)
    expect(existsSync(archive('forms-only.tar.gz'))).toBe(false)
    const { manifest } = await exportAll('forms-only.tar.gz', { only: ['contactForm'], withSubmissions: true })
    expect(manifest.entities).toMatchObject([{ name: 'contactForm', rows: 1 }])
  })

  it('creates the archive readable by its owner only, also over a stale .partial and with --force', async () => {
    const file = archive('mine.tar.gz')
    writeFileSync(`${file}.partial`, 'stale', { mode: 0o644 })
    await exportAll('mine.tar.gz')
    expect(statSync(file).mode & 0o777).toBe(0o600)
    writeFileSync(file, 'wide open', { mode: 0o644 })
    await exportAll('mine.tar.gz', { force: true })
    expect(statSync(file).mode & 0o777).toBe(0o600)
    expect(existsSync(`${file}.partial`)).toBe(false)
  })

  it('a consistent snapshot: edits made while exporting do not leak in', async () => {
    // Read the posts, then change them from another connection before the export reaches media.
    const slowStorage: TransferStorage = {
      ...storageA,
      async get(key) {
        await A.pool.query(`update post set title = 'Changed during the export'`)
        return storageA.get(key)
      },
    }
    await exportAll('snapshot.tar.gz', { storage: slowStorage })
    const dir = mkdtempSync(join(work, 'snap-'))
    await extractTarGz(archive('snapshot.tar.gz'), dir)
    const titles: string[] = []
    for await (const p of readJsonl<any>(join(dir, 'content/post.jsonl'))) titles.push(p.fields.title)
    expect(titles.sort()).toEqual(['Druhý', 'První', 'Třetí'])
    await A.pool.query(`update post set title = case slug when 'prvni' then 'První' when 'druhy' then 'Druhý' else 'Třetí' end`)
  })
})

// ── archives from somewhere else ────────────────────────────────────────────────

describe('checks on import', () => {
  let full: string
  beforeAll(async () => { full = archive('checks.tar.gz'); await exportAll('checks.tar.gz') })

  it('lists the differences of another content model and stops', async () => {
    const other = archive('other-model.tar.gz')
    await repack(full, other, (dir) => {
      const path = join(dir, ARCHIVE_FILES.manifest)
      const m: Manifest = JSON.parse(readFileSync(path, 'utf8'))
      m.schema.entities.ghost = { singleton: false, fields: { name: { type: 'text' } } }
      m.entities.push({ name: 'ghost', kind: 'collection', rows: 0, translations: 0, file: null })
      m.schema.entities.post!.fields.extra = { type: 'text' }
      delete m.schema.entities.post!.fields.hero
      m.fingerprint = fingerprintOf(m.schema)
      writeFileSync(path, JSON.stringify(m))
    })
    await wipe(B.db)
    const err: ImportRefused = await importInto(other).catch((e) => e)
    expect(err.code).toBe('mismatch')
    expect(err.message).toContain('"ghost" is in the archive but this site has no such content')
    expect(err.message).toContain('post.extra is in the archive but this site has no such field')
    expect(err.message).toContain('post.hero exists here but not in the archive')
    expect(err.message).toContain('--allow-mismatch')
    expect(err.differences.length).toBeGreaterThanOrEqual(3)
    expect(await B.db.select().from(entity('post').table)).toHaveLength(0)
  })

  it('--allow-mismatch skips what does not fit and reports it', async () => {
    const other = archive('other-model2.tar.gz')
    await repack(full, other, (dir) => {
      const path = join(dir, ARCHIVE_FILES.manifest)
      const m: Manifest = JSON.parse(readFileSync(path, 'utf8'))
      m.schema.entities.ghost = { singleton: false, fields: { name: { type: 'text' } } }
      m.entities.push({ name: 'ghost', kind: 'collection', rows: 0, translations: 0, file: null })
      m.schema.entities.post!.fields.extra = { type: 'text' }
      writeFileSync(path, JSON.stringify(m))
      const posts = join(dir, 'content/post.jsonl')
      writeFileSync(posts, readFileSync(posts, 'utf8').trim().split('\n').map((l) => { const e = JSON.parse(l); e.fields.extra = 'x'; return JSON.stringify(e) }).join('\n') + '\n')
    })
    await wipe(B.db)
    const report = await importInto(other, { allowMismatch: true })
    expect(report.skipped).toMatchObject({ entities: ['ghost'], fields: ['post.extra'] })
    expect(report.entries.post!.rows).toBe(3)
    expect(report.differences.map((d) => d.entity)).toEqual(expect.arrayContaining(['ghost', 'post']))
    expect(await B.db.select().from(entity('post').table)).toHaveLength(3)
  })

  it('leaves out translations in a language this site does not have', async () => {
    const other = archive('other-lang.tar.gz')
    await repack(full, other, (dir) => {
      const path = join(dir, ARCHIVE_FILES.manifest)
      const m: Manifest = JSON.parse(readFileSync(path, 'utf8'))
      m.locales = { default: 'cs', all: ['cs', 'en', 'de'] }
      writeFileSync(path, JSON.stringify(m))
      const posts = join(dir, 'content/post.jsonl')
      writeFileSync(posts, readFileSync(posts, 'utf8').trim().split('\n').map((l) => {
        const e = JSON.parse(l)
        e.translations = e.translations.map((t: any) => ({ ...t, locale: 'de' }))
        return JSON.stringify(e)
      }).join('\n') + '\n')
    })
    await wipe(B.db)
    const refused = await importInto(other).catch((e) => e)
    expect(refused.message).toContain('language "de" is in the archive but not configured here')
    const report = await importInto(other, { allowMismatch: true })
    expect(report.skipped.translations).toBe(1)
    expect(report.entries.post!.translations).toBe(0)
  })

  it('imports the state of each language, and an archive without it as languages that follow the default one', async () => {
    const state = async () => (await B.db.select().from(entity('post').localesTable)).map((r: any) => [r.locale, r.published, r.publishedAt?.toISOString() ?? null, r.firstLiveAt?.toISOString() ?? null])
    await wipe(B.db)
    await importInto(full)
    expect(await state()).toEqual([['en', true, '2026-03-04T09:00:00.000Z', '2026-03-04T09:00:00.000Z']])
    // A translation being worked on (a draft never on the website) stays one; an archive that does not say when a language was
    // first on the website reads a state of its own as having been there (a draft as taken off: it stays off).
    const withPublish = (name: string, publish: Record<string, unknown>) => {
      const out = archive(name)
      return repack(full, out, (dir) => {
        const posts = join(dir, 'content/post.jsonl')
        writeFileSync(posts, readFileSync(posts, 'utf8').trim().split('\n').map((l) => {
          const e = JSON.parse(l)
          e.translations = e.translations.map((t: any) => ({ ...t, publish }))
          return JSON.stringify(e)
        }).join('\n') + '\n')
      }).then(() => out)
    }
    await wipe(B.db)
    await importInto(await withPublish('being-translated.tar.gz', { published: false, publishedAt: null, firstLiveAt: null }))
    expect(await state()).toEqual([['en', false, null, null]])
    await wipe(B.db)
    await importInto(await withPublish('taken-off-unsaid.tar.gz', { published: false, publishedAt: null }))
    const [[, published, , firstLive]] = await state() as any[]
    expect(published).toBe(false)
    expect(firstLive).not.toBeNull()
    // An archive of a site that did not publish per language has no state in it.
    const plain = archive('no-language-state.tar.gz')
    await repack(full, plain, (dir) => {
      const posts = join(dir, 'content/post.jsonl')
      writeFileSync(posts, readFileSync(posts, 'utf8').trim().split('\n').map((l) => {
        const e = JSON.parse(l)
        e.translations = e.translations.map(({ publish: _p, ...t }: any) => t)
        return JSON.stringify(e)
      }).join('\n') + '\n')
    })
    await wipe(B.db)
    await importInto(plain)
    expect(await state()).toEqual([['en', null, null, null]])
  })

  it('refuses an archive with states of each language into a site that cannot keep them, and with --allow-mismatch imports it and says so', async () => {
    // The playground's `page` does not publish per language: pretend the archive came from a site where it did.
    const states = archive('states-for-page.tar.gz')
    await repack(full, states, (dir) => {
      const path = join(dir, ARCHIVE_FILES.manifest)
      const m: Manifest = JSON.parse(readFileSync(path, 'utf8'))
      m.schema.entities.page!.perLocale = true
      m.fingerprint = fingerprintOf(m.schema)
      writeFileSync(path, JSON.stringify(m))
      const pages = join(dir, ARCHIVE_FILES.content('page'))
      writeFileSync(pages, readFileSync(pages, 'utf8').trim().split('\n').map((l) => {
        const e = JSON.parse(l)
        e.translations = e.translations.map((t: any) => ({ ...t, publish: { published: false, publishedAt: null } }))
        return JSON.stringify(e)
      }).join('\n') + '\n')
    })
    await wipe(B.db)
    const refused: ImportRefused = await importInto(states).catch((e) => e)
    expect(refused.code).toBe('mismatch')
    expect(refused.message).toContain('"page" publishes each language on its own in the archive, but not here')
    expect(await B.db.select().from(entity('page').table)).toHaveLength(0)
    const report = await importInto(states, { allowMismatch: true })
    expect(report.entries.page!.translations).toBeGreaterThan(0)
    expect(report.warnings.join('\n')).toMatch(/translations? of page had a publish state of their own in the archive/)
  })

  it('--merge leaves the state of a language alone when the archive says nothing about it, and takes the archive\'s when it does', async () => {
    const T = entity('post').localesTable
    // An archive with two English translations: one with its state (as exported), one from a site that had none to give.
    const second = randomUUID()
    const mixed = archive('mixed-states.tar.gz')
    await repack(full, mixed, (dir) => {
      const posts = join(dir, 'content/post.jsonl')
      writeFileSync(posts, readFileSync(posts, 'utf8').trim().split('\n').map((l) => {
        const e = JSON.parse(l)
        if (e.id === ids.posts[1]) e.translations = [{ id: second, locale: 'en', createdAt: T0.toISOString(), updatedAt: T1.toISOString(), fields: { title: 'Second', slug: 'second', body: null } }]
        return JSON.stringify(e)
      }).join('\n') + '\n')
    })
    await wipe(B.db)
    await importInto(mixed)
    const state = async () => Object.fromEntries((await B.db.select().from(T)).map((r: any) => [r.parentId, [r.published, r.publishedAt?.toISOString() ?? null]]))
    expect(await state()).toEqual({ [ids.posts[0]]: [true, '2026-03-04T09:00:00.000Z'], [ids.posts[1]]: [null, null] })
    // The people here changed both: one language is a draft now, the other is scheduled.
    await B.db.execute(sql`update ${T} set published = false, published_at = null where parent_id = ${ids.posts[0]}`)
    await B.db.execute(sql`update ${T} set published = true, published_at = '2027-01-01T00:00:00.000Z' where parent_id = ${ids.posts[1]}`)
    await importInto(mixed, { mode: 'merge' as ImportMode })
    // The one the archive carries a state for is the archive's again; the one it carries none for keeps what it has.
    expect(await state()).toEqual({ [ids.posts[0]]: [true, '2026-03-04T09:00:00.000Z'], [ids.posts[1]]: [true, '2027-01-01T00:00:00.000Z'] })
    // And an archive made before per-language publishing (no state anywhere) changes no state at all.
    const old = archive('before-states.tar.gz')
    await repack(full, old, (dir) => {
      const path = join(dir, ARCHIVE_FILES.manifest)
      const m: Manifest = JSON.parse(readFileSync(path, 'utf8'))
      delete m.schema.entities.post!.perLocale
      m.fingerprint = fingerprintOf(m.schema)
      writeFileSync(path, JSON.stringify(m))
      const posts = join(dir, 'content/post.jsonl')
      writeFileSync(posts, readFileSync(posts, 'utf8').trim().split('\n').map((l) => {
        const e = JSON.parse(l)
        e.translations = e.translations.map(({ publish: _p, ...t }: any) => t)
        return JSON.stringify(e)
      }).join('\n') + '\n')
    })
    await B.db.execute(sql`update ${T} set published = false where parent_id = ${ids.posts[0]}`)
    const report = await importInto(old, { mode: 'merge' as ImportMode })
    expect(report.differences).toEqual([])
    expect(await state()).toEqual({ [ids.posts[0]]: [false, '2026-03-04T09:00:00.000Z'], [ids.posts[1]]: [true, '2027-01-01T00:00:00.000Z'] })
  })

  it('brings blocks stored at an older version up to the current one', async () => {
    const old = archive('old-blocks.tar.gz')
    await repack(full, old, (dir) => {
      const pages = join(dir, ARCHIVE_FILES.content('page'))
      writeFileSync(pages, readFileSync(pages, 'utf8').trim().split('\n').map((l) => {
        const e = JSON.parse(l)
        for (const t of e.translations) {
          // The playground's cta block at version 1: no `v`, untidy button fields.
          t.fields.sections = (t.fields.sections ?? []).map((b: any) => (b.type === 'cta' ? { id: b.id, type: 'cta', text: b.text, buttonLabel: ' ', buttonUrl: '  /kontakt  ', highlighted: b.highlighted } : b))
        }
        return JSON.stringify(e)
      }).join('\n') + '\n')
    })
    await wipe(B.db)
    await importInto(old)
    const [tr]: any[] = await B.db.select().from(entity('page').localesTable).where(sql`${entity('page').localesTable.parentId} = ${ids.page}`)
    expect(tr.sections[0]).toMatchObject({ type: 'cta', v: 2, buttonLabel: null, buttonUrl: '/kontakt' })
  })

  it('refuses another default language even with --allow-mismatch', async () => {
    const other = archive('other-default.tar.gz')
    await repack(full, other, (dir) => {
      const path = join(dir, ARCHIVE_FILES.manifest)
      const m: Manifest = JSON.parse(readFileSync(path, 'utf8'))
      m.locales = { default: 'en', all: ['cs', 'en'] }
      writeFileSync(path, JSON.stringify(m))
    })
    const err = await importInto(other, { allowMismatch: true }).catch((e) => e)
    expect(err.message).toMatch(/default language differs/)
  })

  it('refuses a newer archive format, a file that is no archive, and a damaged media file', async () => {
    const newer = archive('newer.tar.gz')
    await repack(full, newer, (dir) => {
      const path = join(dir, ARCHIVE_FILES.manifest)
      writeFileSync(path, JSON.stringify({ ...JSON.parse(readFileSync(path, 'utf8')), format: 99, tinyzoo: '9.0.0' }))
    })
    const e1 = await importInto(newer).catch((e) => e)
    expect(e1).toMatchObject({ code: 'format' })
    expect(e1.message).toMatch(/format 99.*tinyzoo 9\.0\.0.*Upgrade tinyzoo/)

    writeFileSync(archive('junk.tar.gz'), 'not an archive')
    expect(await importInto(archive('junk.tar.gz')).catch((e) => e)).toMatchObject({ code: 'invalid' })
    const empty = archive('no-manifest.tar.gz')
    await writeTarGz(empty, [{ name: 'hello.txt', data: Buffer.from('hi') }])
    expect((await importInto(empty).catch((e) => e)).message).toMatch(/no manifest\.json/)

    const damaged = archive('damaged.tar.gz')
    await repack(full, damaged, (dir) => {
      const key = [...blobs.keys()][0]!
      writeFileSync(join(dir, 'media', key), randomBytes(50))
    })
    await wipe(B.db)
    expect((await importInto(damaged).catch((e) => e)).message).toMatch(/does not match its checksum/)
    expect(await B.db.select().from(reg.cmsMedia)).toHaveLength(0)
  })

  it('never takes a path from the manifest', async () => {
    const evil = archive('evil.tar.gz')
    await repack(full, evil, (dir) => {
      const path = join(dir, ARCHIVE_FILES.manifest)
      const m: Manifest = JSON.parse(readFileSync(path, 'utf8'))
      m.entities.push({ name: '../../evil', kind: 'collection', rows: 1, translations: 0, file: '../../evil.jsonl' })
      writeFileSync(path, JSON.stringify(m))
    })
    expect(await importInto(evil).catch((e) => e)).toMatchObject({ code: 'invalid', message: expect.stringContaining('not a valid name') })
  })

  it('--dry-run checks and reports without writing', async () => {
    await wipe(B.db)
    const report = await importInto(full, { dryRun: true })
    expect(report.dryRun).toBe(true)
    expect(report.entries.post).toEqual({ rows: 3, translations: 1 })
    expect(await B.db.select().from(entity('post').table)).toHaveLength(0)
    expect(await B.db.select().from(reg.cmsMedia)).toHaveLength(0)
  })

  it('--no-search-index leaves the index alone', async () => {
    await wipe(B.db)
    const report = await importInto(full, { searchIndex: false })
    expect(report.searchIndex).toBe('skipped')
    expect(await B.db.select().from(reg.cmsSearch)).toHaveLength(0)
  })
})

// ── --replace with an --only archive ────────────────────────────────────────────

describe('--replace with an --only archive', () => {
  const extraMedia = async (db: any) => {
    const id = randomUUID()
    await db.insert(reg.cmsMedia).values({ id, url: '/files-b/2026/03/extra.png', key: '2026/03/extra.png', mime: 'image/png', size: 5, uploadedBy: null, createdAt: T0 })
    return id
  }

  it('deletes only the media the archive lists and nothing else uses; the rest of the library stays', async () => {
    await exportAll('full-for-replace.tar.gz')
    await exportAll('post-for-replace.tar.gz', { only: ['post'] })
    await wipe(B.db)
    await importInto(archive('full-for-replace.tar.gz'))
    const extra = await extraMedia(B.db) // belongs to nothing in the archive
    const [before]: any[] = await B.db.select().from(entity('siteSettings').table)
    expect(before.logoId).toBe(ids['media.logo'])

    let asked = ''
    const report = await importInto(archive('post-for-replace.tar.gz'), { mode: 'replace' as ImportMode, confirm: async (q: string) => { asked = q; return true } })
    // The question says exactly what goes: the posts, and of the library only what the archive lists and nobody else uses.
    expect(asked).toMatch(/deletes post \(3\)/)
    expect(asked).toMatch(/of the media library only the 2 row\(s\) the archive lists that nothing else uses/)
    expect(asked).toMatch(/3 more it lists are used by other content and are updated in place/)
    expect(asked).toMatch(/rest of the library is not touched; the media files stay in storage/)
    expect(asked).not.toMatch(/whole media library/)
    // Posts used g1 and g2 alone. The hero and the inline picture are also on the page, the sharing image is the site's.
    expect(report.deleted).toEqual({ post: 3, media: 2 })

    // Nothing else was touched: the logo is still the site's logo, the page's pictures still exist, the unrelated file too.
    const [after]: any[] = await B.db.select().from(entity('siteSettings').table)
    expect(after.logoId).toBe(ids['media.logo'])
    expect(after.rulesId).toBe(ids['media.rules'])
    const have = new Set((await B.db.select().from(reg.cmsMedia)).map((m: any) => m.id))
    expect(have.has(extra)).toBe(true)
    expect(have.size).toBe(9)
    const [page]: any[] = await B.db.select().from(entity('page').table).where(sql`${entity('page').table.slug} = 'o-nas'`)
    expect(have.has(page.sections[0].image)).toBe(true)
    expect(have.has(page.sections[2].items[0].image)).toBe(true)

    // And the posts are the archive's again, galleries and pictures included.
    await B.db.execute(sql`delete from ${reg.cmsMedia} where id = ${extra}`)
    expect(await snapshot(B.db, ['contactForm'])).toEqual(asServedByB(await snapshot(A.db, ['contactForm'])))
  })

  it('an --only archive with media is not "a target that is not empty" because of unrelated media', async () => {
    await exportAll('page-only.tar.gz', { only: ['page'] })
    await wipe(B.db)
    const extra = await extraMedia(B.db)
    const report = await importInto(archive('page-only.tar.gz')) // strict
    expect(report.entries.page!.rows).toBe(2)
    expect((await B.db.select().from(reg.cmsMedia)).map((m: any) => m.id)).toContain(extra)
    // …but a listed file already there is "in the way": use --merge or --replace.
    const err = await importInto(archive('page-only.tar.gz')).catch((e) => e)
    expect(err.code).toBe('not-empty')
    expect(err.message).toMatch(/media \(3\)/)
  })

  it('a full archive replaces the whole library, and says so', async () => {
    await wipe(B.db)
    await importInto(archive('full-for-replace.tar.gz'))
    const extra = await extraMedia(B.db)
    let asked = ''
    const report = await importInto(archive('full-for-replace.tar.gz'), { mode: 'replace' as ImportMode, confirm: async (q: string) => { asked = q; return true } })
    expect(asked).toMatch(/and the whole media library \(9 rows; the media files stay in storage\)/)
    expect(report.deleted.media).toBe(9)
    expect((await B.db.select().from(reg.cmsMedia)).map((m: any) => m.id)).not.toContain(extra)
  })

  it('finds a picture by its address when its id was lost (as the server\'s own clean-up does)', async () => {
    await wipe(B.db)
    await importInto(archive('full-for-replace.tar.gz'))
    const keyOnly = await extraMedia(B.db)
    const key = '2026/03/extra.png'
    // A page that embeds the picture with no mediaId, only its src.
    await B.db.execute(sql`update ${entity('page').table} set sections = ${JSON.stringify([{ id: 'x1', type: 'text', heading: 'h', body: { type: 'doc', content: [{ type: 'image', attrs: { src: `/files-b/${key}` } }] } }])}::jsonb where slug = 'kontakt'`)
    // An archive that lists that media row.
    const dir = mkdtempSync(join(work, 'listed-'))
    await extractTarGz(archive('post-for-replace.tar.gz'), dir)
    const mediaFile = join(dir, 'media.jsonl')
    const lines = readFileSync(mediaFile, 'utf8').trim().split('\n').map((l) => JSON.parse(l))
    lines.push({ ...lines[0], id: keyOnly, key, url: undefined, blob: null })
    writeFileSync(mediaFile, lines.map((l) => JSON.stringify(l)).join('\n') + '\n')
    const mf = join(dir, 'manifest.json')
    const m: Manifest = JSON.parse(readFileSync(mf, 'utf8'))
    m.media.rows += 1
    writeFileSync(mf, JSON.stringify(m))
    const names = await extractTarGz(archive('post-for-replace.tar.gz'), mkdtempSync(join(work, 'names-')))
    await writeTarGz(archive('listed.tar.gz'), names.map((name) => ({ name, path: join(dir, name) })))
    const report = await importInto(archive('listed.tar.gz'), { mode: 'replace' as ImportMode })
    expect(report.deleted.media).toBe(2) // g1 and g2 — the one used by address stays
    expect((await B.db.select().from(reg.cmsMedia)).map((x: any) => x.id)).toContain(keyOnly)
  })
})

// ── two environments, one bucket ────────────────────────────────────────────────

describe('files shared between environments', () => {
  it('the archive names the storage by a fingerprint only, and an import into the same storage warns loudly', async () => {
    const { manifest } = await exportAll('shared.tar.gz')
    expect(manifest.media.storage).toMatch(/^[0-9a-f]{32}$/)
    expect(JSON.stringify(manifest)).not.toContain(dirs.a) // no path in the archive
    await wipe(B.db)
    const lines: string[] = []
    const same = await importContent({ reg, databaseUrl: urlB, storage: storageA, file: archive('shared.tar.gz'), log: (l) => lines.push(l) })
    expect(same.warnings).toHaveLength(1)
    expect(same.warnings[0]).toMatch(/SAME storage.*Two environments must not share a bucket or folder.*deleting a file in one deletes it in the other/)
    expect(lines.join('\n')).toMatch(/!! The archive's files come from the SAME storage/)

    await wipe(B.db)
    expect((await importInto(archive('shared.tar.gz'))).warnings).toEqual([]) // another folder
  })

  it('--no-media still records where the files live, so a target on the same bucket is told', async () => {
    const { manifest } = await exportAll('shared-nomedia.tar.gz', { media: false, storage: null, storageIdentity: storageA.identity })
    expect(manifest.media).toMatchObject({ included: false, files: 0 })
    await wipe(B.db)
    expect((await importContent({ reg, databaseUrl: urlB, storage: storageA, file: archive('shared-nomedia.tar.gz') })).warnings).toHaveLength(1)
    await wipe(B.db)
    expect((await importContent({ reg, databaseUrl: urlB, storage: storageB, file: archive('shared-nomedia.tar.gz') })).warnings).toEqual([])
    // An archive that says nothing (an older one, or an export that could not name its storage) never warns.
    await exportAll('unnamed.tar.gz', { media: false, storage: null })
    await wipe(B.db)
    expect((await importContent({ reg, databaseUrl: urlB, storage: storageA, file: archive('unnamed.tar.gz') })).warnings).toEqual([])
  })

  it('"the same storage" means the same folder on this machine, or the same endpoint and bucket', () => {
    expect(localStorageAt(dirs.a).identity).toBe(storageA.identity)
    expect(localStorageAt(dirs.b).identity).not.toBe(storageA.identity)
    expect(storageFromSettings({ driver: 's3', localDir: '', s3: { endpoint: 'https://S3.example.com/', region: 'x', bucket: 'b', accessKeyId: 'k', secretAccessKey: 's' } }).identity)
      .toBe(storageFromSettings({ driver: 'r2', localDir: '', s3: { endpoint: 'https://s3.example.com', region: 'y', bucket: 'b', accessKeyId: 'other', secretAccessKey: 'other' } }).identity)
    expect(storageFromSettings({ driver: 's3', localDir: '', s3: { endpoint: 'https://s3.example.com', region: 'x', bucket: 'b2', accessKeyId: 'k', secretAccessKey: 's' } }).identity)
      .not.toBe(storageFromSettings({ driver: 's3', localDir: '', s3: { endpoint: 'https://s3.example.com', region: 'x', bucket: 'b', accessKeyId: 'k', secretAccessKey: 's' } }).identity)
  })
})

// ── a private bucket as the target or the source ────────────────────────────────

describe('private bucket (S3 with delivery proxy or redirect)', () => {
  const settings = (s3: Awaited<ReturnType<typeof startFakeS3>>, extra: Record<string, string> = {}) => ({
    driver: 's3' as const, localDir: '',
    s3: { endpoint: s3.endpoint, region: s3.region, bucket: s3.bucket, accessKeyId: s3.accessKeyId, secretAccessKey: s3.secretAccessKey, ...extra },
  })

  it('an import writes the files into the bucket (signed) and the app path as every address, in rows and in rich text', async () => {
    const s3 = await startFakeS3()
    try {
      await exportAll('private.tar.gz')
      await wipe(B.db)
      const target = storageFromSettings(settings(s3)) // no public address: proxy
      const report = await importContent({ reg, databaseUrl: urlB, storage: target, file: archive('private.tar.gz') })
      expect(report.media).toEqual({ rows: 8, files: 8, missingFiles: 0 })
      expect(s3.objects.size).toBe(8)
      expect(s3.requests.filter((r) => !r.ok)).toEqual([])
      const rows: any[] = await B.db.select().from(reg.cmsMedia)
      for (const m of rows) expect(m.url).toBe(`/api/cms/_media/raw/${m.key}`)
      const [post]: any[] = await B.db.select().from(entity('post').table).where(sql`${entity('post').table.id} = ${ids.posts[0]}`)
      expect(JSON.stringify(post.body)).toContain('/api/cms/_media/raw/')
      expect(JSON.stringify(post.body)).not.toContain(s3.endpoint)

      // …and an export reads them back through the same signed requests: the archive holds keys, not addresses.
      const out = await exportContent({ reg, databaseUrl: urlB, storage: target, file: archive('private-out.tar.gz') })
      expect(out.manifest.media).toMatchObject({ rows: 8, included: true, files: 8, missing: 0 })
      const dir = mkdtempSync(join(work, 'peek-'))
      const names = await extractTarGz(archive('private-out.tar.gz'), dir)
      expect(names.filter((n) => n.startsWith('media/')).sort()).toEqual([...blobs.keys()].map((k) => `media/${k}`).sort())
      expect(readFileSync(join(dir, 'media.jsonl'), 'utf8')).not.toMatch(/"url"|127\.0\.0\.1|X-Amz/)
    }
    finally { await s3.close() }
  })

  it('under public delivery the same import stores the bucket\'s own address', async () => {
    const s3 = await startFakeS3()
    try {
      await wipe(B.db)
      const target = storageFromSettings(settings(s3, { publicBaseUrl: 'https://cdn.example.com/m', delivery: 'public' }))
      await importContent({ reg, databaseUrl: urlB, storage: target, file: archive('private.tar.gz') })
      const rows: any[] = await B.db.select().from(reg.cmsMedia)
      for (const m of rows) expect(m.url).toBe(`https://cdn.example.com/m/${m.key}`)
    }
    finally { await s3.close() }
  })
})

// ── block versions ──────────────────────────────────────────────────────────────

describe('block versions in the content model', () => {
  it('are in the shape and the fingerprint (left out at version 1)', () => {
    const shape = describeSchema(reg)
    expect(shape.entities.page!.fields.sections!.blockVersions).toEqual({ cta: 2 })
    expect(shape.entities.post!.fields.body!.blockVersions).toBeUndefined()
    const bumped = JSON.parse(JSON.stringify(shape)) as typeof shape
    bumped.entities.page!.fields.sections!.blockVersions!.cta = 3
    expect(fingerprintOf(bumped)).not.toBe(fingerprintOf(shape))
  })

  it('an archive with newer blocks than this site knows is a mismatch (older or unversioned ones are not)', () => {
    const target = describeSchema(reg)
    const copy = () => JSON.parse(JSON.stringify(target)) as typeof target
    const newer = copy()
    newer.entities.page!.fields.sections!.blockVersions!.cta = 3
    const diff = diffSchemas(newer, target)
    expect(diff).toEqual([expect.objectContaining({ scope: 'blocks', entity: 'page', field: 'sections', skip: true, message: expect.stringContaining('"cta" is at version 3 in the archive but this site\'s definition is at 2') })])

    const older = copy()
    older.entities.page!.fields.sections!.blockVersions!.cta = 1
    expect(diffSchemas(older, target)).toEqual([])
    const unversioned = copy()
    delete unversioned.entities.page!.fields.sections!.blockVersions
    expect(diffSchemas(unversioned, target)).toEqual([])
    // …and the other way round (this site is the older one) is the same mismatch.
    expect(diffSchemas(target, newer)).toEqual([])
  })

  it('is checked at every depth (a list inside a block)', () => {
    const target = describeSchema(reg)
    const nested = JSON.parse(JSON.stringify(target)) as typeof target
    const cards = nested.entities.page!.fields.sections!.blocks!.cards!.items!
    expect(cards.blocks).toBeTruthy()
    cards.blockVersions = { item: 4 }
    expect(diffSchemas(nested, target).map((d) => d.message)).toEqual([expect.stringContaining('"item" is at version 4 in the archive but this site\'s definition is at 1')])
  })
})

describe('importing blocks stored at a newer version', () => {
  let full: string
  beforeAll(async () => { full = archive('versions.tar.gz'); await exportAll('versions.tar.gz') })

  it('refuses an archive whose model says its blocks are newer, and --allow-mismatch leaves that field out', async () => {
    const newer = archive('newer-model.tar.gz')
    await repack(full, newer, (dir) => {
      const path = join(dir, ARCHIVE_FILES.manifest)
      const m: Manifest = JSON.parse(readFileSync(path, 'utf8'))
      m.schema.entities.page!.fields.sections!.blockVersions = { cta: 3 }
      m.fingerprint = fingerprintOf(m.schema)
      writeFileSync(path, JSON.stringify(m))
    })
    await wipe(B.db)
    const err: ImportRefused = await importInto(newer).catch((e) => e)
    expect(err.code).toBe('mismatch')
    expect(err.message).toContain('page.sections: "cta" is at version 3 in the archive but this site\'s definition is at 2')
    expect(err.message).toContain('left out with --allow-mismatch')
    expect(await B.db.select().from(entity('page').table)).toHaveLength(0)

    const report = await importInto(newer, { allowMismatch: true })
    expect(report.skipped.fields).toContain('page.sections')
    expect(await B.db.select().from(entity('page').table)).toHaveLength(2)
  })

  it('refuses a block stored newer than the definition even when the model says nothing, and changes nothing', async () => {
    const sneaky = archive('sneaky-blocks.tar.gz')
    await repack(full, sneaky, (dir) => {
      const pages = join(dir, ARCHIVE_FILES.content('page'))
      writeFileSync(pages, readFileSync(pages, 'utf8').trim().split('\n').map((l) => {
        const e = JSON.parse(l)
        for (const t of e.translations) t.fields.sections = (t.fields.sections ?? []).map((b: any) => (b.type === 'cta' ? { ...b, v: 9 } : b))
        return JSON.stringify(e)
      }).join('\n') + '\n')
    })
    await wipe(B.db)
    const err: ImportRefused = await importInto(sneaky).catch((e) => e)
    expect(err).toBeInstanceOf(ImportRefused)
    expect(err.code).toBe('mismatch')
    expect(err.message).toMatch(/the "cta" block b1 at sections\.0 is stored at version 9, this site's definition is at 2.*update this site first/)
    expect(await B.db.select().from(entity('page').table)).toHaveLength(0)
    expect(await B.db.select().from(reg.cmsMedia)).toHaveLength(0)
  })

  it('still brings older blocks up (an archive that predates versions in the model)', async () => {
    const old = archive('unversioned-model.tar.gz')
    await repack(full, old, (dir) => {
      const path = join(dir, ARCHIVE_FILES.manifest)
      const m: Manifest = JSON.parse(readFileSync(path, 'utf8'))
      delete m.schema.entities.page!.fields.sections!.blockVersions
      writeFileSync(path, JSON.stringify(m))
    })
    await wipe(B.db)
    expect((await importInto(old)).differences).toEqual([])
  })
})

// ── page trees ──────────────────────────────────────────────────────────────────

describe('a page tree on import', () => {
  let full: string
  let template: any
  beforeAll(async () => {
    full = archive('tree.tar.gz')
    await exportAll('tree.tar.gz')
    const dir = mkdtempSync(join(work, 'tree-peek-'))
    await extractTarGz(full, dir)
    for await (const p of readJsonl(join(dir, 'content/page.jsonl'))) { template = p; break }
  })

  const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
  const entry = (n: number, slug: string, parent: number | string | null = null, title = slug) => ({
    ...template, id: uuid(n), translations: [], relations: {},
    fields: { ...template.fields, title, slug, parent: parent === null ? null : typeof parent === 'string' ? parent : uuid(parent), position: n, status: 'published', sections: [] },
  })
  /** The full archive with its pages replaced by these. */
  async function withPages(name: string, pages: any[]): Promise<string> {
    const out = archive(name)
    await repack(full, out, (dir) => writeFileSync(join(dir, 'content/page.jsonl'), pages.map((p) => JSON.stringify(p)).join('\n') + '\n'))
    return out
  }
  const pageSlugs = async (db: any) => (await db.select().from(entity('page').table)).map((r: any) => r.slug).sort()

  it('takes a tree whose parents come after their children, with the same part under different parents', async () => {
    // 1 is the parent of 2 and 3 (listed first on purpose: parents are linked afterwards)
    const file = await withPages('tree-ok.tar.gz', [entry(3, 'tym', 1), entry(2, 'tym', 4), entry(1, 'o-nas'), entry(4, 'kontakt')])
    await wipe(B.db)
    const report = await importInto(file)
    expect(report.entries.page).toEqual({ rows: 4, translations: 0 })
    expect(await pageSlugs(B.db)).toEqual(['kontakt', 'o-nas', 'tym', 'tym'])
  })

  it('refuses two pages at one address, naming them, and changes nothing', async () => {
    const file = await withPages('tree-clash.tar.gz', [entry(1, 'o-nas', null, 'O nás'), entry(2, 'o-nas', null, 'O nás 2'), entry(3, 'tym', 1)])
    await wipe(B.db)
    const err: ImportRefused = await importInto(file).catch((e) => e)
    expect(err).toBeInstanceOf(ImportRefused)
    expect(err.code).toBe('invalid')
    expect(err.message).toContain('page tree of page would not be valid')
    expect(err.message).toContain('2 pages share the address /o-nas')
    expect(err.message).toContain('“O nás”')
    expect(err.message).toContain('“O nás 2”')
    // all or nothing: not even the other content of the archive
    expect(await B.db.select().from(entity('page').table)).toHaveLength(0)
    expect(await B.db.select().from(entity('post').table)).toHaveLength(0)
    expect(await B.db.select().from(reg.cmsMedia)).toHaveLength(0)
  })

  it('refuses a page that is its own ancestor', async () => {
    const file = await withPages('tree-loop.tar.gz', [entry(1, 'a', 3, 'Alfa'), entry(2, 'b', 1, 'Beta'), entry(3, 'c', 2, 'Gama'), entry(4, 'd', null, 'Delta')])
    await wipe(B.db)
    const err: ImportRefused = await importInto(file).catch((e) => e)
    expect(err.code).toBe('invalid')
    expect(err.message).toMatch(/A loop: .*Alfa.*Beta.*Gama.*Alfa|A loop: .*Alfa/)
    expect(await B.db.select().from(entity('page').table)).toHaveLength(0)
  })

  it('refuses a tree deeper than this site allows', async () => {
    // the playground's pages go four levels deep
    const file = await withPages('tree-deep.tar.gz', [entry(1, 'a'), entry(2, 'b', 1), entry(3, 'c', 2), entry(4, 'd', 3), entry(5, 'e', 4)])
    await wipe(B.db)
    const err: ImportRefused = await importInto(file).catch((e) => e)
    expect(err.code).toBe('invalid')
    expect(err.message).toMatch(/“e”.*5 levels deep \(at most 4\)/)
    expect(await B.db.select().from(entity('page').table)).toHaveLength(0)
  })

  it('checks --replace too, and leaves the target as it was', async () => {
    await wipe(B.db)
    await importInto(full)
    const before = await snapshot(B.db)
    const file = await withPages('tree-replace.tar.gz', [entry(1, 'same'), entry(2, 'same')])
    const err: ImportRefused = await importInto(file, { mode: 'replace' as ImportMode }).catch((e) => e)
    expect(err.code).toBe('invalid')
    expect(err.message).toContain('share the address /same')
    expect(await snapshot(B.db)).toEqual(before)
  })

  it('checks --merge against the pages already there', async () => {
    await wipe(B.db)
    await importInto(full)
    // the target has /o-nas; the archive brings another page under the same address
    const file = await withPages('tree-merge.tar.gz', [entry(1, 'o-nas', null, 'Druhé o nás')])
    const before = await snapshot(B.db)
    const err: ImportRefused = await importInto(file, { mode: 'merge' as ImportMode }).catch((e) => e)
    expect(err.code).toBe('invalid')
    expect(err.message).toContain('share the address /o-nas')
    expect(err.message).toContain('“Druhé o nás”')
    expect(await snapshot(B.db)).toEqual(before)
    // ... and a page of the archive that fits is merged in
    const fine = await withPages('tree-merge-ok.tar.gz', [entry(1, 'novinky', ids.page, 'Novinky')])
    await importInto(fine, { mode: 'merge' as ImportMode })
    expect(await pageSlugs(B.db)).toEqual(['kontakt', 'novinky', 'o-nas'])
  })

  it('does not let an old problem in the target stop a merge that does not touch it', async () => {
    await wipe(B.db)
    await importInto(full)
    // two pages at one address that were there before (an older import, a hand edit)
    await put(B.db, entity('page'), { title: 'Starý', slug: 'dup', status: 'draft', sections: [] })
    await put(B.db, entity('page'), { title: 'Starší', slug: 'dup', status: 'draft', sections: [] })
    const file = await withPages('tree-merge-old.tar.gz', [entry(1, 'nova')])
    await importInto(file, { mode: 'merge' as ImportMode })
    expect(await pageSlugs(B.db)).toContain('nova')
  })
})

// ── the command line, as a host app runs it ─────────────────────────────────────

describe('tinyzoo export / import (command line)', () => {
  const cli = join(repoRoot, 'packages/cms/cli/index.ts')
  const run = (args: string[], url: string, uploads: string) =>
    spawnSync('pnpm', ['exec', 'tsx', cli, ...args], {
      cwd: playgroundDir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, DATABASE_URL: url, NUXT_CMS_DATABASE_URL: '', NUXT_CMS_STORAGE_DRIVER: 'local', NUXT_CMS_STORAGE_LOCAL_DIR: uploads },
    })

  it('exports from one database and imports into another', async () => {
    await wipe(B.db)
    // The playground's own content model has no categories: this table is not part of the copy.
    const file = archive('cli.tar.gz')
    const out = run(['export', file], urlA, dirs.a)
    expect(out.status, out.stderr + out.stdout).toBe(0)
    expect(out.stdout).toMatch(/post: 3 entries, 1 translations/)
    expect(out.stdout).toMatch(/left out: contactForm/)
    expect(existsSync(file)).toBe(true)

    const again = run(['export', file], urlA, dirs.a)
    expect(again.status).toBe(1)
    expect(again.stderr).toMatch(/✗ .*already exists/)

    const uploadsB = join(work, 'uploads-cli-b')
    const into = run(['import', file], urlB, uploadsB)
    expect(into.status, into.stderr + into.stdout).toBe(0)
    expect(into.stdout).toMatch(/imported .* entries, 8 media/)
    // The server's own index builder ran, outside the server.
    expect(into.stdout).toMatch(/search index: \d+ rows/)
    expect((await B.db.select().from(entity('post').table))).toHaveLength(3)
    await blobsMatch(storageA, localStorageAt(uploadsB))

    const refused = run(['import', file], urlB, uploadsB)
    expect(refused.status).toBe(1)
    expect(refused.stderr).toMatch(/target is not empty/)

    // Replacing asks first; with no terminal to ask in, it stops unless --yes.
    const noTty = run(['import', file, '--replace'], urlB, uploadsB)
    expect(noTty.status).toBe(1)
    expect(noTty.stderr).toMatch(/pass --yes/)
    const yes = run(['import', file, '--replace', '--yes'], urlB, uploadsB)
    expect(yes.status, yes.stderr).toBe(0)

    const bad = run(['import'], urlB, uploadsB)
    expect(bad.status).toBe(1)
    expect(bad.stderr).toMatch(/usage: tinyzoo import/)
  })
})

describe('a site with content types of its own', () => {
  // A site's own types (docs/custom-types-plan.md) are one document in `cms_model`, and a table
  // each. Export and import carry the content model of cms.config.ts only: such a site is refused.
  const course = { name: 'x_course', label: { en: 'Courses' }, fields: [{ key: 'title', type: 'text', label: { en: 'Title' } }] }
  const putModel = async (url: string, docs: unknown[]) => {
    const pool = new pg.Pool({ connectionString: url })
    try {
      await pool.query('create table if not exists cms_model (version integer primary key, doc jsonb not null, ops jsonb not null, user_id uuid, created_at timestamptz(3) not null default now())')
      await pool.query('delete from cms_model')
      for (const [i, doc] of docs.entries()) await pool.query('insert into cms_model (version, doc, ops) values ($1, $2::jsonb, \'[]\'::jsonb)', [i + 1, JSON.stringify(doc)])
    }
    finally { await pool.end() }
  }
  const dropModel = async (url: string) => {
    const pool = new pg.Pool({ connectionString: url })
    try { await pool.query('drop table if exists cms_model') }
    finally { await pool.end() }
  }
  afterAll(async () => { await dropModel(urlA); await dropModel(urlB) })

  it('exports a site without the table, or whose newest document has no type, as before', async () => {
    await dropModel(urlA)
    expect((await exportAll('no-model.tar.gz')).manifest.entities.length).toBeGreaterThan(0)
    // A type that was there once and is gone for good: the newest document is what counts.
    await putModel(urlA, [{ format: 1, types: [course] }, { format: 1, types: [] }])
    expect((await exportAll('empty-model.tar.gz')).manifest.entities.length).toBeGreaterThan(0)
  })

  it('refuses to export a site with a type of its own, hidden ones too, and writes no file', async () => {
    for (const types of [[course], [{ ...course, removedAt: '2026-11-24T10:00:00.000Z' }]]) {
      await putModel(urlA, [{ format: 1, types }])
      const file = archive(`custom-${types[0]!.removedAt ? 'hidden' : 'shown'}.tar.gz`)
      const err: Error = await exportContent({ reg, databaseUrl: urlA, storage: storageA, file }).catch((e) => e)
      expect(err).toBeInstanceOf(Error)
      expect(err.message).toBe('This site has content types of its own (x_course), which tinyzoo export does not carry yet. tinyzoo backup and tinyzoo restore take them: they copy the whole database. Nothing was changed.')
      expect(existsSync(file)).toBe(false)
      expect(existsSync(`${file}.partial`)).toBe(false)
    }
  })

  it('refuses to import into a site with a type of its own and changes nothing; without one it imports', async () => {
    await dropModel(urlA)
    const file = archive('into-custom.tar.gz')
    await exportAll('into-custom.tar.gz')
    await wipe(B.db)
    await putModel(urlB, [{ format: 1, types: [course] }])
    const before = await snapshot(B.db)
    const err: Error = await importInto(file).catch((e) => e)
    expect(err.message).toMatch(/^The site you import into has content types of its own \(x_course\), which tinyzoo import does not carry yet\. tinyzoo backup and tinyzoo restore take them/)
    expect(await snapshot(B.db)).toEqual(before)
    // An empty document is a site without types of its own.
    await putModel(urlB, [{ format: 1, types: [] }])
    expect((await importInto(file)).entries.post).toEqual({ rows: 3, translations: 1 })
  })
})
