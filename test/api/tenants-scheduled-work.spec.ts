import { createRequire } from 'node:module'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { type Client } from '../helpers/api'
import { createAuthor, createPost, createTag } from '../helpers/fixtures'
import { expectNoSiteErrors, siteClient, siteHooks, siteHooksMark, siteQuery, startTenants, type Tenants, type TenantSite, until, waitForSiteHooks } from '../helpers/tenants'
import { CMS_IMAGE_WIDTHS } from '../../packages/cms/shared/image-widths'

// Two sites in one process: the scheduled tasks look only at the sites that have a reason
// (packages/cms/server/utils/cmsBackground.ts, cmsScheduler.ts, cmsImageSizes.ts). Here the slow
// rotation that visits every site is the production one (15 minutes), so between the first look
// after the start and the end of the spec a site with no reason is not touched. The rotation
// itself (a short one) is in tenants-sweep.spec.ts.
//
// The proof is from the database side. The scheduler writes `scheduler.lastRun` into the site's
// own `cms_state` every time it looks (the very first thing it does after taking its lock); a
// site it does not look at keeps the value it had. For the smaller copies of pictures a leftover
// picture (a row without sizes) is left in the quiet site's database: if the worker ran there, the
// row for it would appear. The build runs both tasks every second (test/setup/timers.ts).
const sharp = createRequire(join(process.cwd(), 'packages/cms/package.json'))('sharp')
const photo = (width: number, height: number) =>
  sharp({ create: { width, height, channels: 3, noise: { type: 'gaussian', mean: 128, sigma: 40 } } }).jpeg({ quality: 80 }).toBuffer() as Promise<Buffer>

let t: Tenants
let adminA: Client
let adminB: Client
let author: string

beforeAll(async () => {
  t = await startTenants('work', {}, {
    async seed({ admin }) {
      await createAuthor(admin, { name: 'Shared Author' })
    },
  })
  adminA = siteClient(t.a, 'admin')
  adminB = siteClient(t.b, 'admin')
  author = (await siteQuery(t.a, 'select id from author'))[0].id
}, 120_000)
afterAll(async () => {
  try { expectNoSiteErrors(t) }
  finally { await t?.stop() }
})

const lastRun = async (site: TenantSite) => (await siteQuery(site, `select value->>'at' as at from cms_state where key = 'scheduler.lastRun'`))[0]?.at ?? null
const inSeconds = (s: number) => new Date(Date.now() + s * 1000).toISOString()
const about = (id: string, type: string) => (h: { json: any }[]) => h.filter((x) => x.json.id === id && x.json.type === type)
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
/** How long after its time a scheduled entry may be announced: the tick (1 s here) and the run itself. */
const ON_TIME_MS = 3000

describe('scheduled publishing looks only where something may be due', () => {
  it('after the first look a site with nothing scheduled is not queried again, while the site with an entry due in a few seconds is, and publishes on time', async () => {
    // The first tick after the start looks at every site: unknown is looked at.
    await until('the first look at both sites', async () => [await lastRun(t.a), await lastRun(t.b)], ([a, b]) => !!a && !!b, 15_000)
    await sleep(1500)
    const before = { a: await lastRun(t.a), b: await lastRun(t.b) }

    const dueAt = Date.now() + 3000
    const post = await createPost(adminA, { author, title: 'Due on A', slug: 'due-on-a', status: 'published', publishedAt: new Date(dueAt).toISOString() })
    const mark = siteHooksMark(t.a)
    const [hook] = about(post.id, 'entry.published')(await waitForSiteHooks(t.a, mark, (h) => about(post.id, 'entry.published')(h).length > 0, 15_000))
    expect(hook!.json).toMatchObject({ type: 'entry.published', public: true, paths: ['/blog/due-on-a'] })
    expect(Date.now() - dueAt, 'announced on time').toBeLessThan(ON_TIME_MS)

    // A was looked at (after the save, and when its entry came due); B, with nothing scheduled and no change, was not: not once in all these ticks.
    expect(await lastRun(t.a)).not.toBe(before.a)
    await sleep(1500)
    expect(await lastRun(t.b)).toBe(before.b)
  }, 40_000)

  it('scheduling an entry on the quiet site through the admin API makes it publish on time', async () => {
    const before = await lastRun(t.b)
    const dueAt = Date.now() + 3000
    const mark = siteHooksMark(t.b)
    const post = await createPost(adminB, { author, title: 'Due on B', slug: 'due-on-b', status: 'published', publishedAt: new Date(dueAt).toISOString() })
    await waitForSiteHooks(t.b, mark, (h) => about(post.id, 'entry.published')(h).length > 0, 15_000)
    expect(Date.now() - dueAt, 'announced on time').toBeLessThan(ON_TIME_MS)
    expect(await lastRun(t.b)).not.toBe(before)
    // And A, whose own entry was announced before, got nothing of it.
    expect(siteHooks(t.a, mark).filter((h) => h.json.id === post.id)).toEqual([])
  }, 40_000)

  it('any change in a site makes the next tick look at it, and only at it: a save, a deletion', async () => {
    // Both are quiet again once their entries were announced: the next look after an announcement finds nothing due.
    await sleep(2500)
    let a = await lastRun(t.a)
    let b = await lastRun(t.b)
    await sleep(1500)
    expect([await lastRun(t.a), await lastRun(t.b)]).toEqual([a, b])

    // A save on B (an unrelated tag).
    const tag = await createTag(adminB, { name: 'Moves the memory', slug: 'moves-the-memory' })
    b = (await until('B to be looked at after a save', () => lastRun(t.b), (at) => at !== b, 5000))!
    await sleep(1500)
    expect(await lastRun(t.a)).toBe(a)

    // A deletion on A.
    expect((await adminA.delete(`/api/cms/tag/${(await createTag(adminA, { name: 'Goes', slug: 'goes' })).id}`)).status).toBeLessThan(300)
    a = (await until('A to be looked at after a deletion', () => lastRun(t.a), (at) => at !== a, 5000))!
    await sleep(1500)
    expect(await lastRun(t.b)).toBe(b)
    expect(tag.id).toBeTruthy()
  }, 40_000)
})

describe('the smaller copies of pictures are made where this instance has a reason', () => {
  const upload = async (c: Client, name: string) => {
    const res = await c.upload('/api/cms/_media', { name, type: 'image/jpeg', data: new Uint8Array(await photo(900, 600)) })
    expect(res.status, JSON.stringify(res.body)).toBe(201)
    return res.body as { id: string }
  }
  const sizesRow = async (site: TenantSite, id: string) => (await siteQuery(site, 'select state, widths from cms_media_sizes where media_id = $1', [id]))[0]
  const done = (site: TenantSite, id: string) => until(`the smaller copies of ${id}`, () => sizesRow(site, id), (r) => r?.state === 'done' && r.widths === CMS_IMAGE_WIDTHS.join(','), 30_000)

  it('an upload on A makes A\'s worker run; B, which had no upload, is not run by the ticks: a leftover in its database stays', async () => {
    // B has had its look (the first tick) and an upload of its own, which has been dealt with.
    const first = await upload(adminB, 'b-settled.jpg')
    await done(t.b, first.id)
    await sleep(2000)
    // A picture B's worker would pick up if it ran: a row without sizes (as another instance's upload leaves it).
    await siteQuery(t.b, 'delete from cms_media_sizes where media_id = $1', [first.id])

    const onA = await upload(adminA, 'a.jpg')
    await done(t.a, onA.id)
    // Several ticks (every second) with the leftover in B and the upload on A done.
    await sleep(5000)
    expect(await sizesRow(t.b, first.id)).toBeUndefined()
  }, 60_000)
})
