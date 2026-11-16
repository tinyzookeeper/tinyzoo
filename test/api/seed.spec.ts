import { spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import pg from 'pg'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import * as playground from '../../playground/cms.config'
import { seedCommand } from '../../packages/cms/cli/seed'
import { Client } from '../helpers/api'
import { scratchDatabase, type SpawnedServer, startServer } from '../helpers/server'
import { playgroundDir, repoRoot } from '../setup/database'

// `tinyzoo seed` against a real server on its own database, started the way a deploy
// starts: production, no setup token, so the first account needs the code the server
// prints. The seed goes through the admin API, so what it writes must look exactly like
// what an editor's save leaves: saved versions, the search index, picture sizes.

const SEED = join(repoRoot, 'test/fixtures/seed/index.ts')
const CODE = /Setup code: ([A-Z0-9]{4}(?:-[A-Z0-9]{4}){3}) — open /
const admin = { email: 'seed@example.com', password: 'correct horse battery' }

let db: Awaited<ReturnType<typeof scratchDatabase>>
let srv: SpawnedServer
let uploads: string
let code: string

async function sql<T = any>(text: string, params: unknown[] = []): Promise<T[]> {
  const c = new pg.Client({ connectionString: db.url })
  await c.connect()
  try { return (await c.query(text, params)).rows }
  finally { await c.end() }
}

/** Run the command in-process; returns what it printed (and how it ended). */
async function seed(args: string[] = [], env: Record<string, string> = {}, file = SEED) {
  const lines: string[] = []
  try {
    await seedCommand(playground, [file, '--url', srv.baseURL, '--email', admin.email, ...args], {
      log: (l) => lines.push(l), cwd: repoRoot, env: { SEED_PASSWORD: admin.password, ...env },
    })
    return { out: lines.join('\n'), error: null as null | Error }
  }
  catch (error) { return { out: lines.join('\n'), error: error as Error } }
}

const counts = async () => Object.fromEntries(await Promise.all(
  ['post', 'tag', 'author', 'page', 'cms_media', 'cms_revisions', 'cms_search'].map(async (t) => [t, (await sql(`select count(*)::int as n from ${t}`))[0].n]),
))
const signedIn = async () => {
  const c = new Client(srv.baseURL)
  expect((await c.post('/api/cms/_auth/login', admin)).status).toBe(200)
  return c
}

/** A fresh server process on the same database (login is limited to 10 tries per address and 15 minutes, per process). */
async function restart() {
  await srv.stop()
  srv = await startServer(db.url, { NUXT_CMS_STORAGE_LOCAL_DIR: uploads })
}

beforeAll(async () => {
  db = await scratchDatabase('seed')
  uploads = mkdtempSync(join(tmpdir(), 'cms-seed-uploads-'))
  srv = await startServer(db.url, { NUXT_CMS_STORAGE_LOCAL_DIR: uploads })
  code = (await srv.waitForLog(CODE))[1]!
})
afterAll(async () => {
  await srv?.stop()
  await db?.drop()
  rmSync(uploads, { recursive: true, force: true })
})

describe('tinyzoo seed', () => {
  it('on a new site asks for the setup code, then creates the first administrator and seeds everything', async () => {
    const refused = await seed()
    expect(refused.error?.message).toMatch(/setup code.*server printed it in its log.*--setup-code/s)
    expect((await sql('select count(*)::int as n from cms_users'))[0].n).toBe(0)

    const wrong = await seed(['--setup-code', 'AAAA-BBBB-CCCC-DDDD'])
    expect(wrong.error?.message).toMatch(/setup code is missing or wrong/)
    // The code as an argument shows in `ps`: the command says so, and points at the environment.
    expect(wrong.out).toMatch(/! --setup-code shows in the process list.*SEED_SETUP_CODE/)
    expect(refused.out).not.toMatch(/--setup-code shows/)

    const first = await seed([], { SEED_SETUP_CODE: code })
    expect(first.error).toBeNull()
    expect(first.out).toContain('created the first administrator seed@example.com')
    expect(first.out).toMatch(/✓ created\s+post prvni-clanek/)
    expect(first.out).toMatch(/Seeded .*: .*created/)
    expect((await sql('select role from cms_users'))[0].role).toBe('admin')

    expect(await counts()).toMatchObject({ post: 1, tag: 2, author: 1, page: 2, cms_media: 2 })
  })

  it('wrote through the admin\'s own paths: validated, translated, indexed, versioned, sized', async () => {
    const visitor = new Client(srv.baseURL)
    // The content API serves what was seeded, in both languages.
    const post = (await visitor.get('/api/content/post/prvni-clanek')).body.item
    expect(post).toMatchObject({ title: 'První článek', status: 'published', author: { name: 'Jana Nováková' } })
    expect(post.tags.map((t: any) => t.slug).sort()).toEqual(['novinky', 'trenink'])
    expect(post.hero).toMatchObject({ width: 64, height: 32, alt: 'Wide picture', focal: { x: 40, y: 60 } })
    expect(post.gallery.map((g: any) => g.caption)).toEqual(['Široký', 'Vysoký'])
    const en = (await visitor.get('/api/content/post/first-post?locale=en')).body.item
    expect(en).toMatchObject({ title: 'First post', locale: 'en' })
    expect((await visitor.get('/api/content/tag?locale=en')).body.items.map((t: any) => t.name).sort()).toEqual(['News', 'Training'])

    // Blocks carry ids, the picture in the hero block resolved, links followed the entry's address.
    const page = (await visitor.get('/api/content/page/uvod')).body.item
    expect(page.sections.map((b: any) => b.type)).toEqual(['hero', 'cards', 'text'])
    expect(page.sections.every((b: any) => b.id)).toBe(true)
    expect(page.sections[0].image).toMatchObject({ width: 64 })
    const nav = (await visitor.get('/api/content/_global/navigation')).body.item
    // …the menu holds references to its pages, which the content API turns into their addresses (a page under a page included).
    expect(nav.main.map((l: any) => l.url)).toEqual(['/uvod', '/uvod/tym', '/blog'])
    expect(nav.footer[0]).toMatchObject({ url: '/kontakt', newTab: true })
    expect((await visitor.get('/api/content/_global/navigation?locale=en')).body.item.main.map((l: any) => l.url)).toEqual(['/en/pages/home', '/en/pages/home/team', '/en/blog'])
    const stored = (await sql('select main from navigation'))[0].main as { url: string }[]
    const ids = Object.fromEntries((await sql('select id, slug from page')).map((r) => [r.slug, r.id]))
    expect(stored.map((l) => l.url)).toEqual([`cms:page/${ids.uvod}`, `cms:page/${ids.tym}`, '/blog'])
    expect((await visitor.get('/api/content/_global/siteSettings')).body.item).toMatchObject({ siteName: 'Seed site', logo: { width: 64 } })

    // A menu that follows its pages: rename one in the admin and the menu shows its new address.
    const renamer = await signedIn()
    expect((await renamer.patch(`/api/cms/page/${ids.uvod}`, { slug: 'novy-uvod' })).status).toBe(200)
    expect((await visitor.get('/api/content/_global/navigation')).body.item.main.map((l: any) => l.url)).toEqual(['/novy-uvod', '/novy-uvod/tym', '/blog'])
    expect((await renamer.patch(`/api/cms/page/${ids.uvod}`, { slug: 'uvod' })).status).toBe(200)
    expect((await visitor.get('/api/content/_global/navigation')).body.item.main.map((l: any) => l.url)).toEqual(['/uvod', '/uvod/tym', '/blog'])

    // The search index and the saved versions exist: the seed did not bypass them.
    const found = (await visitor.get('/api/content/_search?q=zebra')).body
    expect(found.items.map((h: any) => h.path)).toContain('/blog/prvni-clanek')
    const editor = await signedIn()
    const [row] = (await editor.get('/api/cms/post?limit=5')).body.rows
    expect((await editor.get(`/api/cms/post/${row.id}/revisions`)).body.revisions?.length ?? 0).toBeGreaterThan(0)
    expect((await sql(`select count(*)::int as n from cms_audit where action = 'entry.create'`))[0].n).toBeGreaterThan(4)
    // The picture's text in the editor's own field, the file on disk through the storage driver.
    const mediaRows = await sql('select name, width, height, in_library, key from cms_media order by name')
    expect(mediaRows.map((m) => [m.name, m.width, m.height, m.in_library])).toEqual([['tall.png', 32, 64, true], ['wide.png', 64, 32, true]])
  })

  it('a second run changes nothing: no entry, no version, no file, no write at all', async () => {
    const before = await counts()
    const stamps = await sql(`select 'post' as t, id, updated_at from post union all select 'page', id, updated_at from page union all select 'tag', id, updated_at from tag order by 1, 2`)
    const audit = (await sql('select count(*)::int as n from cms_audit'))[0].n
    const media = await sql('select id, key, created_at from cms_media order by id')
    await restart()

    const again = await seed()
    expect(again.error).toBeNull()
    expect(again.out).toMatch(/Seeded .*: \d+ already up to date, 5 left as they are\./)
    expect(again.out).not.toMatch(/kept|unchanged/) // quiet unless --verbose
    expect(again.out).not.toMatch(/✓ (created|updated|uploaded)/)

    expect(await counts()).toEqual(before)
    expect(await sql(`select 'post' as t, id, updated_at from post union all select 'page', id, updated_at from page union all select 'tag', id, updated_at from tag order by 1, 2`)).toEqual(stamps)
    expect(await sql('select id, key, created_at from cms_media order by id')).toEqual(media)
    // Only the sign-in is new in the audit log: nothing was saved.
    const added = await sql(`select action from cms_audit order by created_at desc limit ${(await sql('select count(*)::int as n from cms_audit'))[0].n - audit}`)
    expect(added.map((a) => a.action)).toEqual(['auth.login'])
  })

  it('--dry-run says what would happen and writes nothing', async () => {
    await restart()
    const c = await signedIn()
    const page = (await c.get('/api/cms/page?limit=5')).body.rows.find((r: any) => r.slug === 'uvod')
    expect((await c.patch(`/api/cms/page/${page.id}`, { title: 'Změněno editorem' })).status).toBe(200)
    const before = await counts()
    const audit = (await sql('select count(*)::int as n from cms_audit'))[0].n

    const dry = await seed(['--dry-run'])
    expect(dry.error).toBeNull()
    expect(dry.out).toMatch(/✓ would update\s+page uvod \(title\)/)
    expect(dry.out).toMatch(/Dry run, nothing written: 1 to update/)
    expect(await counts()).toEqual(before)
    // (an update was made by the test itself; the dry run added a sign-in only)
    expect((await sql('select count(*)::int as n from cms_audit'))[0].n).toBe(audit + 1)
    expect((await sql(`select title from page where slug = 'uvod'`))[0].title).toBe('Změněno editorem')
  })

  it('upsert brings an edited entry back, create leaves editors\' changes alone', async () => {
    await restart()
    const c = await signedIn()
    const tag = (await c.get('/api/cms/tag?limit=5')).body.rows.find((t: any) => t.slug === 'trenink')
    expect((await c.patch(`/api/cms/tag/${tag.id}`, { name: 'Přejmenováno' })).status).toBe(200)

    const run = await seed()
    expect(run.error).toBeNull()
    expect(run.out).toMatch(/✓ updated\s+page uvod \(title\)/) // upsert: back to the seed
    expect(run.out).not.toMatch(/updated\s+tag/)
    expect((await sql(`select name from tag where slug = 'trenink'`))[0].name).toBe('Přejmenováno') // create: the editor's name stays
    expect((await sql(`select title from page where slug = 'uvod'`))[0].title).toBe('Úvod')
    // the edited tag was not touched, so a further run is quiet again
    expect((await seed()).out).not.toMatch(/✓ (created|updated)/)
  })

  it('--reset lists what it removes, takes nothing the seed did not make, and stops before the first delete when something would be refused', async () => {
    await restart()
    const c = await signedIn()
    const uvod = (await sql(`select id from page where slug = 'uvod'`))[0].id
    const before = await counts()
    // A page the seed did not make links to one of its pages: that page cannot be deleted.
    const news = await c.post('/api/cms/page', { title: 'Novinky', slug: 'novinky-stranka', status: 'draft', sections: [{ id: 'blk1', type: 'hero', heading: 'x', buttonUrl: `cms:page/${uvod}` }] })
    expect(news.status, JSON.stringify(news.body)).toBe(201)

    const blocked = await seed(['--reset', '--yes'])
    expect(blocked.error?.message).toMatch(/Nothing was removed/)
    expect(blocked.out).toMatch(/− page uvod/) // every entry is listed by name, before anything happens
    expect(blocked.out).toMatch(/! page Novinky \(not made by the seed\) links to page uvod/)
    expect(await counts()).toMatchObject({ post: before.post, tag: before.tag, author: before.author, cms_media: before.cms_media, page: before.page + 1 })
    expect((await sql('select main from navigation'))[0].main).toHaveLength(3) // the menu was not emptied either
    expect((await c.delete(`/api/cms/page/${news.body.row.id}`)).status).toBe(200)
  })

  it('--reset removes what the seed made (and only that): menus first, then entries, then again, uploading each file once', async () => {
    await restart()
    const c = await signedIn()
    expect((await c.post('/api/cms/tag', { name: 'Moje', slug: 'moje' })).status).toBe(201)
    // "novinky" was there before the seed (no author recorded): the seed keeps it and a reset must leave it.
    await sql(`update tag set created_by = null where slug = 'novinky'`)
    const oldPost = (await sql('select id from post'))[0].id
    const oldMedia = await sql('select id, name from cms_media order by name')

    const refused = await seed(['--reset'])
    expect(refused.error?.message).toMatch(/--yes/) // no terminal, no confirmation: nothing deleted
    expect((await sql('select id from post'))[0].id).toBe(oldPost)
    expect(refused.out).toMatch(/− post prvni-clanek/)
    expect(refused.out).toMatch(/− page tym/)
    expect(refused.out).toMatch(/· tag novinky \(not made by the account the seed signs in with\)/)
    expect(refused.out).toMatch(/~ navigation/)

    const reset = await seed(['--reset', '--yes'])
    expect(reset.error).toBeNull()
    expect(reset.out).toMatch(/removes 5 entries and 2 files this seed made/)
    expect(reset.out).toMatch(/~ navigation: links to removed entries taken out/)
    // The logo of the site settings still uses wide.png, so that file stays and is found again.
    expect(reset.out).toMatch(/wide\.png stays \(.*409/)
    expect(reset.out).toMatch(/✓ removed 5 entries and 1 file \(1 still in use stay\)/)
    expect(reset.out).toMatch(/✓ uploaded\s+.*tall\.png/)
    expect(reset.out).not.toMatch(/uploaded\s+.*wide\.png/)
    expect(reset.out).toMatch(/✓ created\s+post prvni-clanek/)

    expect((await sql('select id from post'))[0].id).not.toBe(oldPost)
    expect((await sql(`select slug from tag order by slug`)).map((t) => t.slug)).toEqual(['moje', 'novinky', 'trenink'])
    expect((await sql(`select id from tag where slug = 'novinky'`))).toHaveLength(1)
    const media = await sql('select id, name from cms_media order by name')
    expect(media).toHaveLength(2)
    expect(media[0]).not.toEqual(oldMedia[0]) // tall.png: removed with the seed's own entries, uploaded once more
    expect(media[1]).toEqual(oldMedia[1]) // wide.png: kept, found again
    // The menus are back, following the new pages.
    const nav = (await new Client(srv.baseURL).get('/api/content/_global/navigation')).body.item
    expect(nav.main.map((l: any) => l.url)).toEqual(['/uvod', '/uvod/tym', '/blog'])
    expect((await seed()).out).not.toMatch(/✓ (created|updated|uploaded)/)
  })

  it('a rejected value is named by entry and field', async () => {
    const dir = mkdtempSync(join(repoRoot, 'node_modules/.cache/cms-seed-bad-'))
    try {
      // (one file per seed: a module is loaded once per process)
      const file = join(dir, 'bad-value.ts')
      writeFileSync(file, `import { defineSeed } from 'tinyzoo'\nexport default defineSeed(async (s) => {\n  await s.create('tag', { name: 'Zlé', slug: 'Not A Slug' })\n})\n`)
      const bad = await seed([], {}, file)
      expect(bad.error?.message).toMatch(/^tag Not A Slug: POST \/api\/cms\/tag → 422 Validation failed — slug: Lowercase letters/)
      const typo = join(dir, 'typo.ts')
      writeFileSync(typo, `import { defineSeed } from 'tinyzoo'\nexport default defineSeed(async (s) => {\n  await s.create('tag', { naem: 'x', slug: 'x' })\n})\n`)
      expect((await seed([], {}, typo)).error?.message).toMatch(/tag has no field "naem"/)
      const plain = join(dir, 'plain.ts')
      writeFileSync(plain, `export default 42\n`)
      expect((await seed([], {}, plain)).error?.message).toMatch(/must export a seed: export default defineSeed/)
    }
    finally { rmSync(dir, { recursive: true, force: true }) }
  })

  it('says so when the password is wrong, the password is missing, or nothing answers', async () => {
    await restart()
    expect((await seed([], { SEED_PASSWORD: 'wrong password here' })).error?.message).toMatch(/Wrong email or password/)
    expect((await seed([], { SEED_PASSWORD: '' })).error?.message).toMatch(/SEED_PASSWORD/)
    const lines: string[] = []
    await expect(seedCommand(playground, [SEED, '--url', 'http://127.0.0.1:9', '--wait', '1'], { log: (l) => lines.push(l), cwd: repoRoot, env: { SEED_PASSWORD: 'x' } }))
      .rejects.toThrow(/does not answer/)
  })

  it('the command line: tinyzoo seed --dry-run from a site\'s folder', async () => {
    await restart()
    const cli = join(repoRoot, 'packages/cms/cli/index.ts')
    const run = spawnSync('pnpm', ['exec', 'tsx', cli, 'seed', SEED, '--url', srv.baseURL, '--email', admin.email, '--dry-run'], {
      cwd: playgroundDir, encoding: 'utf8', env: { ...process.env, SEED_PASSWORD: admin.password },
    })
    expect(run.stderr).not.toContain('✗')
    expect(run.status).toBe(0)
    expect(run.stdout).toMatch(/Dry run, nothing written: \d+ already up to date/)
    const bad = spawnSync('pnpm', ['exec', 'tsx', cli, 'seed', SEED, '--url', srv.baseURL, '--email', admin.email], {
      cwd: playgroundDir, encoding: 'utf8', env: { ...process.env, SEED_PASSWORD: '' },
    })
    expect(bad.status).toBe(1)
    expect(bad.stderr).toMatch(/^✗ Set SEED_EMAIL/m)
  })
})
