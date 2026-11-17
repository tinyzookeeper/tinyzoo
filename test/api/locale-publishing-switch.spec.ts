import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest'
import { anonymous, Client, doc, signIn, testDb, truncateAll } from '../helpers/api'
import { createAuthor, createPost, createTag } from '../helpers/fixtures'
import { startServer, type SpawnedServer } from '../helpers/server'
import { playgroundDir, repoRoot } from '../setup/database'

/**
 * Turning publish.perLocale on keeps the website exactly as it was.
 *
 * The playground's posts publish per language. The same playground is built a second time with the
 * option off (CMS_TEST_NO_PER_LOCALE=1: the config of a site before it switched it on), and started
 * on the SAME database — which already has the two state columns, and holds entries in every shape a
 * site has: live with and without a translation, a draft, one scheduled, translations with and without
 * their own address. What the content API answers on both servers is compared, byte for byte as JSON:
 * lists in both languages (with filters, search and every sort), every item by each of its addresses,
 * the sitemap with its hreflang alternates, and the search.
 */
const db = testDb()
const buildDir = join(repoRoot, 'node_modules/.cache/cms-test-no-per-locale')
const offEntry = join(buildDir, 'output/server/index.mjs')
let admin: Client
let off: SpawnedServer
let offClient: Client

const inSeconds = (s: number) => new Date(Date.now() + s * 1000).toISOString()

beforeAll(async () => {
  admin = await signIn('admin')
  await truncateAll(db)
  // The playground as a site that has not switched it on has it.
  const built = spawnSync(process.execPath, [join(repoRoot, 'test/setup/build-playground.mjs'), playgroundDir, join(buildDir, 'nuxt'), join(buildDir, 'output')], {
    cwd: playgroundDir, stdio: ['ignore', 'pipe', 'pipe'], encoding: 'utf8',
    env: { ...process.env, NODE_ENV: 'production', CMS_TEST_NO_PER_LOCALE: '1', CMS_SCHEDULER_CRON: '* * * * * *' },
  })
  if (built.status !== 0 || !existsSync(offEntry)) throw new Error(`The build without perLocale failed:\n${built.stdout}\n${built.stderr}`)
  off = await startServer(inject('databaseUrl'), { NUXT_CMS_MIGRATIONS_ON_START: 'false', CMS_TEST_NO_PER_LOCALE: '1' }, offEntry)
  offClient = new Client(off.baseURL)
}, 400_000)
afterAll(async () => {
  await off?.stop()
  await db.end()
})

/** The shapes of entry a site has, in the default language and with translations. */
async function seed() {
  const byline = await createAuthor(admin)
  const tag = await createTag(admin, { name: 'Pečení', slug: 'peceni' })
  const text = (t: string) => ({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: t }] }] })
  const translate = (id: string, body: Record<string, unknown>) => admin.request('PATCH', `/api/cms/post/${id}?locale=en`, { json: body })
  const mk = (over: Record<string, unknown>) => createPost(admin, { author: byline.id, tags: [tag.id], ...over })

  // live, no translation at all: served in English through the default language
  await mk({ title: 'Jen česky', slug: 'jen-cesky', status: 'published', body: text('Jen česky'), publishedAt: inSeconds(-3600) })
  // live, translated with its own address
  const both = await mk({ title: 'Vánoční cukroví', slug: 'vanocni-cukrovi', status: 'published', body: text('Cukroví'), publishedAt: inSeconds(-7200) })
  await translate(both.id, { title: 'Christmas cookies', slug: 'christmas-cookies', body: text('Cookies') })
  // live, translated, but only the title (the address and text fall back)
  const partly = await mk({ title: 'Kváskový chleba', slug: 'kvaskovy-chleb', status: 'published', body: text('Chleba') })
  await translate(partly.id, { title: 'Sourdough bread' })
  // a draft with a translation
  const draft = await mk({ title: 'Koncept', slug: 'koncept', status: 'draft', body: text('Koncept') })
  await translate(draft.id, { title: 'Draft', slug: 'draft' })
  // scheduled for tomorrow, with a translation
  const later = await mk({ title: 'Brzy', slug: 'brzy', status: 'published', publishedAt: inSeconds(86_400), body: text('Brzy') })
  await translate(later.id, { title: 'Soon', slug: 'soon' })
  // a draft nobody translated
  await mk({ title: 'Rozepsaný', slug: 'rozepsany', status: 'draft' })
  // a translation whose address collides with nothing, on an entry that is published without a date
  const plain = await mk({ title: 'Bez data', slug: 'bez-data', status: 'published', body: text('Bez data') })
  await translate(plain.id, { title: 'No date', slug: 'no-date' })
  return { both, partly, draft, later, plain }
}

/** The sitemap is a set: its entries come in whatever order the database returns the rows. */
const normalized = (body: any) => (Array.isArray(body?.entries) ? { ...body, entries: [...body.entries].sort((a: any, b: any) => a.loc.localeCompare(b.loc)) } : body)

/** Everything the website reads, as `path → [status, body]`. */
async function snapshot(client: Client): Promise<Record<string, [number, unknown]>> {
  const out: Record<string, [number, unknown]> = {}
  const get = async (path: string) => {
    const res = await client.get(path)
    // An error says its status and why (the rest of it names this request and carries no content).
    out[path] = [res.status, res.status === 200 ? normalized(res.body) : res.body?.statusMessage]
  }
  const slugs: Record<string, string[]> = {
    cs: ['jen-cesky', 'vanocni-cukrovi', 'kvaskovy-chleb', 'koncept', 'brzy', 'rozepsany', 'bez-data', 'christmas-cookies', 'draft', 'neexistuje'],
    en: ['jen-cesky', 'vanocni-cukrovi', 'kvaskovy-chleb', 'koncept', 'brzy', 'rozepsany', 'bez-data', 'christmas-cookies', 'draft', 'soon', 'no-date', 'neexistuje'],
  }
  for (const locale of ['cs', 'en']) {
    for (const slug of slugs[locale]!) await get(`/api/content/post/${slug}?locale=${locale}`)
    await get(`/api/content/post?locale=${locale}`)
    await get(`/api/content/post?locale=${locale}&sort=title&dir=asc`)
    await get(`/api/content/post?locale=${locale}&sort=publishedAt&dir=desc&limit=2&page=2`)
    await get(`/api/content/post?locale=${locale}&q=ch`)
    await get(`/api/content/post?locale=${locale}&slug=christmas-cookies`)
    await get(`/api/content/tag?locale=${locale}`)
    for (const q of ['cukrov', 'cookies', 'chleb', 'bread', 'koncept', 'soon']) await get(`/api/content/_search?q=${q}&locale=${locale}`)
  }
  await get('/api/content/post')
  await get('/api/content/_sitemap')
  return out
}

describe('switching publish.perLocale on', () => {
  it('leaves every list, item, sitemap entry, hreflang alternate and search result as it was', async () => {
    await seed()
    const without = await snapshot(offClient)
    const withIt = await snapshot(anonymous())
    // The snapshot is worth something: items in both languages, drafts and scheduled entries out, the fallback in.
    const en = withIt['/api/content/post?locale=en']![1] as { items: { slug: string; locales: string[] }[] }
    expect(en.items.map((i) => i.slug).sort()).toEqual(['christmas-cookies', 'jen-cesky', 'kvaskovy-chleb', 'no-date'])
    expect(withIt['/api/content/post/jen-cesky?locale=en']![0]).toBe(200)
    expect(withIt['/api/content/post/koncept?locale=en']![0]).toBe(404)
    expect(withIt['/api/content/post/brzy?locale=en']![0]).toBe(404)
    const entries = (withIt['/api/content/_sitemap']![1] as { entries: { loc: string; alternates: unknown[] }[] }).entries
    expect(entries.map((e) => e.loc).filter((l) => l.includes('/blog/')).sort()).toEqual([
      '/blog/bez-data', '/blog/jen-cesky', '/blog/kvaskovy-chleb', '/blog/vanocni-cukrovi', '/en/blog/christmas-cookies', '/en/blog/kvaskovy-chleb', '/en/blog/no-date',
    ])
    expect(entries.find((e) => e.loc === '/blog/vanocni-cukrovi')!.alternates).toHaveLength(2)

    expect(Object.keys(withIt).sort()).toEqual(Object.keys(without).sort())
    for (const [path, answer] of Object.entries(without)) expect(withIt[path], path).toEqual(answer)
  }, 120_000)

  it('does the same after the first language is published on its own: only that language differs', async () => {
    const before = await snapshot(anonymous())
    const [en] = (await db.query(`select id from post where slug = 'jen-cesky'`)).rows
    await admin.request('PATCH', `/api/cms/post/${en.id}?locale=en`, { json: { status: 'draft' } })
    const after = await snapshot(anonymous())
    const changed = Object.keys(after).filter((p) => JSON.stringify(after[p]) !== JSON.stringify(before[p]))
    // Only what English says changed: that entry's English address and the English lists that held it. Czech and the sitemap did not.
    expect(changed.length).toBeGreaterThan(0)
    expect(changed.filter((p) => !p.includes('locale=en'))).toEqual([])
    expect(after['/api/content/post/jen-cesky?locale=en']![0]).toBe(404)
    expect(after['/api/content/post/jen-cesky?locale=cs']).toEqual(before['/api/content/post/jen-cesky?locale=cs'])
    // (The build without the option does not know the state: it still serves the entry in English. That is what makes the first test a comparison.)
    expect((await offClient.get('/api/content/post/jen-cesky?locale=en')).status).toBe(200)
  }, 120_000)

  it('keeps a language published on its own off the website while the default language is a draft (the default language gates)', async () => {
    const before = await snapshot(anonymous())
    const drafts = (await db.query(`select id from post where slug in ('koncept', 'brzy')`)).rows
    expect(drafts).toHaveLength(2) // a draft, and one scheduled for tomorrow
    for (const { id } of drafts) expect((await admin.request('PATCH', `/api/cms/post/${id}?locale=en`, { json: { status: 'published' } })).status).toBe(200)
    // Nothing a visitor can read changed: not the English items, lists, the sitemap and its alternates, nor the search.
    expect(await snapshot(anonymous())).toEqual(before)
    expect((await anonymous().get('/api/content/post/draft?locale=en')).status).toBe(404)
    expect((await anonymous().get('/api/content/post/soon?locale=en')).status).toBe(404)
  }, 120_000)
})
