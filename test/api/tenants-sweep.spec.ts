import { createRequire } from 'node:module'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { type Client } from '../helpers/api'
import { createAuthor, createPost } from '../helpers/fixtures'
import { expectNoSiteErrors, siteClient, siteHooks, siteHooksMark, siteQuery, startTenants, type Tenants, type TenantSite, until, waitForSiteHooks } from '../helpers/tenants'
import { CMS_IMAGE_WIDTHS } from '../../packages/cms/shared/image-widths'

// Two sites in one process, with a short slow rotation (CMS_TEST_SWEEP_MS, 4 s; 15 minutes in
// production): the safety net under the scheduled tasks. A site the tasks have no reason to look
// at is still looked at on its turn, so what another instance left (an entry it scheduled, a picture
// it uploaded, which this instance was never told about) is found. The tasks' behaviour between the
// turns is in tenants-scheduled-work.spec.ts.
const SWEEP_MS = 4000
const sharp = createRequire(join(process.cwd(), 'packages/cms/package.json'))('sharp')
const photo = (width: number, height: number) =>
  sharp({ create: { width, height, channels: 3, noise: { type: 'gaussian', mean: 128, sigma: 40 } } }).jpeg({ quality: 80 }).toBuffer() as Promise<Buffer>

let t: Tenants
let adminA: Client
let adminB: Client
let author: string

beforeAll(async () => {
  t = await startTenants('sweep', { CMS_TEST_SWEEP_MS: String(SWEEP_MS) }, {
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

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
const lastRun = async (site: TenantSite) => (await siteQuery(site, `select value->>'at' as at from cms_state where key = 'scheduler.lastRun'`))[0]?.at ?? null
const about = (id: string, type: string) => (h: { json: any }[]) => h.filter((x) => x.json.id === id && x.json.type === type)

describe('the slow rotation under scheduled publishing', () => {
  it('visits a quiet site now and then, and no more often than its turn comes', async () => {
    await until('the first look at both', async () => [await lastRun(t.a), await lastRun(t.b)], ([a, b]) => !!a && !!b, 15_000)
    // Watch A's "last run" for a while: it moves on its turn (every 4 s), not on every tick (every second).
    const seen = new Set<string>()
    const until_ = Date.now() + 14_000
    while (Date.now() < until_) {
      seen.add(await lastRun(t.a))
      await sleep(100)
    }
    // Four turns fit in 14 s (three to five counting the edges); a look on each tick would be about 14.
    expect(seen.size).toBeGreaterThanOrEqual(2)
    expect(seen.size).toBeLessThanOrEqual(6)
  }, 30_000)

  it('an entry scheduled in a site\'s database behind this instance\'s back (as by another instance) is announced on the next turn, or when due', async () => {
    // Drafts made through the API, then scheduled by plain SQL: no change is reported here, as for a write by an instance that died.
    const [a, b] = await Promise.all([
      createPost(adminA, { author, title: 'Behind A', slug: 'behind-a' }),
      createPost(adminB, { author, title: 'Behind B', slug: 'behind-b' }),
    ])
    await sleep(2500) // both settled: the look after the saves found nothing
    const marks = { a: siteHooksMark(t.a), b: siteHooksMark(t.b) }
    const dueAt = Date.now() + 2000
    const schedule = (site: TenantSite, id: string) => siteQuery(site, `update post set status = 'published', published_at = now() + interval '2 seconds', updated_at = now() where id = $1`, [id])
    await Promise.all([schedule(t.a, a.id), schedule(t.b, b.id)])
    const [toA, toB] = await Promise.all([
      waitForSiteHooks(t.a, marks.a, (h) => about(a.id, 'entry.published')(h).length > 0, SWEEP_MS + 8000),
      waitForSiteHooks(t.b, marks.b, (h) => about(b.id, 'entry.published')(h).length > 0, SWEEP_MS + 8000),
    ])
    // Found within a turn of the sweep after its time (the turn that first sees it, then the due time, then a tick).
    expect(Date.now() - dueAt).toBeLessThan(SWEEP_MS + 4000)
    expect(about(a.id, 'entry.published')(toA)[0]!.json.paths).toEqual(['/blog/behind-a'])
    expect(about(b.id, 'entry.published')(toB)[0]!.json.paths).toEqual(['/blog/behind-b'])
    // Each to its own receiver, once.
    expect(about(a.id, 'entry.published')(siteHooks(t.a, marks.a))).toHaveLength(1)
    expect(about(b.id, 'entry.published')(siteHooks(t.b, marks.b))).toHaveLength(1)
    expect(siteHooks(t.b, marks.b).filter((h) => h.json.id === a.id)).toEqual([])
  }, 60_000)
})

describe('the slow rotation under the smaller copies of pictures', () => {
  const sizesRow = async (site: TenantSite, id: string) => (await siteQuery(site, 'select state, widths from cms_media_sizes where media_id = $1', [id]))[0]
  const done = (site: TenantSite, id: string) => until(`the smaller copies of ${id}`, () => sizesRow(site, id), (r) => r?.state === 'done' && r.widths === CMS_IMAGE_WIDTHS.join(','), 30_000)

  it('a picture another instance left without copies is picked up on the site\'s next turn', async () => {
    const res = await adminB.upload('/api/cms/_media', { name: 'left.jpg', type: 'image/jpeg', data: new Uint8Array(await photo(900, 600)) })
    expect(res.status, JSON.stringify(res.body)).toBe(201)
    await done(t.b, res.body.id)
    await sleep(2000)
    // As a picture uploaded on another instance: a row, a file and no sizes. Nothing here was told.
    await siteQuery(t.b, 'delete from cms_media_sizes where media_id = $1', [res.body.id])
    await until('the sweep to make them again', () => sizesRow(t.b, res.body.id), (r) => r?.state === 'done' && r.widths === CMS_IMAGE_WIDTHS.join(','), SWEEP_MS + 10_000)
  }, 60_000)
})
